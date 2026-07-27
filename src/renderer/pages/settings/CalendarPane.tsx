import { CalendarClock, Info } from 'lucide-react';
import { PaneHeader, SectionLabel, SettingRow } from './shared';

interface CalendarPrefs {
  feedUrl: string;
}

interface CalendarTestResult {
  success: boolean;
  eventCount?: number;
  message?: string;
}

export function CalendarPane({
  calendarPrefs,
  handleCalendarFeedUrlChange,
  saveCalendarPrefs,
  calendarTestResult,
  calendarTesting,
  handleTestCalendarConnection,
}: {
  calendarPrefs: CalendarPrefs;
  handleCalendarFeedUrlChange: (value: string) => Promise<void>;
  saveCalendarPrefs: () => Promise<void>;
  calendarTestResult: CalendarTestResult | null;
  calendarTesting: boolean;
  handleTestCalendarConnection: () => Promise<void>;
}) {
  return (
    <div className="s-pane" data-testid="settings-pane-calendar">
      <PaneHeader
        title="Calendar"
        description="Automatically fill in meeting participants by matching recordings to your calendar."
      />

      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Feed</SectionLabel>
        <div className="s-card-rows">
          <SettingRow
            icon={CalendarClock}
            title="Private calendar feed URL"
            description={
              <>
                <a
                  href="https://calendar.google.com/calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--s-accent)',
                    textDecoration: 'underline',
                  }}
                >
                  Google Calendar
                </a>
                : Settings → Select your calendar → Search for "iCal" → "Secret
                address in iCal format". Click the copy button and paste the
                copied text in the input below. iCloud and Outlook.com have an
                equivalent private/secret ICS address in their calendar sharing
                settings.
              </>
            }
          />
          <div className="s-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                data-testid="calendar-feed-url-input"
                value={calendarPrefs.feedUrl}
                onChange={(e) => handleCalendarFeedUrlChange(e.target.value)}
                onBlur={saveCalendarPrefs}
                placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics"
                style={{
                  width: '100%',
                  background: 'var(--s-field)',
                  border: '0.5px solid var(--s-field-line)',
                  borderRadius: 7,
                  padding: '4px 9px',
                  fontSize: 12.5,
                  color: 'var(--s-text)',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <div className="s-row">
            <div
              data-testid="calendar-test-result"
              style={{ flex: 1, minWidth: 0 }}
            >
              {calendarTestResult !== null &&
                (calendarTestResult.success ? (
                  <span className="s-pill s-pill-good">
                    <span className="s-pdot" />
                    {`Connected — ${calendarTestResult.eventCount ?? 0} event${(calendarTestResult.eventCount ?? 0) !== 1 ? 's' : ''} found`}
                  </span>
                ) : (
                  <span className="s-pill s-pill-danger">
                    <span className="s-pdot" />
                    {calendarTestResult.message ??
                      'Unreachable — check the feed URL'}
                  </span>
                ))}
            </div>
            <button
              className="s-btn"
              data-testid="calendar-test-connection-button"
              onClick={handleTestCalendarConnection}
              disabled={calendarTesting || !calendarPrefs.feedUrl}
            >
              {calendarTesting ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>
        <div className="s-note">
          <Info size={13} />
          Only used to look up attendees for a recording's time window — never
          written to. Stored encrypted on this device.
        </div>
      </div>
    </div>
  );
}
