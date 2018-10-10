"use strict";
exports.__esModule = true;
function gcd(a, b) {
    if (typeof a !== "number" || typeof b !== "number")
        throw new Error("Invalid argument");
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    if (a === 0 || b === 0)
        return NaN;
    var r = a % b;
    return r === 0 ? b : gcd(b, r);
}
exports.gcd = gcd;
function error() {
    throw new Error("<<error at m.ts:11>>");
}
exports.error = error;
function evaluationContext() {
    return { exports: exports, require: require, module: module, __filename: __filename, __dirname: __dirname };
}
exports.evaluationContext = evaluationContext;
//# sourceMappingURL=m.js.map