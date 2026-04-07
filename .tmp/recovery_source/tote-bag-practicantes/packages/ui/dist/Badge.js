"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Badge = Badge;
var jsx_runtime_1 = require("react/jsx-runtime");
function Badge(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b, _c = _a.variant, variant = _c === void 0 ? "default" : _c;
    var variants = {
        default: "bg-primary text-base-color",
        secondary: "bg-secondary text-white",
        outline: "border border-theme text-primary",
    };
    return ((0, jsx_runtime_1.jsx)("span", { className: "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ".concat(variants[variant], " ").concat(className), children: children }));
}
