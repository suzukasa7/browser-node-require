exports.evaluationContext = function () {
    return { exports, require, module, __filename, __dirname /* Within the module these variables are available */ };
};

exports.changeColor = function (debug) {
    if (debug) debugger;
    var r = Math.floor(Math.random() * 256);
    var g = Math.floor(Math.random() * 256);
    var b = Math.floor(Math.random() * 256);
    document.body.style.backgroundColor = "rgb(" + r + "," + g + "," + b + ")";
};

var n = 0; // local variable
exports.counter = function () { return n++; };

exports.M = require("./m" /* Relative path from THIS file */ );