import * as React from "react";

export interface InputGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
  prefix?: React.ReactNode;
}

export function InputGroup({
  prefix,
  className,
  children,
  ...props
}: InputGroupProps) {
  return (
    <div className={className} {...props}>
      {prefix ? <span>{prefix}</span> : null}
      {children}
    </div>
  );
}

InputGroup.displayName = "InputGroup";
