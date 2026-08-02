import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AudioLines,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Keyboard,
  type LucideIcon,
  LockKeyhole,
  Mic,
  Rocket,
  Settings as SettingsIcon,
  Settings2,
  ShieldCheck,
  Sparkles,
  ChevronDown,
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

// Never true in a packaged build — matches the guard already used by
// src/renderer/testing/TestHooks.ts for other dev-only affordances.
const isDev = process.env.NODE_ENV !== 'production';

// Sample payloads for previewing the notification overlay window from
// inside the main app, without needing a real recording/meeting/calendar
// match to trigger each state.
const NOTIFICATION_PREVIEW_STATES: Array<{
  label: string;
  payload: Record<string, unknown>;
}> = [
  {
    label: 'In meeting',
    payload: {
      state: 'in-meeting',
      title: 'Meeting detected',
      message: 'Weekly Sync — 2:00 PM',
      isMeeting: true,
    },
  },
  {
    label: 'Recording',
    payload: {
      state: 'recording',
      title: 'Recording',
      message: 'Speak now...',
      activeWindow: { title: 'Zoom Meeting', owner: { name: 'zoom.us' } },
    },
  },
  {
    label: 'Recording stopped',
    payload: {
      state: 'recording-stopped',
      title: 'Recording Stopped',
      message: 'Processing your audio...',
    },
  },
  {
    label: 'Processing',
    payload: {
      state: 'processing',
      title: 'Processing',
      message: 'Transcribing your audio...',
    },
  },
  {
    label: 'Done',
    payload: {
      state: 'done',
      title: 'Done',
      message: 'Transcript ready',
    },
  },
  {
    label: 'Calendar match',
    payload: {
      state: 'calendar-match',
      title: 'Which meeting?',
      message: '',
      calendarMatches: [
        { id: 'evt-1', title: 'Weekly Sync — 2:00 PM' },
        { id: 'evt-2', title: '1:1 with Sam — 2:15 PM' },
      ],
    },
  },
];

// One collapsible row nested inside the "Development" sidebar group — e.g.
// "Notification window" below. Add sibling <DevSubgroup>s here for other
// dev-testing areas as they show up; each gets its own collapsed-by-default
// disclosure so the group doesn't get noisy as more are added.
function DevSubgroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Collapsible className="group/dev-subgroup">
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
        <ChevronRight className="size-3 shrink-0 transition-transform duration-200 group-data-[state=open]/dev-subgroup:rotate-90" />
        <Icon className="size-3.5 shrink-0" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pl-5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

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
            <img src={appIcon} alt="App icon" className="w-6 h-6" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar ${color} ${
                pulse ? 'animate-pulse' : ''
              }`}
            />
          </div>
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

        {isDev && (
          <Collapsible className="group/collapsible">
            <SidebarGroup data-testid="dev-notification-preview">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center">
                  <FlaskConical className="mr-2" />
                  Development
                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <div className="flex flex-col gap-0.5 px-1">
                    <DevSubgroup label="Notification window" icon={Bell}>
                      <div className="flex flex-col gap-0.5">
                        <div className="grid grid-cols-2 gap-1">
                          {NOTIFICATION_PREVIEW_STATES.map(
                            ({ label, payload }) => (
                              <button
                                key={payload.state as string}
                                type="button"
                                data-testid={`dev-notification-preview-${payload.state}`}
                                onClick={() =>
                                  window.electronAPI.notifications.updateState(
                                    payload,
                                  )
                                }
                                className="rounded-md border border-sidebar-border px-2 py-1 text-left text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              >
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                        <button
                          type="button"
                          data-testid="dev-notification-preview-hide"
                          onClick={() =>
                            window.electronAPI.notifications.hide()
                          }
                          className="mt-1 rounded-md border border-sidebar-border px-2 py-1 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        >
                          Hide notification
                        </button>
                      </div>
                    </DevSubgroup>
                    <DevSubgroup label="Onboarding flow" icon={Rocket}>
                      <button
                        type="button"
                        data-testid="dev-open-onboarding"
                        onClick={() => navigate('/onboarding')}
                        className="w-full rounded-md border border-sidebar-border px-2 py-1 text-left text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      >
                        Open onboarding
                      </button>
                    </DevSubgroup>
                  </div>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
