import { CalendarProvider } from './types';
import {
  IcsFeedCalendarProvider,
  type IcsFeedProviderConfig,
} from './ics-feed-calendar-provider';

export type CalendarProviderType = 'ics-feed';

// Widen to a union (e.g. IcsFeedProviderConfig | CalDavProviderConfig) when a
// second provider is added.
export type CalendarProviderConfig = IcsFeedProviderConfig;

export class CalendarProviderFactory {
  static createProvider(config: CalendarProviderConfig): CalendarProvider {
    switch (config.type) {
      case 'ics-feed':
        return new IcsFeedCalendarProvider(config);
      default:
        throw new Error(
          `Unknown calendar provider type: ${(config as any).type}`,
        );
    }
  }

  static getSupportedTypes(): CalendarProviderType[] {
    return ['ics-feed'];
  }

  static isTypeSupported(type: string): type is CalendarProviderType {
    return type === 'ics-feed';
  }
}
