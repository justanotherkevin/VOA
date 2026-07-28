import { useCallback, useEffect, useState } from 'react';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface UseAudioDevicesReturn {
  microphones: AudioInputDevice[];
  defaultOutputLabel: string | null;
  labelsAvailable: boolean;
}

export function useAudioDevices(): UseAudioDevicesReturn {
  const [microphones, setMicrophones] = useState<AudioInputDevice[]>([]);
  const [defaultOutputLabel, setDefaultOutputLabel] = useState<string | null>(
    null,
  );
  const [labelsAvailable, setLabelsAvailable] = useState(false);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const outputs = devices.filter((d) => d.kind === 'audiooutput');

      setMicrophones(
        inputs.map((d) => ({ deviceId: d.deviceId, label: d.label })),
      );
      setLabelsAvailable(inputs.some((d) => d.label));

      const defaultOutput =
        outputs.find((d) => d.deviceId === 'default') ?? outputs[0];
      setDefaultOutputLabel(defaultOutput?.label || null);
    } catch {
      // enumerateDevices can throw in unsupported/insecure contexts; leave
      // state at its defaults (empty list, no output label).
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refresh);
    };
  }, [refresh]);

  return { microphones, defaultOutputLabel, labelsAvailable };
}
