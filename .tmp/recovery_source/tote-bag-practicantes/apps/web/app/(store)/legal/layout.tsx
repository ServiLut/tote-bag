'use client';

import React from 'react';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface">
      <main className="flex-grow container mx-auto px-4 py-12 max-w-4xl">
        {children}
      </main>
    </div>
  );
}
