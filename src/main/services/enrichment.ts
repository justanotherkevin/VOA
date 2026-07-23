import structuredSummarizerService, {
  checkConnection,
} from '@/main/pipeline/structured-summarizer';
import {
  updateMeeting,
  getMeetingById,
  getLMStudioPreferences,
} from '@/main/store';
import { getMainWindow } from '@/main/state/volatile';
import { CHANNELS } from '@/lib/ipc-channels';
import { log } from 'electron-log';
import { showNotification } from '@/main/notification-window';

const LM_STUDIO_DEFAULT_PORT = '1234';
const OLLAMA_DEFAULT_PORT = '11434';

function getProviderName(
  baseUrl: string,
): 'LM Studio' | 'Ollama' | 'inference server' {
  try {
    const port = new URL(baseUrl).port;
    if (port === LM_STUDIO_DEFAULT_PORT) return 'LM Studio';
    if (port === OLLAMA_DEFAULT_PORT) return 'Ollama';
  } catch {}
  return 'inference server';
}

function getConnectivityNotification(baseUrl: string): {
  title: string;
  message: string;
} {
  const provider = getProviderName(baseUrl);
  if (provider === 'LM Studio') {
    return {
      title: 'LM Studio unreachable',
      message: 'Start LM Studio and load a model before generating summaries.',
    };
  }
  if (provider === 'Ollama') {
    return {
      title: 'Ollama unreachable',
      message: 'Run `ollama serve` before generating summaries.',
    };
  }
  return {
    title: 'Inference server unreachable',
    message: `Could not connect to ${baseUrl}`,
  };
}

class EnrichmentService {
  private async getStructuredSummary(
    text: string,
    type: 'meeting' | 'dictation',
  ) {
    try {
      const result =
        type === 'meeting'
          ? await structuredSummarizerService.summarizeChunked(text)
          : await structuredSummarizerService.summarize(text);
      log('[EnrichmentService] Structured summarization complete');
      return result;
    } catch (error) {
      log('[EnrichmentService] Error summarizing text:', error);
      return null;
    }
  }

  private async enrichMeeting(
    meetingId: string,
    text: string,
    type: 'meeting' | 'dictation',
    baseUrl: string,
  ): Promise<void> {
    const result = await this.getStructuredSummary(text, type);
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
      if (!result) {
        const provider = getProviderName(baseUrl);
        showNotification({
          title: `Invalid response from ${provider}`,
          message:
            'The model returned an unexpected format. Check that your model supports JSON output.',
          duration: 6000,
        });
      }
    }
  }

  async triggerEnrichment(meetingId: string): Promise<void> {
    const meeting = getMeetingById(meetingId);
    if (!meeting?.transcript) return;

    const { baseUrl } = getLMStudioPreferences();
    const reachable = await checkConnection(baseUrl);
    if (!reachable) {
      const updated = updateMeeting(meetingId, { summaryStatus: 'failed' });
      if (updated) {
        getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
      }
      const { title, message } = getConnectivityNotification(baseUrl);
      showNotification({ title, message, duration: 6000 });
      log('[EnrichmentService] Connectivity check failed for', baseUrl);
      return;
    }

    return this.enrichMeeting(
      meetingId,
      meeting.transcript,
      meeting.type,
      baseUrl,
    );
  }
}

export default new EnrichmentService();
