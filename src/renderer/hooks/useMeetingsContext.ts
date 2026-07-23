import { useContext } from 'react';
import { MeetingsContext } from '@/renderer/contexts/MeetingsContext';

export function useMeetingsContext() {
  const context = useContext(MeetingsContext);
  if (!context) {
    throw new Error('useMeetingsContext must be used within MeetingsProvider');
  }
  return context;
}
