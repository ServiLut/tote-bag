import * as React from "react";
import { createPortal } from "react-dom";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
};

type PopoverPosition = {
  top: number;
  left: number;
};

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string) {
  const context = React.useContext(PopoverContext);

  if (!context) {
    throw new Error(`${component} must be used within Popover`);
  }

  return context;
}

function composeEventHandlers<EventType extends React.SyntheticEvent>(
  theirHandler: ((event: EventType) => void) | undefined,
  ourHandler: (event: EventType) => void,
) {
  return (event: EventType) => {
    theirHandler?.(event);
    if (!event.defaultPrevented) {
      ourHandler(event);
    }
  };
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref && typeof ref === "object") {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

function getPopoverPosition({
  triggerRect,
  contentRect,
  side,
  align,
  sideOffset,
  collisionPadding,
}: {
  triggerRect: DOMRect;
  contentRect: DOMRect;
  side: "top" | "bottom";
  align: "start" | "center" | "end";
  sideOffset: number;
  collisionPadding: number;
}): PopoverPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let resolvedSide = side;

  const bottomTop = triggerRect.bottom + sideOffset;
  const topTop = triggerRect.top - contentRect.height - sideOffset;
  const fitsBottom = bottomTop + contentRect.height <= viewportHeight - collisionPadding;
  const fitsTop = topTop >= collisionPadding;

  if (side === "bottom" && !fitsBottom && fitsTop) {
    resolvedSide = "top";
  } else if (side === "top" && !fitsTop && fitsBottom) {
    resolvedSide = "bottom";
  }

  let top =
    resolvedSide === "bottom"
      ? triggerRect.bottom + sideOffset
      : triggerRect.top - contentRect.height - sideOffset;

  let left = triggerRect.left;

  if (align === "center") {
    left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
  } else if (align === "end") {
    left = triggerRect.right - contentRect.width;
  }

  const maxLeft = Math.max(collisionPadding, viewportWidth - contentRect.width - collisionPadding);
  const maxTop = Math.max(collisionPadding, viewportHeight - contentRect.height - collisionPadding);

  return {
    top: Math.min(Math.max(top, collisionPadding), maxTop),
    left: Math.min(Math.max(left, collisionPadding), maxLeft),
  };
}

export interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const contentId = React.useId();

  const open = openProp ?? uncontrolledOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp],
  );

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId,
    }),
    [contentId, open, setOpen],
  );

  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export interface PopoverTriggerProps {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
}

export function PopoverTrigger({ children }: PopoverTriggerProps) {
  const { open, setOpen, triggerRef, contentId } = usePopoverContext("PopoverTrigger");
  const child = children;

  return React.cloneElement(child, {
    ref: mergeRefs(child.props.ref, triggerRef),
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    "aria-controls": contentId,
    onClick: composeEventHandlers(child.props.onClick, () => setOpen(!open)),
  });
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  collisionPadding?: number;
}

export function PopoverContent({
  children,
  side = "bottom",
  align = "end",
  sideOffset = 8,
  collisionPadding = 12,
  style,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, triggerRef, contentRef, contentId } = usePopoverContext("PopoverContent");
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<PopoverPosition | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!open || !triggerRef.current || !contentRef.current) {
      return;
    }

    const nextPosition = getPopoverPosition({
      triggerRect: triggerRef.current.getBoundingClientRect(),
      contentRect: contentRef.current.getBoundingClientRect(),
      side,
      align,
      sideOffset,
      collisionPadding,
    });

    setPosition(nextPosition);
  }, [align, collisionPadding, open, side, sideOffset, triggerRef]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    updatePosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleWindowChange = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open, setOpen, triggerRef, updatePosition]);

  React.useLayoutEffect(() => {
    updatePosition();
  }, [children, updatePosition]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      {...props}
      id={contentId}
      ref={contentRef}
      role="dialog"
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        zIndex: 1000,
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

Popover.displayName = "Popover";
PopoverTrigger.displayName = "PopoverTrigger";
PopoverContent.displayName = "PopoverContent";
