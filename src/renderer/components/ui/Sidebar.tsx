import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Settings } from 'lucide-react';

export type AppStatus = 'ready' | 'recording' | 'processing';

const STATUS_CONFIG: Record<
  AppStatus,
  { color: string; pulse: boolean; label: string }
> = {
  ready: { color: 'bg-green-500', pulse: false, label: '🟢 Ready' },
  recording: { color: 'bg-red-500', pulse: true, label: '🔴 Recording' },
  processing: { color: 'bg-yellow-400', pulse: true, label: '🟡 Processing' },
};

interface SidebarProps {
  status?: AppStatus;
}

export default function Sidebar({ status = 'ready' }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  const { color, pulse, label } = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col w-14 bg-[#111] text-white h-screen border-r border-[#222] items-center py-4">
      {/* App icon with status badge */}
      <div className="mb-6 relative group" title={label}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Mic size={16} />
        </div>

        {/* Status dot — bottom-right corner, slightly outside the icon */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111] ${color} ${
            pulse ? 'animate-pulse' : ''
          }`}
        />

        {/* Hover tooltip */}
        <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#2a2a2a] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
          {label}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center gap-2">
        <NavButton
          icon={<Mic size={18} />}
          label="Meetings"
          active={isActive('/')}
          onClick={() => navigate('/')}
        />
      </nav>

      {/* Bottom */}
      <NavButton
        icon={<Settings size={18} />}
        label="Settings"
        testId="nav-setting-button"
        active={isActive('/settings')}
        onClick={() => navigate('/settings')}
      />
    </div>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
  testId = '',
}: {
  icon: React.ReactNode;
  label: string;
  testId?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      data-testid={testId}
      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e]'
      }`}
    >
      {icon}
    </button>
  );
}
