import structuredSummarizerService, {
  checkConnection,
} from '@/main/pipeline/structured-summarizer';
import { SummarizerProviderFactory } from '@/main/pipeline/summarizer-provider';
import llamaSummarizer, {
  BUILTIN_MODEL_PATH,
} from '@/main/pipeline/llama-summarizer';
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

function getBuiltinNotReadyNotification(): { title: string; message: string } {
  return {
    title: 'Built-in model not ready',
    // No downloader yet (later phase) — for now "not ready" only ever
    // means "not yet initialized in this session".
    message: 'The built-in summarization model has not finished loading yet.',
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
    providerLabel: string,
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
        showNotification({
          title: `Invalid response from ${providerLabel}`,
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

    const provider = SummarizerProviderFactory.resolve();

    if (provider === 'builtin') {
      // No downloader yet (later phase) — initialize() legitimately fails
      // today since BUILTIN_MODEL_PATH points nowhere real. That failure is
      // what "not ready" means; readiness isn't knowable without actually
      // attempting the load (getModelInfo().isInitialized never flips true
      // on its own — nothing else calls initialize()).
      try {
        await llamaSummarizer.initialize(BUILTIN_MODEL_PATH);
      } catch (error) {
        log('[EnrichmentService] Builtin summarizer not ready:', error);
        const updated = updateMeeting(meetingId, { summaryStatus: 'failed' });
        if (updated) {
          getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
        }
        const { title, message } = getBuiltinNotReadyNotification();
        showNotification({ title, message, duration: 6000 });
        return;
      }
      return this.enrichMeeting(
        meetingId,
        meeting.transcript,
        meeting.type,
        'the built-in model',
      );
    }

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
      getProviderName(baseUrl),
    );
  }
}

export default new EnrichmentService();
