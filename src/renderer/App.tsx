import React, { useCallback } from 'react';
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Outlet,
} from 'react-router-dom';
import { useTranscriber } from '@/renderer/hooks/useTranscriber';
import { PermissionsProvider } from '@/renderer/contexts/PermissionsProvider';
import MainLayout from '@/renderer/components/ui/MainLayout';
import Meetings from '@/renderer/pages/Meetings';
import Settings from '@/renderer/pages/Settings';
import Permissions from '@/renderer/pages/Permissions';
import Onboarding from '@/renderer/pages/Onboarding';
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
      <Router initialEntries={['/']}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            element={
              <MainLayout status={status}>
                <Outlet />
              </MainLayout>
            }
          >
            <Route
              path="/"
              element={<Meetings onNewRecording={handleNewRecording} />}
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/permissions" element={<Permissions />} />
          </Route>
        </Routes>
      </Router>
    </PermissionsProvider>
  );
}
