import * as React from "react";
export declare function Tabs({ defaultValue, value: controlledValue, onValueChange, children, className, }: {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function TabsList({ children, className, }: {
    children: React.ReactNode;
    className?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function TabsTrigger({ value, children, className, }: {
    value: string;
    children: React.ReactNode;
    className?: string;
}): import("react/jsx-runtime").JSX.Element;
export declare function TabsContent({ value, children, className, }: {
    value: string;
    children: React.ReactNode;
    className?: string;
}): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=Tabs.d.ts.map