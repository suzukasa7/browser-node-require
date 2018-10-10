(function () {
    var global = new Function("return this;")();
    if (!global || global.window !== global)
        throw new Error("browser-node-require.js works only on the browser");
    function dirname(filename) {
        return filename.substring(0, filename.lastIndexOf("/") + 1);
    }
    var readFileSync = (function () {
        var cache = {};
        return function (url) {
            if (url in cache)
                return cache[url];
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.send();
            var result = xhr.status === 200 ? xhr.responseText : null;
            cache[url] = result;
            if (result !== null)
                iframes.add(url);
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
    var iframes = (function () {
        var span = document.createElement("span");
        span.style.display = "none";
        if (document.body) {
            document.body.appendChild(span);
        }
        else {
            document.addEventListener("DOMContentLoaded", function (e) { return document.body.appendChild(span); });
        }
        var iframes = [];
        return {
            add: function (url) {
                if (iframes.some(function (iframe) { return iframe.src === url; }))
                    return;
                var iframe = span.appendChild(document.createElement("iframe"));
                iframes.push(iframe);
                iframe.src = url;
            },
            reloadAll: function (includeNode) {
                if (includeNode === void 0) { includeNode = false; }
                for (var _i = 0, iframes_1 = iframes; _i < iframes_1.length; _i++) {
                    var iframe = iframes_1[_i];
                    if (iframe.contentWindow && (includeNode || !/\/node_modules\//.test(iframe.src)))
                        iframe.contentWindow.location.reload(true);
                }
            }
        };
    })();
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
            if (this.parent)
                this.parent.children.push(this);
        }
        Module.prototype.require = function (request) {
            var url = Module.resolve(this, request);
            if (url in Module.cache)
                return Module.cache[url].exports;
            var module = new Module(url);
            this.children.pop();
            Module.load(module, url);
            this.children.push(module);
            Module.cache[url] = module;
            return module.exports;
        };
        Module.resolve = function (module, request) {
            if (module.filename === null)
                throw new Error("Cannot resolve requests from the module not loaded");
            var cachedUrl = Module.resolveCache.get(module.filename, request);
            if (cachedUrl !== null) {
                if (readFileSync(cachedUrl) === null)
                    Module.resolveCache.remove(module.filename, request);
                else
                    return cachedUrl;
            }
            if (/^\.\.?(\/.*|)$/.test(request)) {
                // relative path
                var r = Module.resolveAsFile(new URL(request, module.filename).href, true);
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
                    var r = includeSlach ? Module.resolveAsFile(nodePath + "/" + request, true) : Module.resolveAsDirectory(nodePath + "/" + request, false);
                    if (r !== null) {
                        Module.resolveCache.set(module.filename, request, r);
                        return r;
                    }
                }
            }
            throw new Error("Cannot find module '" + request + "'");
        };
        Module.resolveAsFile = function (url, alsoAsDirectory) {
            if (alsoAsDirectory === void 0) { alsoAsDirectory = false; }
            var endsWithSlash = /\/$/.test(url);
            var hasExtension = /\/[^\/]*\.[^\/\.]+$/.test(url);
            if (!endsWithSlash) {
                if (hasExtension && readFileSync(url) !== null)
                    return url;
                if (readFileSync(url + ".js") !== null)
                    return url + ".js";
                if (readFileSync(url + ".json") !== null)
                    return url + ".json";
            }
            if (alsoAsDirectory) {
                var r = Module.resolveAsDirectory(url, true);
                if (r !== null)
                    return r;
            }
            if (!endsWithSlash && !hasExtension && readFileSync(url) !== null)
                return url;
            return null;
        };
        Module.resolveAsDirectory = function (url, searchIndex) {
            if (searchIndex === void 0) { searchIndex = false; }
            var endsWithSlash = /\/$/.test(url);
            if (!endsWithSlash)
                url += "/";
            var packageInfoSource = readFileSync(url + "package.json");
            if (packageInfoSource !== null) {
                var packageInfo = JSON.parse(packageInfoSource);
                if ("main" in packageInfo) {
                    var r = Module.resolveAsFile(new URL(packageInfo.main, url).href, true);
                    if (r !== null)
                        return r;
                }
            }
            if (searchIndex) {
                var r = Module.resolveAsFile(url + "index", false);
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
                iframes.reloadAll(includeNode);
                location.reload(true);
            };
            return mainModule;
        })();
        return Module;
    }());
})();
