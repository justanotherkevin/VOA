import React, { ReactNode } from 'react';
import { MeetingsContext } from './MeetingsContext';
import { useMeetings } from '@/renderer/hooks/useMeetings';

interface MeetingsProviderProps {
  children: ReactNode;
}

export function MeetingsProvider({ children }: MeetingsProviderProps) {
  const value = useMeetings();
  return (
    <MeetingsContext.Provider value={value}>
      {children}
    </MeetingsContext.Provider>
  );
}
