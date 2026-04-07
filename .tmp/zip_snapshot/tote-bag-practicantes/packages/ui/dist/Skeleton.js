"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skeleton = Skeleton;
var jsx_runtime_1 = require("react/jsx-runtime");
function Skeleton(_a) {
    var _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("div", { className: "animate-pulse bg-base-color opacity-10 rounded ".concat(className) }));
}
