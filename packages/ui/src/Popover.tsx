import * as React from "react";
import { createPortal } from "react-dom";

type PopoverContextValue = {
  open: boolean;
  setOpen: (nextOpen: boolean) => void;
  rootRef: React.MutableRefObject<HTMLDivElement | null>;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
};

const PopoverContext = React.createContext<PopoverContextValue | undefined>(undefined);

function usePopoverContext() {
  const context = React.useContext(PopoverContext);

  if (!context) {
    throw new Error("Popover components must be used within Popover");
  }

  return context;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref && typeof ref === "object") {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

export function Popover({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      setUncontrolledOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !contentRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !contentRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider
      value={{ open, setOpen, rootRef, triggerRef, contentRef }}
    >
      <div ref={rootRef} className="inline-flex">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  children,
}: {
  children: React.ReactElement<{
    onClick?: (event: React.MouseEvent) => void;
    ref?: React.Ref<HTMLElement>;
  }>;
}) {
  const { open, setOpen, triggerRef } = usePopoverContext();
  const originalOnClick = children.props.onClick;
  const originalRef = children.props.ref;

  return React.cloneElement(children, {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      assignRef(originalRef, node);
    },
    onClick: (event: React.MouseEvent) => {
      if (typeof originalOnClick === "function") {
        originalOnClick(event);
      }
      setOpen(!open);
    },
  });
}

export function PopoverContent({
  children,
  className,
  align = "center",
  side = "bottom",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
}) {
  const { open, triggerRef, contentRef } = usePopoverContext();
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 9999,
    visibility: "hidden",
  });

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open || !triggerRef.current || !contentRef.current) {
      return;
    }

    const offset = 8;
    const viewportPadding = 8;

    const updatePosition = () => {
      if (!triggerRef.current || !contentRef.current) {
        return;
      }

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left =
        align === "start"
          ? triggerRect.left
          : align === "end"
            ? triggerRect.right - contentRect.width
            : triggerRect.left + (triggerRect.width - contentRect.width) / 2;

      left = Math.max(
        viewportPadding,
        Math.min(left, viewportWidth - contentRect.width - viewportPadding),
      );

      const bottomTop = triggerRect.bottom + offset;
      const topTop = triggerRect.top - contentRect.height - offset;
      const shouldPlaceOnTop =
        side === "top"
          ? topTop >= viewportPadding ||
            bottomTop + contentRect.height > viewportHeight - viewportPadding
          : bottomTop + contentRect.height > viewportHeight - viewportPadding &&
            topTop >= viewportPadding;

      let top = shouldPlaceOnTop ? topTop : bottomTop;

      top = Math.max(
        viewportPadding,
        Math.min(top, viewportHeight - contentRect.height - viewportPadding),
      );

      setPosition({
        position: "fixed",
        top,
        left,
        zIndex: 9999,
        visibility: "visible",
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, open, side, triggerRef]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      ref={contentRef}
      style={position}
      className={joinClassNames(
        "z-[9999]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
