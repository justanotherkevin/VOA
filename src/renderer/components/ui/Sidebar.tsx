import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AudioLines,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Keyboard,
  type LucideIcon,
  LockKeyhole,
  Mic,
  Settings as SettingsIcon,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import appIcon from '../../../../assets/icons/64x64.png';
import { useMeetingsContext } from '@/renderer/hooks/useMeetingsContext';
import { MeetingList } from '@/renderer/components/ui/MeetingList';
import { useSettingsNavContext } from '@/renderer/hooks/useSettingsNavContext';
import type { SettingsPaneId as SettingsPaneIdType } from '@/renderer/contexts/SettingsNavContext';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/collapsible';
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/renderer/components/sidebar';

export type AppStatus = 'ready' | 'recording' | 'processing';

const STATUS_CONFIG: Record<
  AppStatus,
  { color: string; pulse: boolean; label: string }
> = {
  ready: { color: 'bg-green-500', pulse: false, label: '🟢 Ready' },
  recording: { color: 'bg-red-500', pulse: true, label: '🔴 Recording' },
  processing: { color: 'bg-yellow-400', pulse: true, label: '🟡 Processing' },
};

const SETTINGS_NAV_ITEMS: Array<{
  id: SettingsPaneIdType;
  label: string;
  icon: LucideIcon;
  bg: string;
}> = [
  { id: 'general', label: 'General', icon: Settings2, bg: '#8a8f98' },
  {
    id: 'transcription',
    label: 'Transcription',
    icon: Sparkles,
    bg: '#7c5cff',
  },
  { id: 'recording', label: 'Recording', icon: CircleDot, bg: '#ef4d4d' },
  { id: 'audio', label: 'Audio', icon: AudioLines, bg: '#2f6bed' },
  {
    id: 'privacy',
    label: 'Privacy & Storage',
    icon: ShieldCheck,
    bg: '#1faa4d',
  },
  { id: 'permissions', label: 'Permissions', icon: LockKeyhole, bg: '#14b3c2' },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, bg: '#f0902e' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, bg: '#6a5cf0' },
];

// Mirrors the section grouping the old standalone Settings-page nav used:
// two ungrouped items, then a "CAPTURE" group, a "TRUST" group, then Shortcuts alone.
const SETTINGS_NAV_GROUPS: Array<{
  heading: string | null;
  items: typeof SETTINGS_NAV_ITEMS;
}> = [
  { heading: null, items: SETTINGS_NAV_ITEMS.slice(0, 2) },
  { heading: 'Capture', items: SETTINGS_NAV_ITEMS.slice(2, 4) },
  { heading: 'Trust', items: SETTINGS_NAV_ITEMS.slice(4, 6) },
  { heading: null, items: SETTINGS_NAV_ITEMS.slice(6) },
];

interface SidebarProps {
  status?: AppStatus;
  onNewRecording: () => void;
}

export default function Sidebar({
  status = 'ready',
  onNewRecording,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  const { color, pulse, label } = STATUS_CONFIG[status];
  const { meetings, selectedId, setSelectedId } = useMeetingsContext();
  const { activePane, goPane } = useSettingsNavContext();

  // Collapsible open state is deliberately separate from navigation: clicking
  // the row always navigates *and* opens the list (never toggles closed) —
  // only the chevron button toggles collapse. A combined nav+toggle button
  // used to flip closed on every repeat visit, which both surprised users
  // and made e2e flows that revisit a section (e.g. Settings) flaky.
  const [meetingsOpen, setMeetingsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(isActive('/settings'));

  const selectMeeting = (id: string) => {
    setSelectedId(id);
    if (location.pathname !== '/') navigate('/');
  };

  const selectPane = (pane: SettingsPaneIdType) => {
    goPane(pane);
    if (location.pathname !== '/settings') navigate('/settings');
  };

  return (
    <SidebarPrimitive collapsible="icon" className="h-screen">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1">
          <div className="relative shrink-0" title={label}>
            <img src={appIcon} alt="App icon" className="w-8 h-8 rounded-lg" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar ${color} ${
                pulse ? 'animate-pulse' : ''
              }`}
            />
          </div>
          <span className="text-sm font-medium truncate group-data-[collapsible=icon]:hidden">
            {label}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible
          open={meetingsOpen}
          onOpenChange={setMeetingsOpen}
          className="group/meetings-collapsible"
        >
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <button
                type="button"
                title="Meetings"
                data-testid="nav-meetings-button"
                className="w-full cursor-pointer"
                onClick={() => {
                  navigate('/');
                  setMeetingsOpen(true);
                }}
              >
                <Mic className="mr-2" />
                Meetings
                <span className="ml-auto mr-5 tabular-nums text-sidebar-foreground/70">
                  {meetings.length}
                </span>
              </button>
            </SidebarGroupLabel>
            <CollapsibleTrigger asChild>
              <SidebarGroupAction title="Toggle meetings list">
                <ChevronRight className="transition-transform duration-200 group-data-[state=open]/meetings-collapsible:rotate-90" />
              </SidebarGroupAction>
            </CollapsibleTrigger>
            <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
              <SidebarGroupContent>
                <MeetingList
                  meetings={meetings}
                  selectedId={selectedId}
                  onSelect={selectMeeting}
                  onNewRecording={onNewRecording}
                />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <Collapsible
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          className="group/settings-collapsible"
        >
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                title="Settings"
                data-testid="nav-setting-button"
                isActive={isActive('/settings')}
                onClick={() => {
                  navigate('/settings');
                  setSettingsOpen(true);
                }}
              >
                <SettingsIcon />
                <span>Settings</span>
              </SidebarMenuButton>
              <CollapsibleTrigger asChild>
                <SidebarMenuAction className="group-data-[collapsible=icon]:hidden">
                  <ChevronRight className="transition-transform duration-200 group-data-[state=open]/settings-collapsible:rotate-90" />
                </SidebarMenuAction>
              </CollapsibleTrigger>
              <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                <div className="max-h-[60vh] overflow-y-auto px-1 pt-1 pb-2 flex flex-col gap-0.5">
                  {SETTINGS_NAV_GROUPS.map((group, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <div className="my-1.5 h-px bg-sidebar-border" />
                      )}
                      {group.heading && (
                        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                          {group.heading}
                        </div>
                      )}
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectPane(item.id)}
                          className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            activePane === item.id
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          }`}
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                            style={{ background: item.bg, color: '#fff' }}
                          >
                            <item.icon size={12} />
                          </span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </CollapsibleContent>
            </SidebarMenuItem>
          </SidebarMenu>
        </Collapsible>
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
