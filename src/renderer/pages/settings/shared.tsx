import React, { useState } from 'react';

export function MeterDots({
  count,
  filled,
  variant,
}: {
  count: number;
  filled: number;
  variant: 'good' | 'warn';
}) {
  return (
    <span className="s-meter">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`s-pip${i < filled ? ` s-pip-filled-${variant}` : ''}`}
        />
      ))}
    </span>
  );
}

export function ComingSoon({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      title="Coming soon"
      aria-disabled="true"
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      {hovered && (
        <div
          style={{
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
          }}
        >
          Coming soon
        </div>
      )}
    </div>
  );
}

export function ModelInfoTooltip({
  description,
  children,
}: {
  description: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: 'relative', flex: 1, minWidth: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.72)',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            pointerEvents: 'none',
            whiteSpace: 'normal',
            maxWidth: 260,
            textAlign: 'center',
            lineHeight: 1.5,
            zIndex: 10,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}

export function PaneHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 className="s-pane-title">{title}</h1>
      <p className="s-pane-desc">{description}</p>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="s-section-label">{children}</div>;
}

export function SettingRow({
  icon: Icon,
  iconColor = 'var(--s-text2)',
  title,
  testId,
  description,
  actions,
  actionsGap,
  clickable,
  onClick,
  children,
}: {
  icon?: React.ComponentType<{
    size?: number;
    color?: string;
    style?: React.CSSProperties;
  }>;
  iconColor?: string;
  title?: React.ReactNode;
  testId?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  actionsGap?: number;
  clickable?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`s-row${clickable ? ' s-row-btn' : ''}`} onClick={onClick}>
      {Icon && <Icon size={17} color={iconColor} style={{ flexShrink: 0 }} />}
      <div className="s-row-main">
        {title && (
          <div className="s-row-title" data-testid={testId}>
            {title}
          </div>
        )}
        {description && <div className="s-row-desc">{description}</div>}
        {children}
      </div>
      {actions && (
        <div
          className="s-row-actions"
          style={actionsGap !== undefined ? { gap: actionsGap } : undefined}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export function PickRow({
  selected,
  disabled,
  disabledReason,
  testId,
  title,
  onSelect,
  right,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  testId?: string;
  title: React.ReactNode;
  onSelect: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled === true}
      tabIndex={disabled ? -1 : 0}
      title={disabled ? disabledReason : undefined}
      data-testid={testId}
      className={`s-row s-pick${selected ? ' s-selected' : ''}${disabled ? ' s-disabled' : ''}`}
      style={disabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) =>
        !disabled && (e.key === 'Enter' || e.key === ' ') && onSelect()
      }
    >
      <span className="s-radio" />
      <div style={{ flex: 1 }}>
        <div className="s-row-title">{title}</div>
        {children}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}
