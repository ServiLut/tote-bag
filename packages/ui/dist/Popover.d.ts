import * as React from "react";
export declare function Popover({ open: controlledOpen, onOpenChange, children, }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function PopoverTrigger({ children, }: {
    children: React.ReactElement<{
        onClick?: (event: React.MouseEvent) => void;
    }>;
}): React.ReactElement<{
    onClick?: (event: React.MouseEvent) => void;
}, string | React.JSXElementConstructor<any>>;
export declare function PopoverContent({ children, className, align, side, }: {
    children: React.ReactNode;
    className?: string;
    align?: "start" | "center" | "end";
    side?: "top" | "bottom";
}): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=Popover.d.ts.map