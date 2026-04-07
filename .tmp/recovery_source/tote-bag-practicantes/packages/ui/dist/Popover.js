"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Popover = Popover;
exports.PopoverTrigger = PopoverTrigger;
exports.PopoverContent = PopoverContent;
var jsx_runtime_1 = require("react/jsx-runtime");
var React = __importStar(require("react"));
var react_dom_1 = require("react-dom");
var PopoverContext = React.createContext(null);
function usePopoverContext(component) {
    var context = React.useContext(PopoverContext);
    if (!context) {
        throw new Error("".concat(component, " must be used within Popover"));
    }
    return context;
}
function composeEventHandlers(theirHandler, ourHandler) {
    return function (event) {
        theirHandler === null || theirHandler === void 0 ? void 0 : theirHandler(event);
        if (!event.defaultPrevented) {
            ourHandler(event);
        }
    };
}
function mergeRefs() {
    var refs = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        refs[_i] = arguments[_i];
    }
    return function (value) {
        refs.forEach(function (ref) {
            if (typeof ref === "function") {
                ref(value);
            }
            else if (ref && typeof ref === "object") {
                ref.current = value;
            }
        });
    };
}
function getPopoverPosition(_a) {
    var triggerRect = _a.triggerRect, contentRect = _a.contentRect, side = _a.side, align = _a.align, sideOffset = _a.sideOffset, collisionPadding = _a.collisionPadding;
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var resolvedSide = side;
    var bottomTop = triggerRect.bottom + sideOffset;
    var topTop = triggerRect.top - contentRect.height - sideOffset;
    var fitsBottom = bottomTop + contentRect.height <= viewportHeight - collisionPadding;
    var fitsTop = topTop >= collisionPadding;
    if (side === "bottom" && !fitsBottom && fitsTop) {
        resolvedSide = "top";
    }
    else if (side === "top" && !fitsTop && fitsBottom) {
        resolvedSide = "bottom";
    }
    var top = resolvedSide === "bottom"
        ? triggerRect.bottom + sideOffset
        : triggerRect.top - contentRect.height - sideOffset;
    var left = triggerRect.left;
    if (align === "center") {
        left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
    }
    else if (align === "end") {
        left = triggerRect.right - contentRect.width;
    }
    var maxLeft = Math.max(collisionPadding, viewportWidth - contentRect.width - collisionPadding);
    var maxTop = Math.max(collisionPadding, viewportHeight - contentRect.height - collisionPadding);
    return {
        top: Math.min(Math.max(top, collisionPadding), maxTop),
        left: Math.min(Math.max(left, collisionPadding), maxLeft),
    };
}
function Popover(_a) {
    var children = _a.children, openProp = _a.open, _b = _a.defaultOpen, defaultOpen = _b === void 0 ? false : _b, onOpenChange = _a.onOpenChange;
    var _c = React.useState(defaultOpen), uncontrolledOpen = _c[0], setUncontrolledOpen = _c[1];
    var triggerRef = React.useRef(null);
    var contentRef = React.useRef(null);
    var contentId = React.useId();
    var open = openProp !== null && openProp !== void 0 ? openProp : uncontrolledOpen;
    var setOpen = React.useCallback(function (nextOpen) {
        if (openProp === undefined) {
            setUncontrolledOpen(nextOpen);
        }
        onOpenChange === null || onOpenChange === void 0 ? void 0 : onOpenChange(nextOpen);
    }, [onOpenChange, openProp]);
    var value = React.useMemo(function () { return ({
        open: open,
        setOpen: setOpen,
        triggerRef: triggerRef,
        contentRef: contentRef,
        contentId: contentId,
    }); }, [contentId, open, setOpen]);
    return (0, jsx_runtime_1.jsx)(PopoverContext.Provider, { value: value, children: children });
}
function PopoverTrigger(_a) {
    var children = _a.children;
    var _b = usePopoverContext("PopoverTrigger"), open = _b.open, setOpen = _b.setOpen, triggerRef = _b.triggerRef, contentId = _b.contentId;
    var child = children;
    return React.cloneElement(child, {
        ref: mergeRefs(child.props.ref, triggerRef),
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        "aria-controls": contentId,
        onClick: composeEventHandlers(child.props.onClick, function () { return setOpen(!open); }),
    });
}
function PopoverContent(_a) {
    var _b, _c;
    var children = _a.children, _d = _a.side, side = _d === void 0 ? "bottom" : _d, _e = _a.align, align = _e === void 0 ? "end" : _e, _f = _a.sideOffset, sideOffset = _f === void 0 ? 8 : _f, _g = _a.collisionPadding, collisionPadding = _g === void 0 ? 12 : _g, style = _a.style, props = __rest(_a, ["children", "side", "align", "sideOffset", "collisionPadding", "style"]);
    var _h = usePopoverContext("PopoverContent"), open = _h.open, setOpen = _h.setOpen, triggerRef = _h.triggerRef, contentRef = _h.contentRef, contentId = _h.contentId;
    var _j = React.useState(false), mounted = _j[0], setMounted = _j[1];
    var _k = React.useState(null), position = _k[0], setPosition = _k[1];
    React.useEffect(function () {
        setMounted(true);
    }, []);
    var updatePosition = React.useCallback(function () {
        if (!open || !triggerRef.current || !contentRef.current) {
            return;
        }
        var nextPosition = getPopoverPosition({
            triggerRect: triggerRef.current.getBoundingClientRect(),
            contentRect: contentRef.current.getBoundingClientRect(),
            side: side,
            align: align,
            sideOffset: sideOffset,
            collisionPadding: collisionPadding,
        });
        setPosition(nextPosition);
    }, [align, collisionPadding, open, side, sideOffset, triggerRef]);
    React.useEffect(function () {
        if (!open) {
            return;
        }
        updatePosition();
        var handlePointerDown = function (event) {
            var _a, _b;
            var target = event.target;
            if (((_a = triggerRef.current) === null || _a === void 0 ? void 0 : _a.contains(target)) ||
                ((_b = contentRef.current) === null || _b === void 0 ? void 0 : _b.contains(target))) {
                return;
            }
            setOpen(false);
        };
        var handleKeyDown = function (event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        var handleWindowChange = function () {
            updatePosition();
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", handleWindowChange);
        window.addEventListener("scroll", handleWindowChange, true);
        return function () {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("resize", handleWindowChange);
            window.removeEventListener("scroll", handleWindowChange, true);
        };
    }, [open, setOpen, triggerRef, updatePosition]);
    React.useLayoutEffect(function () {
        updatePosition();
    }, [children, updatePosition]);
    if (!mounted || !open) {
        return null;
    }
    return (0, react_dom_1.createPortal)((0, jsx_runtime_1.jsx)("div", __assign({}, props, { id: contentId, ref: contentRef, role: "dialog", style: __assign({ position: "fixed", top: (_b = position === null || position === void 0 ? void 0 : position.top) !== null && _b !== void 0 ? _b : -9999, left: (_c = position === null || position === void 0 ? void 0 : position.left) !== null && _c !== void 0 ? _c : -9999, zIndex: 1000 }, style), children: children })), document.body);
}
Popover.displayName = "Popover";
PopoverTrigger.displayName = "PopoverTrigger";
PopoverContent.displayName = "PopoverContent";
