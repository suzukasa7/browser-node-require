(() => {
    const global = new Function("return this;")();
    if (!global || global.window !== global) throw new Error("browser-node-require.js works only on the browser");

    function dirname(filename: string): string {
        return filename.substring(0, filename.lastIndexOf("/") + 1);
    }

    const loadedFiles: { url: string, inNode: boolean }[] = [];
    const readFileSync = (() => {
        const cache: { [x: string]: string | null } = {};
        return (url: string, inNode = false): string | null => {
            if (url in cache) return cache[url];
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.send();
            const result = xhr.status === 200 ? xhr.responseText : null;
            cache[url] = result;
            if (result !== null) loadedFiles.push({ url, inNode });
            return result;
        };
    })();

    function runInContext(source: string, context: any = {}, thisArg: any = global) {
        const args: { key: string, value: any }[] = [];
        for (let key in context) if (context.hasOwnProperty(key)) args.push({ key, value: context[key] });
        const bindArgs = args.map(x => x.key);
        bindArgs.unshift("");
        const BindedFunction = Function.prototype.bind.apply(Function, bindArgs);
        const f = new BindedFunction(`eval(${JSON.stringify(source)});`);
        f.apply(thisArg, args.map(x => x.value));
    }

    let hardResreshing = false;

    class Module {
        exports: any = {};
        filename: string | null = null;
        loaded = false;
        readonly paths: string[] = [];
        readonly children: Module[] = [];
        private _inNode = false;
        private constructor(
            readonly id: string,
            readonly parent: Module | undefined = undefined
        ) {
            if (this.parent) this.parent.children.push(this);
        }

        require(request: string): any {
            const url = Module.resolve(this, request);
            if (url in Module.cache) return Module.cache[url].exports;
            const module = new Module(url);
            module._inNode = this._inNode || !/^\.\.?(\/.*|)$/.test(request);

            this.children.pop();
            Module.load(module, url);
            this.children.push(module);

            Module.cache[url] = module;
            return module.exports;
        }

        private static resolve(module: Module, request: string): string {
            if (module.filename === null) throw new Error("Cannot resolve requests from the module not loaded");
            const isRelativePathRequest = /^\.\.?(\/.*|)$/.test(request);
            const inNode = module._inNode || !isRelativePathRequest;
            const cachedUrl = Module.resolveCache.get(module.filename, request);
            if (cachedUrl !== null) {
                if (readFileSync(cachedUrl, inNode) === null) Module.resolveCache.remove(module.filename, request); else return cachedUrl;
            }
            if (isRelativePathRequest) {
                // relative path
                const r = Module.resolveAsFile(new URL(request, module.filename).href, true, inNode);
                if (r !== null) {
                    Module.resolveCache.set(module.filename, request, r);
                    return r;
                }
            } else {
                // node_modules
                const includeSlach = request.indexOf("/") >= 0;
                for (let nodePath of module.paths) {
                    const r = includeSlach ? Module.resolveAsFile(nodePath + "/" + request, true, inNode) : Module.resolveAsDirectory(nodePath + "/" + request, false, inNode);
                    if (r !== null) {
                        Module.resolveCache.set(module.filename, request, r);
                        return r;
                    }
                }
            }
            throw new Error(`Cannot find module '${request}'`);
        }

        private static resolveAsFile(url: string, alsoAsDirectory = false, inNode = false): string | null {
            const endsWithSlash = /\/$/.test(url);
            const hasExtension = /\/[^\/]*\.[^\/\.]+$/.test(url);
            if (!endsWithSlash) {
                if (hasExtension && readFileSync(url, inNode) !== null) return url;
                if (readFileSync(url + ".js", inNode) !== null) return url + ".js";
                if (readFileSync(url + ".json", inNode) !== null) return url + ".json";
            }
            if (alsoAsDirectory) {
                const r = Module.resolveAsDirectory(url, true, inNode);
                if (r !== null) return r;
            }
            if (!endsWithSlash && !hasExtension && readFileSync(url, inNode) !== null) return url;
            return null;
        }

        private static resolveAsDirectory(url: string, searchIndex = false, inNode = false): string | null {
            const endsWithSlash = /\/$/.test(url);
            if (!endsWithSlash) url += "/";
            const packageInfoSource = readFileSync(url + "package.json", inNode);
            if (packageInfoSource !== null) {
                const packageInfo = JSON.parse(packageInfoSource);
                if ("main" in packageInfo) {
                    const r = Module.resolveAsFile(new URL(packageInfo.main, url).href, true, inNode);
                    if (r !== null) return r;
                }
            }
            if (searchIndex) {
                const r = Module.resolveAsFile(url + "index", false, inNode);
                if (r !== null) return r;
            }
            return null;
        }

        private static resolveCache = (() => {
            const ssHead = "browser-node-require_resolveCache";
            function ssKey(location: string, request: string): string {
                return `${ssHead}_{${dirname(location)}}_{${request}}`;
            }
            return {
                get: (location: string, request: string): string | null => sessionStorage.getItem(ssKey(location, request)),
                set: (location: string, request: string, result: string) => sessionStorage.setItem(ssKey(location, request), result),
                remove: (location: string, request: string) => sessionStorage.removeItem(ssKey(location, request)),
                clear: () => {
                    for (let key in sessionStorage) if (key.indexOf(ssHead) === 0) sessionStorage.removeItem(key);
                }
            };
        })();

        private static load(module: Module, url: string, abstract = false) {
            if (module.filename !== null) throw new Error("This module has already been loaded");
            module.filename = url;
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split("/");
            while (pathParts.length > 1) {
                pathParts.pop();
                module.paths.push(urlObj.origin + pathParts.join("/") + "/node_modules");
            }
            if (!abstract) {
                const source = readFileSync(url)!;
                if (/\.json$/.test(url)) {
                    // load as json
                    module.exports = JSON.parse(source);
                } else {
                    // load as js
                    let source_ = source.replace(/^\#\!.*/, "");
                    const murlRe = /^\/\/# (?:sourceMappingURL|sourceURL)=(.+)$/m;
                    if (murlRe.test(source_)) {
                        source_ = source_.replace(murlRe, (line, murl) => line.replace(murl, new URL(murl, url).href));
                    } else {
                        source_ += `\n//# sourceURL=${url}`;
                    }

                    const require: any = (request: string) => module.require(request);
                    require.resolve = (request: string) => Module.resolve(module, request);
                    require.cache = Module.cache;
                    require.main = Module.main;

                    runInContext(source_, {
                        exports: module.exports,
                        require,
                        module,
                        __filename: module.filename,
                        __dirname: dirname(module.filename)
                    }, module.exports);
                }
            }
        }

        private static readonly cache: { [x: string]: Module } = {};
        private static getAbstractModule(url: string): Module {
            if (url in Module.cache) return Module.cache[url];
            const module = Module.cache[url] = new Module(url);
            Module.load(module, url, true);
            return module;
        }
        private static getCurrentAbstractModule(): Module {
            return Module.getAbstractModule((document.currentScript instanceof HTMLScriptElement && document.currentScript.src) || location.href);
        }

        private static readonly main = (() => {
            const mainModule = Module.getAbstractModule(location.href);

            if ("require" in global) console.warn("Existing window.require was overwritten by browser-node-require.js");

            const require: any = global.require = (request: string) => Module.getCurrentAbstractModule().require(request);
            require.resolve = (request: string) => Module.resolve(Module.getCurrentAbstractModule(), request);
            require.cache = Module.cache;
            require.main = mainModule;

            require.clearResolveCache = () => Module.resolveCache.clear();
            require.hardRefresh = (includeNode = false) => {
                if (!document.body) throw new Error("Cannot do hardRefresh before DOM is loaded");
                if (hardResreshing) throw new Error("HardRefreshing has already been started");
                hardResreshing = true;

                const span = document.body.appendChild(document.createElement("span"));
                span.style.display = "none";
                const loadedStates: { url: string, loaded: number }[] = [];
                for (let file of loadedFiles) {
                    if (includeNode || !file.inNode) {
                        const iframe = span.appendChild(document.createElement("iframe"));
                        const loadedState = { url: file.url, loaded: 0 };
                        loadedStates.push(loadedState);
                        iframe.addEventListener("load", e => {
                            if (loadedState.loaded === 0) {
                                loadedState.loaded = 1;
                                iframe.contentWindow!.location.reload(true);
                            } else if (loadedState.loaded === 1) {
                                loadedState.loaded = 2;
                                if (loadedStates.every(state => state.loaded === 2)) {
                                    location.reload(true);
                                }
                            }
                        });
                        iframe.src = file.url;
                    }
                }
            };

            return mainModule;
        })();
    }
})();