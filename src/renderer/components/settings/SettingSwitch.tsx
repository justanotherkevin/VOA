import { Switch } from '@/renderer/components/switch';

interface SettingSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?: boolean;
  disabled?: boolean;
}

export function SettingSwitch({
  checked,
  onChange,
  accent = false,
  disabled = false,
}: SettingSwitchProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={
        accent
          ? 'data-[state=checked]:bg-[var(--s-accent)]'
          : 'data-[state=checked]:bg-[var(--s-good)]'
      }
    />
  );
}
