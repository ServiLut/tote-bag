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
var react_dom_1 = require("react-dom");
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
function assignRef(ref, value) {
    if (typeof ref === "function") {
        ref(value);
        return;
    }
    if (ref && typeof ref === "object") {
        ref.current = value;
    }
}
function Popover(_a) {
    var controlledOpen = _a.open, onOpenChange = _a.onOpenChange, children = _a.children;
    var _b = React.useState(false), uncontrolledOpen = _b[0], setUncontrolledOpen = _b[1];
    var open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
    var rootRef = React.useRef(null);
    var triggerRef = React.useRef(null);
    var contentRef = React.useRef(null);
    var setOpen = React.useCallback(function (nextOpen) {
        setUncontrolledOpen(nextOpen);
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(nextOpen);
    }, [onOpenChange]);
    React.useEffect(function () {
        if (!open) {
            return;
        }
        var handlePointerDown = function (event) {
            var _a, _b;
            var target = event.target;
            if (!((_a = rootRef.current) === null || _a === void 0 ? void 0 : _a.contains(target)) &&
                !((_b = contentRef.current) === null || _b === void 0 ? void 0 : _b.contains(target))) {
                setOpen(false);
            }
        };
        var handleFocusIn = function (event) {
            var _a, _b;
            var target = event.target;
            if (!((_a = rootRef.current) === null || _a === void 0 ? void 0 : _a.contains(target)) &&
                !((_b = contentRef.current) === null || _b === void 0 ? void 0 : _b.contains(target))) {
                setOpen(false);
            }
        };
        var handleEscape = function (event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("focusin", handleFocusIn);
        document.addEventListener("keydown", handleEscape);
        return function () {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("focusin", handleFocusIn);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open, setOpen]);
    return ((0, jsx_runtime_1.jsx)(PopoverContext.Provider, { value: { open: open, setOpen: setOpen, rootRef: rootRef, triggerRef: triggerRef, contentRef: contentRef }, children: (0, jsx_runtime_1.jsx)("div", { ref: rootRef, className: "inline-flex", children: children }) }));
}
function PopoverTrigger(_a) {
    var children = _a.children;
    var _b = usePopoverContext(), open = _b.open, setOpen = _b.setOpen, triggerRef = _b.triggerRef;
    var originalOnClick = children.props.onClick;
    var originalRef = children.props.ref;
    return React.cloneElement(children, {
        ref: function (node) {
            triggerRef.current = node;
            assignRef(originalRef, node);
        },
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
    var _d = usePopoverContext(), open = _d.open, triggerRef = _d.triggerRef, contentRef = _d.contentRef;
    var _e = React.useState(false), mounted = _e[0], setMounted = _e[1];
    var _f = React.useState({
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        visibility: "hidden",
    }), position = _f[0], setPosition = _f[1];
    React.useEffect(function () {
        setMounted(true);
    }, []);
    React.useEffect(function () {
        if (!open || !triggerRef.current || !contentRef.current) {
            return;
        }
        var offset = 8;
        var viewportPadding = 8;
        var updatePosition = function () {
            if (!triggerRef.current || !contentRef.current) {
                return;
            }
            var triggerRect = triggerRef.current.getBoundingClientRect();
            var contentRect = contentRef.current.getBoundingClientRect();
            var viewportWidth = window.innerWidth;
            var viewportHeight = window.innerHeight;
            var left = align === "start"
                ? triggerRect.left
                : align === "end"
                    ? triggerRect.right - contentRect.width
                    : triggerRect.left + (triggerRect.width - contentRect.width) / 2;
            left = Math.max(viewportPadding, Math.min(left, viewportWidth - contentRect.width - viewportPadding));
            var bottomTop = triggerRect.bottom + offset;
            var topTop = triggerRect.top - contentRect.height - offset;
            var shouldPlaceOnTop = side === "top"
                ? topTop >= viewportPadding ||
                    bottomTop + contentRect.height > viewportHeight - viewportPadding
                : bottomTop + contentRect.height > viewportHeight - viewportPadding &&
                    topTop >= viewportPadding;
            var top = shouldPlaceOnTop ? topTop : bottomTop;
            top = Math.max(viewportPadding, Math.min(top, viewportHeight - contentRect.height - viewportPadding));
            setPosition({
                position: "fixed",
                top: top,
                left: left,
                zIndex: 9999,
                visibility: "visible",
            });
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return function () {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [align, open, side, triggerRef]);
    if (!open || !mounted) {
        return null;
    }
    return (0, react_dom_1.createPortal)((0, jsx_runtime_1.jsx)("div", { ref: contentRef, style: position, className: joinClassNames("z-[9999]", className), children: children }), document.body);
}
