import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Section({
  icon,
  title,
  action,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen((o) => !o);
        }}
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-accent transition-colors"
      >
        <span className="text-[#a59ef5] shrink-0">{icon}</span>
        <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">
          {title}
        </h3>
        {action && (
          <div
            className="ml-auto flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {action}
          </div>
        )}
        <ChevronDown
          size={14}
          className={`text-muted-foreground transition-transform shrink-0 ${action ? 'ml-2' : 'ml-auto'} ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {open && (
        <div id={contentId} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
