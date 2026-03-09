import * as React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-base-color opacity-10 rounded ${className}`} />
  );
}
