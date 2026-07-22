import { ipcMain } from 'electron';
import transcriberService from '../services/transcriber';
import { CHANNELS } from '@/lib/ipc-channels';
import { getMeetings, updateMeeting } from '../store';
import { getMainWindow } from '../state/volatile';
import { makeCallbacks, setE2eForceMeeting } from './transcriber';

export function registerTranscriberE2eHandlers() {
  ipcMain.handle('transcriber:e2e-force-meeting', () => {
    setE2eForceMeeting(true);
  });

  // Decode an audio file entirely in the main process and run the full
  // transcribe → endSession pipeline. Avoids renderer-side OfflineAudioContext
  // memory pressure for large files (e.g. city-meeting.mp3 at 11 minutes).
  ipcMain.handle('transcriber:e2e-transcribe-file', async (event, args) => {
    const { filePath } = args as { filePath: string };
    const { readFileSync } = await import('fs');
    const { AudioContext } = await import('node-web-audio-api');

    const fileBuffer = readFileSync(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    ) as ArrayBuffer;

    const ctx = new (AudioContext as any)({ sampleRate: 16000 });
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    const length = audioBuffer.length;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / audioBuffer.numberOfChannels;
      }
    }
    await ctx.close();

    const now = Date.now();
    const callbacks = makeCallbacks(event, 'e2e-transcribe-file');
    transcriberService.beginSession(now, true);
    await transcriberService.transcribe(
      { audio: mono, startedAt: now },
      callbacks,
    );
    await transcriberService.endSession(Date.now(), callbacks);
  });

  // Inject mock Qwen enrichment results directly into the store, bypassing
  // onnxruntime. Needed because onnxruntime-node@1.21 (bundled inside
  // @huggingface/transformers@3.8) crashes with SIGSEGV on ARM64 when the
  // model is loaded via HuggingFace XET streaming (partial model files).
  // This handler lets the E2E test validate the full UI pipeline without
  // depending on the real Qwen model being present or the native lib being stable.
  ipcMain.handle('transcriber:e2e-mock-enrich-meeting', () => {
    const meetings = getMeetings();
    if (meetings.length === 0) return null;
    const meeting = meetings[0];
    const updated = updateMeeting(meeting.id, {
      summary:
        'The city council discussed budget allocations for public works, approved a street lighting contract extension, and reviewed community safety initiatives.',
      decisions: [
        'Approved the 2026 public works budget',
        'Extended the street lighting contract by two years',
      ],
      topics: ['Public works funding', 'Street lighting', 'Community safety'],
      actionItems: [
        {
          text: 'Review street lighting proposals before next meeting',
          done: false,
        },
        { text: 'Prepare Q3 budget report', done: false },
        {
          text: 'Follow up on community safety task force recommendations',
          done: false,
        },
      ],
      summaryStatus: 'ready',
    });
    if (updated) {
      getMainWindow()?.webContents.send(CHANNELS.MEETINGS.SAVED, updated);
    }
    return updated;
  });
}
