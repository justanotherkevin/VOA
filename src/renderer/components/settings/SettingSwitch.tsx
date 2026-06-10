interface SettingSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  accent?: boolean;
  disabled?: boolean;
}

export function SettingSwitch({ checked, onChange, accent = false, disabled = false }: SettingSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative flex-none focus:outline-none disabled:opacity-40"
      style={{
        width: 38,
        height: 23,
        borderRadius: 20,
        background: checked
          ? accent ? 'var(--s-accent)' : 'var(--s-good)'
          : 'var(--s-track)',
        transition: 'background 0.18s',
        cursor: disabled ? 'default' : 'pointer',
        border: 'none',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 17 : 2,
          width: 19,
          height: 19,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
          transition: 'left 0.18s',
        }}
      />
    </button>
  );
}
