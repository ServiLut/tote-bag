import * as React from "react";

export function Badge({ children, className = "", variant = "default" }: { children: React.ReactNode; className?: string; variant?: "default" | "outline" | "secondary" }) {
  const variants = {
    default: "bg-primary text-base-color",
    secondary: "bg-secondary text-white",
    outline: "border border-theme text-primary",
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
