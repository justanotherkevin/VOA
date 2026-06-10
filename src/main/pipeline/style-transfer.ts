/* eslint-disable camelcase */
import { DEFAULT_MODELS } from '@/lib/Constants';

interface StyleTransferResult {
  original: string;
  formal: string;
}

interface ListFormattingResult {
  original: string;
  formatted: string;
}
// text2text generation docs
class StyleTransferService {
  private pipe: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    // Return immediately if already initialized
    if (this.isInitialized) {
      return Promise.resolve();
    }

    // Start initialization
    this.initializationPromise = (async () => {
      try {
        console.log(
          '[StyleTransfer] Initializing text2text-generation pipeline...',
        );
        const { pipeline } = await import('@xenova/transformers');
        this.pipe = await pipeline(
          'text2text-generation',
          DEFAULT_MODELS.text2text,
        );

        this.isInitialized = true;
        console.log('[StyleTransfer] Pipeline initialized successfully');
      } catch (error) {
        console.error('[StyleTransfer] Failed to initialize pipeline:', error);
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private async _transformText(
    prompt: string,
    options: Record<string, unknown>,
  ): Promise<string> {
    await this.initialize();

    if (!this.pipe) {
      throw new Error('StyleTransfer pipeline not initialized');
    }

    try {
      const result = await this.pipe(prompt, options);
      const outputText = result[0]?.generated_text;
      console.log('[StyleTransfer] Output text:', outputText);

      return outputText;
    } catch (error) {
      console.error('[StyleTransfer] Error transforming text:', error);
      throw error;
    }
  }

  async transformToFormal(text: string): Promise<string> {
    const prompt = `Rewrite the following input test in a professional office tone suitable for business communication, removing slang and informal language: ${text}`;
    const options = {
      max_new_tokens: 1000,
      temperature: 0.3,
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 2,
      do_sample: false,
    };
    return this._transformText(prompt, options);
  }

  async transformToTechnical(text: string): Promise<string> {
    const prompt = `Rewrite the following input test in technical software engineering tone with clear directions and steps: ${text}`;
    const options = {
      max_new_tokens: 2000,
      temperature: 0.3,
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 2,
      do_sample: false,
    };
    return this._transformText(prompt, options);
  }

  async transformToInformal(text: string): Promise<string> {
    const prompt = `Convert this transcribed text to casual style: ${text}`;
    const options = {
      max_new_tokens: 200,
      temperature: 0.9,
      repetition_penalty: 2.0,
      no_repeat_ngram_size: 3,
    };
    return this._transformText(prompt, options);
  }

  async formatAsNumList(text: string): Promise<ListFormattingResult> {
    const prompt = `Extract and number any list items or tasks from this text while preserving the narrative context and procedural steps. Number each item with "1.", "2.", etc. Keep any introductory or concluding statements. Format clearly with items on separate lines:\n\n${text}`;
    const options = {
      max_new_tokens: 800,
      temperature: 0.2,
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 2,
      do_sample: false,
    };
    const formatted = await this._transformText(prompt, options);

    return {
      original: text,
      formatted,
    };
  }

  async processTranscript(text: string): Promise<StyleTransferResult> {
    const formal = await this.transformToTechnical(text);

    return {
      original: text,
      formal,
    };
  }

  dispose(): void {
    // Clean up resources if needed
    this.pipe = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// Export singleton instance
export default new StyleTransferService();
