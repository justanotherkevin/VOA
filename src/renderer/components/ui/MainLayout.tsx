import React from 'react';
import Sidebar, { type AppStatus } from '@/renderer/components/ui/Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/renderer/components/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  status?: AppStatus;
  onNewRecording: () => void;
}

export default function MainLayout({
  children,
  status,
  onNewRecording,
}: MainLayoutProps) {
  return (
    <SidebarProvider defaultOpen className="h-screen bg-[#111] overflow-hidden">
      <Sidebar status={status} onNewRecording={onNewRecording} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center h-10 px-2 shrink-0 border-b border-sidebar-border">
          <SidebarTrigger />
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </SidebarProvider>
  );
}
