import { AsrTranscriber } from './types';
import { whisperTranscriber } from './index';

export type AsrType = 'whisper' | 'parakeet';

export interface AsrModelConfig {
  type: AsrType;
  modelId: string;
  quantized: boolean;
}

export class AsrFactory {
  static createTranscriber(config: AsrModelConfig): AsrTranscriber {
    switch (config.type) {
      case 'whisper':
        return whisperTranscriber;
      case 'parakeet':
        throw new Error('Parakeet not yet implemented (Phase 3)');
      default:
        throw new Error(`Unknown ASR type: ${(config as any).type}`);
    }
  }

  static getSupportedTypes(): AsrType[] {
    return ['whisper', 'parakeet'];
  }

  static isTypeSupported(type: string): type is AsrType {
    return type === 'whisper' || type === 'parakeet';
  }
}
