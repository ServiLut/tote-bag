import * as React from "react";

export interface InputGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "prefix"> {
  children: React.ReactNode;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export function InputGroup({
  children,
  prefix,
  suffix,
  className = "",
  ...props
}: InputGroupProps) {
  return (
    <div className={className} {...props}>
      {prefix}
      {children}
      {suffix}
    </div>
  );
}

InputGroup.displayName = "InputGroup";
