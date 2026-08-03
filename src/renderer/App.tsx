import React, { useCallback, useEffect, useState } from 'react';
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Outlet,
} from 'react-router-dom';
import { useTranscriber } from '@/renderer/hooks/useTranscriber';
import { PermissionsProvider } from '@/renderer/contexts/PermissionsProvider';
import { MeetingsProvider } from '@/renderer/contexts/MeetingsProvider';
import { SettingsNavProvider } from '@/renderer/contexts/SettingsNavProvider';
import { UIPreferencesProvider } from '@/renderer/contexts/UIPreferencesProvider';
import MainLayout from '@/renderer/components/ui/MainLayout';
import Meetings from '@/renderer/pages/Meetings';
import Settings from '@/renderer/pages/Settings';
import Permissions from '@/renderer/pages/Permissions';
import Onboarding from '@/renderer/pages/Onboarding';
import { useAudioRecorder } from '@/renderer/hooks/useAudioRecorder';
import { useSystemAudioRecorder } from '@/renderer/hooks/useSystemAudioRecorder';
import { useRecordingFlow } from '@/renderer/hooks/useRecordingFlow';
import { Toaster } from '@/renderer/components/sonner';

export default function App() {
  const transcriber = useTranscriber();
  const audioRecorder = useAudioRecorder();
  const systemAudioRecorder = useSystemAudioRecorder();
  const { status } = useRecordingFlow({
    audioRecorder,
    systemAudioRecorder,
    transcriber,
  });

  const handleNewRecording = useCallback(() => {
    window.electronAPI.recordings.toggle();
  }, []);

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    window.electronAPI.onboarding
      .getCompleted()
      .then(setOnboardingDone)
      .catch(() => setOnboardingDone(true));
  }, []);

  return (
    <UIPreferencesProvider>
      <PermissionsProvider>
        {/* Toaster must mount immediately, not wait on the onboarding flag:
            app-wide toasts (e.g. the startup model-load toast) are driven by
            useTranscriber listeners that are already live above this point.
            The Router below is the only thing that needs to wait, since
            MemoryRouter's initialEntries is only read on its first render. */}
        <Toaster />
        {onboardingDone !== null && (
          <Router initialEntries={[onboardingDone ? '/' : '/onboarding']}>
            <MeetingsProvider>
              <SettingsNavProvider>
                <Routes>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route
                    element={
                      <MainLayout
                        status={status}
                        onNewRecording={handleNewRecording}
                      >
                        <Outlet />
                      </MainLayout>
                    }
                  >
                    <Route path="/" element={<Meetings />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/permissions" element={<Permissions />} />
                  </Route>
                </Routes>
              </SettingsNavProvider>
            </MeetingsProvider>
          </Router>
        )}
      </PermissionsProvider>
    </UIPreferencesProvider>
  );
}
