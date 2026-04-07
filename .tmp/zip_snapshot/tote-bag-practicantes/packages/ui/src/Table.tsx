import * as React from "react";

export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto w-full">
      <table className={`w-full text-sm text-left border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <thead className={`bg-base/50 text-muted border-b border-theme ${className}`}>
      {children}
    </thead>
  );
}

export function TableRow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={`border-b border-theme/50 last:border-0 hover:bg-base/20 transition-colors ${className}`}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 font-black text-[10px] uppercase tracking-widest text-muted ${className}`}>
      {children}
    </th>
  );
}

export function TableBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <tbody className={`divide-y divide-theme/30 ${className}`}>
      {children}
    </tbody>
  );
}

export function TableCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 font-medium text-primary ${className}`}>
      {children}
    </td>
  );
}
