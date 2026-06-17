import { useState } from 'react';

interface SegmentOption {
  label: string;
  value: string;
  disabled?: boolean;
  tooltip?: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

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
        <div
          key={opt.value}
          style={{ position: 'relative' }}
          onMouseEnter={() => opt.tooltip && setHoveredValue(opt.value)}
          onMouseLeave={() => setHoveredValue(null)}
        >
          <button
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
          {hoveredValue === opt.value && opt.tooltip && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0,0,0,0.72)',
              color: '#fff',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 500,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}>
              {opt.tooltip}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
