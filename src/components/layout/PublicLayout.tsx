import React from 'react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
interface PublicLayoutProps {
  children: React.ReactNode;
}
export function PublicLayout({
  children
}: PublicLayoutProps) {
  return <div className="min-h-screen bg-[#FDFFFC] flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>;
}