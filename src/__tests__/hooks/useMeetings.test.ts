import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMeetings } from '@/renderer/hooks/useMeetings';
import { attachGlobalElectronMock, resetElectronMockCallbacks, triggerMeetingSaved } from '@/testing/electronMocks';

attachGlobalElectronMock();

const makeMeeting = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'meeting-1',
  title: 'Test Meeting',
  startedAt: Date.now(),
  endedAt: Date.now() + 60000,
  durationMs: 60000,
  transcript: 'Hello world',
  chunks: [],
  summary: '',
  summaryStatus: 'pending' as const,
  decisions: [],
  topics: [],
  actionItems: [],
  audioSource: 'mic' as const,
  participants: [],
  tags: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetElectronMockCallbacks();
  (window.electronAPI.meetings.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe('useMeetings', () => {
  it('loads meetings on mount', async () => {
    const meeting = makeMeeting();
    (window.electronAPI.meetings.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([meeting]);

    const { result } = renderHook(() => useMeetings());

    await waitFor(() => {
      expect(result.current.meetings).toHaveLength(1);
    });
    expect(result.current.meetings[0].id).toBe('meeting-1');
  });

  it('adds and auto-selects a genuinely new meeting from meetings:saved', async () => {
    const { result } = renderHook(() => useMeetings());
    await waitFor(() => expect(result.current.meetings).toHaveLength(0));

    const meeting = makeMeeting({ summaryStatus: 'pending' });
    act(() => { triggerMeetingSaved(meeting); });

    expect(result.current.meetings).toHaveLength(1);
    expect(result.current.selectedId).toBe('meeting-1');
  });

  it('updates an existing meeting without changing selectedId when summary arrives', async () => {
    const meeting = makeMeeting({ summaryStatus: 'pending' });
    (window.electronAPI.meetings.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([meeting]);

    const { result } = renderHook(() => useMeetings());
    await waitFor(() => expect(result.current.meetings).toHaveLength(1));

    // User selects a different meeting
    act(() => { result.current.setSelectedId(null); });
    expect(result.current.selectedId).toBeNull();

    // Background summary arrives for the existing meeting
    const updated = { ...meeting, summary: 'A concise summary.', summaryStatus: 'ready' };
    act(() => { triggerMeetingSaved(updated); });

    // List updated with new summary
    expect(result.current.meetings[0].summary).toBe('A concise summary.');
    // Selected ID NOT changed — user's selection preserved
    expect(result.current.selectedId).toBeNull();
  });

  it('replaces duplicate and moves updated meeting to front of list', async () => {
    const older = makeMeeting({ id: 'old', startedAt: 1000 });
    const newer = makeMeeting({ id: 'new', startedAt: 2000 });
    (window.electronAPI.meetings.getAll as ReturnType<typeof vi.fn>).mockResolvedValue([newer, older]);

    const { result } = renderHook(() => useMeetings());
    await waitFor(() => expect(result.current.meetings).toHaveLength(2));

    // Summary enrichment fires for the older meeting
    const enriched = { ...older, summary: 'Enriched.' };
    act(() => { triggerMeetingSaved(enriched); });

    expect(result.current.meetings).toHaveLength(2);
    expect(result.current.meetings[0].id).toBe('old');
    expect(result.current.meetings[0].summary).toBe('Enriched.');
  });
});
