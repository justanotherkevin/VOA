interface SegmentOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--s-track)',
        borderRadius: 9,
        padding: 2,
        gap: 2,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={opt.disabled}
          onClick={() => !opt.disabled && onChange(opt.value)}
          style={{
            border: 'none',
            background: value === opt.value ? 'var(--s-card)' : 'transparent',
            color: value === opt.value ? 'var(--s-text)' : 'var(--s-text2)',
            fontSize: 12.5,
            fontWeight: 500,
            padding: '5px 12px',
            borderRadius: 7,
            cursor: opt.disabled ? 'default' : 'pointer',
            opacity: opt.disabled ? 0.4 : 1,
            whiteSpace: 'nowrap',
            lineHeight: 1.1,
            boxShadow: value === opt.value ? '0 1px 2px rgba(0,0,0,.18)' : 'none',
            fontFamily: 'inherit',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
