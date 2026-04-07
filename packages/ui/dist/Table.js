"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Table = Table;
exports.TableHeader = TableHeader;
exports.TableRow = TableRow;
exports.TableHead = TableHead;
exports.TableBody = TableBody;
exports.TableCell = TableCell;
var jsx_runtime_1 = require("react/jsx-runtime");
function Table(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto w-full", children: (0, jsx_runtime_1.jsx)("table", { className: "w-full text-sm text-left border-collapse ".concat(className), children: children }) }));
}
function TableHeader(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("thead", { className: "bg-base/50 text-muted border-b border-theme ".concat(className), children: children }));
}
function TableRow(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("tr", { className: "border-b border-theme/50 last:border-0 hover:bg-base/20 transition-colors ".concat(className), children: children }));
}
function TableHead(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 font-black text-[10px] uppercase tracking-widest text-muted ".concat(className), children: children }));
}
function TableBody(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-theme/30 ".concat(className), children: children }));
}
function TableCell(_a) {
    var children = _a.children, _b = _a.className, className = _b === void 0 ? "" : _b;
    return ((0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 font-medium text-primary ".concat(className), children: children }));
}
