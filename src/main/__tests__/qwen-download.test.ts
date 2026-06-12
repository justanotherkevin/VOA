/// <reference types="vitest/globals" />

// Integration test: verifies Qwen model downloads to disk and runs inference.
// Uses the standard @huggingface/transformers Node.js build (same as production).
// Run via: npm run test:qwen
// First run: 5–15 min (downloads ~900 MB model_quantized.onnx).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MODEL = 'onnx-community/Qwen2.5-1.5B-Instruct';

// Mirror the chat template helpers from structured-summarizer-process.ts.
function formatChatML(userContent: string): string {
  return `<|im_start|>user\n${userContent}<|im_end|>\n<|im_start|>assistant\n`;
}
function extractAssistantReply(generated: string): string {
  const marker = '<|im_start|>assistant\n';
  const idx = generated.lastIndexOf(marker);
  if (idx < 0) return generated.trim();
  return generated.slice(idx + marker.length).replace(/<\|im_end\|>[\s\S]*$/, '').trim();
}

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qwen-test-'));
  console.log(`[Qwen test] cache dir: ${tmpDir}`);
});

afterAll(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    console.log(`[Qwen test] cleaned up ${tmpDir}`);
  }
});

describe('Qwen model download + initialization (Node.js build)', () => {
  it('downloads model to disk and runs a smoke-test prompt', async () => {
    const progressEvents: Array<{ status: string; file?: string; progress?: number }> = [];

    const { pipeline, env } = await import('@huggingface/transformers');

    // Redirect to isolated temp dir — never pollute system cache.
    env.cacheDir = tmpDir;

    const pipe = await pipeline('text-generation', MODEL, {
      dtype: 'q8',
      progress_callback: (d: any) => {
        progressEvents.push({ status: d.status, file: d.file, progress: d.progress });
        const pct = typeof d.progress === 'number' ? ` ${Math.round(d.progress)}%` : '';
        console.log(`[Qwen] ${d.status}${d.file ? ` ${d.file}` : ''}${pct}`);
      },
    });

    expect(pipe).toBeDefined();
    expect(progressEvents.length).toBeGreaterThan(0);

    // Confirm model file was downloaded (not just the tokenizer).
    const onnxEvents = progressEvents.filter((e) => e.file?.includes('model'));
    expect(onnxEvents.length).toBeGreaterThan(0);

    // Smoke-test: ChatML format + response extraction (mirrors production code).
    const formattedInput = formatChatML('Say the word OK.');
    const output = await (pipe as any)(formattedInput, { max_new_tokens: 16, do_sample: false });
    const text = extractAssistantReply(output[0]?.generated_text ?? '');

    expect(text.length).toBeGreaterThan(0);
    console.log(`[Qwen] smoke-test response: "${text}"`);
  });
});
