// Runs as a utilityProcess.fork() child — isolated from Electron's renderer/main
// process heap. Communication uses process.parentPort (MessagePort).
//
// Uses the standard @huggingface/transformers Node.js build, which writes model
// files to disk (IS_FS_AVAILABLE = true, useFSCache = true). This lets the model
// persist across app restarts so Settings can detect it via model-cache.ts.

let pipe: any = null;
let config: {
  modelName: string;
  promptTemplate: string;
  maxChars: number;
  cacheDir: string;
} | null = null;

// Qwen2.5 uses ChatML format.
function formatChatML(systemPrompt: string, userContent: string): string {
  return `<|im_start|>user\n${systemPrompt}${userContent}<|im_end|>\n<|im_start|>assistant\n`;
}

function extractAssistantReply(generated: string): string {
  const marker = '<|im_start|>assistant\n';
  const idx = generated.lastIndexOf(marker);
  if (idx < 0) return generated.trim();
  return generated
    .slice(idx + marker.length)
    .replace(/<\|im_end\|>[\s\S]*$/, '')
    .trim();
}

process.parentPort.on('message', async ({ data: msg }: { data: any }) => {
  if (msg.type === 'config') {
    config = msg as typeof config;
    return;
  }

  if (msg.type === 'initialize') {
    if (!config) {
      process.parentPort.postMessage({ type: 'init-error', message: 'config not received before initialize' });
      return;
    }
    try {
      const { pipeline, env } = await import('@huggingface/transformers');

      // Redirect the HuggingFace cache to the standard hub path so model-cache.ts
      // can detect the downloaded model and Settings shows "Delete" after download.
      env.cacheDir = config.cacheDir;

      // dtype 'q8' → model_quantized.onnx (INT8, ~900MB).
      // 'q4' downloads model_q4.onnx (1.7GB) which causes SIGTRAP in onnxruntime-node.
      pipe = await pipeline('text-generation', config.modelName, {
        dtype: 'q8',
        progress_callback: (d: any) => {
          console.log(`[Qwen] ${d.status}${d.file ? ` ${d.file}` : ''}${typeof d.progress === 'number' ? ` ${Math.round(d.progress)}%` : ''}`);
          process.parentPort.postMessage({ type: 'progress', data: d });
        },
      });
      process.parentPort.postMessage({ type: 'initialized' });
    } catch (err) {
      process.parentPort.postMessage({ type: 'init-error', message: String(err) });
    }
    return;
  }

  if (msg.type === 'summarize') {
    if (!pipe || !config) {
      process.parentPort.postMessage({ type: 'summarize-error', id: msg.id, message: 'pipeline not initialized' });
      return;
    }
    try {
      const transcript = (msg.text ?? '').slice(0, config.maxChars);
      const formattedInput = formatChatML(config.promptTemplate, transcript);
      const output = await pipe(formattedInput, { max_new_tokens: 512, do_sample: false });
      const generated: string = output[0]?.generated_text ?? '';
      const responseText = extractAssistantReply(generated);
      process.parentPort.postMessage({ type: 'summarize-result', id: msg.id, responseText });
    } catch (err) {
      process.parentPort.postMessage({ type: 'summarize-error', id: msg.id, message: String(err) });
    }
  }
});
