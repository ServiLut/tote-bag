import * as React from "react";
export interface InputGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
    children: React.ReactNode;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
}
export declare function InputGroup({ children, prefix, suffix, className, ...props }: InputGroupProps): import("react/jsx-runtime").JSX.Element;
export declare namespace InputGroup {
    var displayName: string;
}
//# sourceMappingURL=InputGroup.d.ts.map