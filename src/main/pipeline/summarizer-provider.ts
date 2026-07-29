import { getSummarizerProvider, SummarizerProviderType } from '@/main/store';

export type { SummarizerProviderType };

export class SummarizerProviderFactory {
  static resolve(): SummarizerProviderType {
    return getSummarizerProvider();
  }
}
