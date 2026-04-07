import * as React from "react";
export interface PopoverProps {
    children: React.ReactNode;
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}
export declare function Popover({ children, open: openProp, defaultOpen, onOpenChange, }: PopoverProps): import("react/jsx-runtime").JSX.Element;
export declare namespace Popover {
    var displayName: string;
}
export interface PopoverTriggerProps {
    children: React.ReactElement<React.HTMLAttributes<HTMLElement> & {
        ref?: React.Ref<HTMLElement>;
    }>;
}
export declare function PopoverTrigger({ children }: PopoverTriggerProps): React.ReactElement<React.HTMLAttributes<HTMLElement> & {
    ref?: React.Ref<HTMLElement>;
}, string | React.JSXElementConstructor<any>>;
export declare namespace PopoverTrigger {
    var displayName: string;
}
export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    side?: "top" | "bottom";
    align?: "start" | "center" | "end";
    sideOffset?: number;
    collisionPadding?: number;
}
export declare function PopoverContent({ children, side, align, sideOffset, collisionPadding, style, ...props }: PopoverContentProps): React.ReactPortal | null;
export declare namespace PopoverContent {
    var displayName: string;
}
//# sourceMappingURL=Popover.d.ts.map