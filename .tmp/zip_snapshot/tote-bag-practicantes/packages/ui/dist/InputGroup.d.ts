import * as React from "react";
export interface InputGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
    prefix?: React.ReactNode;
}
export declare function InputGroup({ prefix, className, children, ...props }: InputGroupProps): import("react/jsx-runtime").JSX.Element;
export declare namespace InputGroup {
    var displayName: string;
}
//# sourceMappingURL=InputGroup.d.ts.map