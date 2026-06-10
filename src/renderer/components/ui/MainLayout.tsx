import React from 'react';
import Sidebar, { type AppStatus } from '@/renderer/components/ui/Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  status?: AppStatus;
}

export default function MainLayout({ children, status }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-[#111] overflow-hidden">
      <Sidebar status={status} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
