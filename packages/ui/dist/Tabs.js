"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = Tabs;
exports.TabsList = TabsList;
exports.TabsTrigger = TabsTrigger;
exports.TabsContent = TabsContent;
var jsx_runtime_1 = require("react/jsx-runtime");
var React = __importStar(require("react"));
var TabsContext = React.createContext(undefined);
function joinClassNames() {
    var values = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        values[_i] = arguments[_i];
    }
    return values.filter(Boolean).join(" ");
}
function Tabs(_a) {
    var defaultValue = _a.defaultValue, controlledValue = _a.value, onValueChange = _a.onValueChange, children = _a.children, className = _a.className;
    var _b = React.useState(defaultValue || ""), uncontrolledValue = _b[0], setUncontrolledValue = _b[1];
    var value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
    var handleValueChange = React.useCallback(function (nextValue) {
        setUncontrolledValue(nextValue);
        onValueChange === null || onValueChange === void 0 ? void 0 : onValueChange(nextValue);
    }, [onValueChange]);
    return ((0, jsx_runtime_1.jsx)(TabsContext.Provider, { value: { value: value, onValueChange: handleValueChange }, children: (0, jsx_runtime_1.jsx)("div", { className: joinClassNames("w-full", className), children: children }) }));
}
function TabsList(_a) {
    var children = _a.children, className = _a.className;
    return ((0, jsx_runtime_1.jsx)("div", { className: joinClassNames("flex w-fit items-center gap-1 rounded-2xl border border-theme bg-base/50 p-1.5", className), children: children }));
}
function TabsTrigger(_a) {
    var value = _a.value, children = _a.children, className = _a.className;
    var context = React.useContext(TabsContext);
    if (!context) {
        throw new Error("TabsTrigger must be used within Tabs");
    }
    var isActive = context.value === value;
    return ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: function () { return context.onValueChange(value); }, className: joinClassNames("rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all active:scale-95", isActive
            ? "bg-primary text-base-color shadow-lg shadow-primary/10"
            : "text-muted hover:bg-primary/5 hover:text-primary", className), children: children }));
}
function TabsContent(_a) {
    var value = _a.value, children = _a.children, className = _a.className;
    var context = React.useContext(TabsContext);
    if (!context) {
        throw new Error("TabsContent must be used within Tabs");
    }
    if (context.value !== value) {
        return null;
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: joinClassNames("mt-6 animate-in fade-in duration-300", className), children: children }));
}
