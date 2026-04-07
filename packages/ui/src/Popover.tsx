import * as React from "react";

type PopoverContextValue = {
  open: boolean;
  setOpen: (nextOpen: boolean) => void;
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

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, setOpen]);

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div ref={rootRef} className="relative inline-flex">
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  children,
}: {
  children: React.ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
}) {
  const { open, setOpen } = usePopoverContext();
  const originalOnClick = children.props.onClick;

  return React.cloneElement(children, {
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
  const { open } = usePopoverContext();

  if (!open) {
    return null;
  }

  const positionClassName = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  const alignClassName =
    align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";

  return (
    <div
      className={joinClassNames(
        "absolute z-50",
        positionClassName,
        alignClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
