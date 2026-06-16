import structuredSummarizerService from '@/main/pipeline/structured-summarizer';
import { updateMeeting, getMeetingById } from '@/main/store';
import { getMainWindow } from '@/main/state/volatile';
import { CHANNELS } from '@/lib/ipc-channels';
import { log } from 'electron-log';

class EnrichmentService {
  private async getStructuredSummary(text: string, isMeeting: boolean) {
    const win = getMainWindow();
    try {
      const result = isMeeting
        ? await structuredSummarizerService.summarizeChunked(text)
        : await structuredSummarizerService.summarize(text);
      log('[EnrichmentService] Structured summarization complete');
      win?.webContents.send(CHANNELS.SUMMARIZER.READY, {});
      return result;
    } catch (error) {
      log('[EnrichmentService] Error summarizing text:', error);
      try {
        win?.webContents.send(CHANNELS.SUMMARIZER.ERROR, String(error));
      } catch {}
      return null;
    }
  }

  private async enrichMeeting(meetingId: string, text: string, isMeeting: boolean): Promise<void> {
    const result = await this.getStructuredSummary(text, isMeeting);
    log('[EnrichmentService] Result:', JSON.stringify(result));
    const updated = updateMeeting(
      meetingId,
      result
        ? {
            summary: result.summary,
            decisions: result.decisions,
            topics: result.topics,
            actionItems: result.actionItems,
            summaryStatus: 'ready',
          }
        : { summary: '', summaryStatus: 'failed' },
    );
    if (updated) {
      getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
      log(
        '[EnrichmentService] Meeting enrichment complete:',
        meetingId,
        '| status:',
        updated.summaryStatus,
      );
    }
  }

  async triggerEnrichment(meetingId: string): Promise<void> {
    const meeting = getMeetingById(meetingId);
    if (!meeting?.transcript) return;
    return this.enrichMeeting(meetingId, meeting.transcript, meeting.isMeeting);
  }
}

export default new EnrichmentService();
