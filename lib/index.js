(function () {
    var global = new Function("return this;")();
    if (!global || global.window !== global)
        throw new Error("browser-node-require.js works only on the browser");
    function dirname(filename) {
        return filename.substring(0, filename.lastIndexOf("/") + 1);
    }
    var loadedFiles = [];
    var readFileSync = (function () {
        var cache = {};
        return function (url, inNode) {
            if (inNode === void 0) { inNode = false; }
            if (url in cache)
                return cache[url];
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.send();
            var result = xhr.status === 200 ? xhr.responseText : null;
            cache[url] = result;
            if (result !== null)
                loadedFiles.push({ url: url, inNode: inNode });
            return result;
        };
    })();
    function runInContext(source, context, thisArg) {
        if (context === void 0) { context = {}; }
        if (thisArg === void 0) { thisArg = global; }
        var args = [];
        for (var key in context)
            if (context.hasOwnProperty(key))
                args.push({ key: key, value: context[key] });
        var bindArgs = args.map(function (x) { return x.key; });
        bindArgs.unshift("");
        var BindedFunction = Function.prototype.bind.apply(Function, bindArgs);
        var f = new BindedFunction("eval(" + JSON.stringify(source) + ");");
        f.apply(thisArg, args.map(function (x) { return x.value; }));
    }
    var hardResreshing = false;
    var Module = /** @class */ (function () {
        function Module(id, parent) {
            if (parent === void 0) { parent = undefined; }
            this.id = id;
            this.parent = parent;
            this.exports = {};
            this.filename = null;
            this.loaded = false;
            this.paths = [];
            this.children = [];
            this._inNode = false;
            if (this.parent)
                this.parent.children.push(this);
        }
        Module.prototype.require = function (request) {
            var url = Module.resolve(this, request);
            if (url in Module.cache)
                return Module.cache[url].exports;
            var module = new Module(url);
            module._inNode = this._inNode || !/^\.\.?(\/.*|)$/.test(request);
            this.children.pop();
            Module.load(module, url);
            this.children.push(module);
            Module.cache[url] = module;
            return module.exports;
        };
        Module.resolve = function (module, request) {
            if (module.filename === null)
                throw new Error("Cannot resolve requests from the module not loaded");
            var isRelativePathRequest = /^\.\.?(\/.*|)$/.test(request);
            var inNode = module._inNode || !isRelativePathRequest;
            var cachedUrl = Module.resolveCache.get(module.filename, request);
            if (cachedUrl !== null) {
                if (readFileSync(cachedUrl, inNode) === null)
                    Module.resolveCache.remove(module.filename, request);
                else
                    return cachedUrl;
            }
            if (isRelativePathRequest) {
                // relative path
                var r = Module.resolveAsFile(new URL(request, module.filename).href, true, inNode);
                if (r !== null) {
                    Module.resolveCache.set(module.filename, request, r);
                    return r;
                }
            }
            else {
                // node_modules
                var includeSlach = request.indexOf("/") >= 0;
                for (var _i = 0, _a = module.paths; _i < _a.length; _i++) {
                    var nodePath = _a[_i];
                    var r = includeSlach ? Module.resolveAsFile(nodePath + "/" + request, true, inNode) : Module.resolveAsDirectory(nodePath + "/" + request, false, inNode);
                    if (r !== null) {
                        Module.resolveCache.set(module.filename, request, r);
                        return r;
                    }
                }
            }
            throw new Error("Cannot find module '" + request + "'");
        };
        Module.resolveAsFile = function (url, alsoAsDirectory, inNode) {
            if (alsoAsDirectory === void 0) { alsoAsDirectory = false; }
            if (inNode === void 0) { inNode = false; }
            var endsWithSlash = /\/$/.test(url);
            var hasExtension = /\/[^\/]*\.[^\/\.]+$/.test(url);
            if (!endsWithSlash) {
                if (hasExtension && readFileSync(url, inNode) !== null)
                    return url;
                if (readFileSync(url + ".js", inNode) !== null)
                    return url + ".js";
                if (readFileSync(url + ".json", inNode) !== null)
                    return url + ".json";
            }
            if (alsoAsDirectory) {
                var r = Module.resolveAsDirectory(url, true, inNode);
                if (r !== null)
                    return r;
            }
            if (!endsWithSlash && !hasExtension && readFileSync(url, inNode) !== null)
                return url;
            return null;
        };
        Module.resolveAsDirectory = function (url, searchIndex, inNode) {
            if (searchIndex === void 0) { searchIndex = false; }
            if (inNode === void 0) { inNode = false; }
            var endsWithSlash = /\/$/.test(url);
            if (!endsWithSlash)
                url += "/";
            var packageInfoSource = readFileSync(url + "package.json", inNode);
            if (packageInfoSource !== null) {
                var packageInfo = JSON.parse(packageInfoSource);
                if ("main" in packageInfo) {
                    var r = Module.resolveAsFile(new URL(packageInfo.main, url).href, true, inNode);
                    if (r !== null)
                        return r;
                }
            }
            if (searchIndex) {
                var r = Module.resolveAsFile(url + "index", false, inNode);
                if (r !== null)
                    return r;
            }
            return null;
        };
        Module.load = function (module, url, abstract) {
            if (abstract === void 0) { abstract = false; }
            if (module.filename !== null)
                throw new Error("This module has already been loaded");
            module.filename = url;
            var urlObj = new URL(url);
            var pathParts = urlObj.pathname.split("/");
            while (pathParts.length > 1) {
                pathParts.pop();
                module.paths.push(urlObj.origin + pathParts.join("/") + "/node_modules");
            }
            if (!abstract) {
                var source = readFileSync(url);
                if (/\.json$/.test(url)) {
                    // load as json
                    module.exports = JSON.parse(source);
                }
                else {
                    // load as js
                    var source_ = source.replace(/^\#\!.*/, "");
                    var murlRe = /^\/\/# (?:sourceMappingURL|sourceURL)=(.+)$/m;
                    if (murlRe.test(source_)) {
                        source_ = source_.replace(murlRe, function (line, murl) { return line.replace(murl, new URL(murl, url).href); });
                    }
                    else {
                        source_ += "\n//# sourceURL=" + url;
                    }
                    var require = function (request) { return module.require(request); };
                    require.resolve = function (request) { return Module.resolve(module, request); };
                    require.cache = Module.cache;
                    require.main = Module.main;
                    runInContext(source_, {
                        exports: module.exports,
                        require: require,
                        module: module,
                        __filename: module.filename,
                        __dirname: dirname(module.filename)
                    }, module.exports);
                }
            }
        };
        Module.getAbstractModule = function (url) {
            if (url in Module.cache)
                return Module.cache[url];
            var module = Module.cache[url] = new Module(url);
            Module.load(module, url, true);
            return module;
        };
        Module.getCurrentAbstractModule = function () {
            return Module.getAbstractModule((document.currentScript instanceof HTMLScriptElement && document.currentScript.src) || location.href);
        };
        Module.resolveCache = (function () {
            var ssHead = "browser-node-require_resolveCache";
            function ssKey(location, request) {
                return ssHead + "_{" + dirname(location) + "}_{" + request + "}";
            }
            return {
                get: function (location, request) { return sessionStorage.getItem(ssKey(location, request)); },
                set: function (location, request, result) { return sessionStorage.setItem(ssKey(location, request), result); },
                remove: function (location, request) { return sessionStorage.removeItem(ssKey(location, request)); },
                clear: function () {
                    for (var key in sessionStorage)
                        if (key.indexOf(ssHead) === 0)
                            sessionStorage.removeItem(key);
                }
            };
        })();
        Module.cache = {};
        Module.main = (function () {
            var mainModule = Module.getAbstractModule(location.href);
            if ("require" in global)
                console.warn("Existing window.require was overwritten by browser-node-require.js");
            var require = global.require = function (request) { return Module.getCurrentAbstractModule().require(request); };
            require.resolve = function (request) { return Module.resolve(Module.getCurrentAbstractModule(), request); };
            require.cache = Module.cache;
            require.main = mainModule;
            require.clearResolveCache = function () { return Module.resolveCache.clear(); };
            require.hardRefresh = function (includeNode) {
                if (includeNode === void 0) { includeNode = false; }
                if (!document.body)
                    throw new Error("Cannot do hardRefresh before DOM is loaded");
                if (hardResreshing)
                    throw new Error("HardRefreshing has already been started");
                hardResreshing = true;
                var span = document.body.appendChild(document.createElement("span"));
                span.style.display = "none";
                var loadedStates = [];
                var _loop_1 = function (file) {
                    if (includeNode || !file.inNode) {
                        var iframe_1 = span.appendChild(document.createElement("iframe"));
                        var loadedState_1 = { url: file.url, loaded: 0 };
                        loadedStates.push(loadedState_1);
                        iframe_1.addEventListener("load", function (e) {
                            if (loadedState_1.loaded === 0) {
                                loadedState_1.loaded = 1;
                                iframe_1.contentWindow.location.reload(true);
                            }
                            else if (loadedState_1.loaded === 1) {
                                loadedState_1.loaded = 2;
                                if (loadedStates.every(function (state) { return state.loaded === 2; })) {
                                    location.reload(true);
                                }
                            }
                        });
                        iframe_1.src = file.url;
                    }
                };
                for (var _i = 0, loadedFiles_1 = loadedFiles; _i < loadedFiles_1.length; _i++) {
                    var file = loadedFiles_1[_i];
                    _loop_1(file);
                }
            };
            return mainModule;
        })();
        return Module;
    }());
})();
