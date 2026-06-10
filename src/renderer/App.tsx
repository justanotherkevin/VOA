import React, { useCallback } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useTranscriber } from '@/renderer/hooks/useTranscriber';
import { PermissionsProvider } from '@/renderer/contexts/PermissionsProvider';
import MainLayout from '@/renderer/components/ui/MainLayout';
import Meetings from '@/renderer/pages/Meetings';
import Settings from '@/renderer/pages/Settings';
import Permissions from '@/renderer/pages/Permissions';
import { useAudioRecorder } from '@/renderer/hooks/useAudioRecorder';
import { useSystemAudioRecorder } from '@/renderer/hooks/useSystemAudioRecorder';
import { useRecordingFlow } from '@/renderer/hooks/useRecordingFlow';
import type { AppStatus } from '@/renderer/components/ui/Sidebar';

export default function App() {
  const transcriber = useTranscriber();
  const audioRecorder = useAudioRecorder();
  const systemAudioRecorder = useSystemAudioRecorder();
  useRecordingFlow({ audioRecorder, systemAudioRecorder, transcriber });

  const status: AppStatus = audioRecorder.isRecording
    ? 'recording'
    : transcriber.isBusy
      ? 'processing'
      : 'ready';

  const handleNewRecording = useCallback(() => {
    window.electronAPI.recordings.toggle();
  }, []);

  return (
    <PermissionsProvider>
      <Router>
        <MainLayout status={status}>
          <Routes>
            <Route
              path="/"
              element={<Meetings onNewRecording={handleNewRecording} />}
            />
            <Route
              path="/settings"
              element={<Settings />}
            />
            <Route path="/permissions" element={<Permissions />} />
          </Routes>
        </MainLayout>
      </Router>
    </PermissionsProvider>
  );
}
