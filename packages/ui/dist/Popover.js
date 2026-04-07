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
exports.Popover = Popover;
exports.PopoverTrigger = PopoverTrigger;
exports.PopoverContent = PopoverContent;
var jsx_runtime_1 = require("react/jsx-runtime");
var React = __importStar(require("react"));
var PopoverContext = React.createContext(undefined);
function usePopoverContext() {
    var context = React.useContext(PopoverContext);
    if (!context) {
        throw new Error("Popover components must be used within Popover");
    }
    return context;
}
function joinClassNames() {
    var values = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        values[_i] = arguments[_i];
    }
    return values.filter(Boolean).join(" ");
}
function Popover(_a) {
    var controlledOpen = _a.open, onOpenChange = _a.onOpenChange, children = _a.children;
    var _b = React.useState(false), uncontrolledOpen = _b[0], setUncontrolledOpen = _b[1];
    var open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
    var rootRef = React.useRef(null);
    var setOpen = React.useCallback(function (nextOpen) {
        setUncontrolledOpen(nextOpen);
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(nextOpen);
    }, [onOpenChange]);
    React.useEffect(function () {
        if (!open) {
            return;
        }
        var handlePointerDown = function (event) {
            var _a;
            if (!((_a = rootRef.current) === null || _a === void 0 ? void 0 : _a.contains(event.target))) {
                setOpen(false);
            }
        };
        var handleEscape = function (event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);
        return function () {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open, setOpen]);
    return ((0, jsx_runtime_1.jsx)(PopoverContext.Provider, { value: { open: open, setOpen: setOpen }, children: (0, jsx_runtime_1.jsx)("div", { ref: rootRef, className: "relative inline-flex", children: children }) }));
}
function PopoverTrigger(_a) {
    var children = _a.children;
    var _b = usePopoverContext(), open = _b.open, setOpen = _b.setOpen;
    var originalOnClick = children.props.onClick;
    return React.cloneElement(children, {
        onClick: function (event) {
            if (typeof originalOnClick === "function") {
                originalOnClick(event);
            }
            setOpen(!open);
        },
    });
}
function PopoverContent(_a) {
    var children = _a.children, className = _a.className, _b = _a.align, align = _b === void 0 ? "center" : _b, _c = _a.side, side = _c === void 0 ? "bottom" : _c;
    var open = usePopoverContext().open;
    if (!open) {
        return null;
    }
    var positionClassName = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
    var alignClassName = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
    return ((0, jsx_runtime_1.jsx)("div", { className: joinClassNames("absolute z-50", positionClassName, alignClassName, className), children: children }));
}
