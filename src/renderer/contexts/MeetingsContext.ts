import { createContext } from 'react';
import type { useMeetings } from '@/renderer/hooks/useMeetings';

export type MeetingsContextType = ReturnType<typeof useMeetings>;

export const MeetingsContext = createContext<MeetingsContextType | undefined>(
  undefined,
);
