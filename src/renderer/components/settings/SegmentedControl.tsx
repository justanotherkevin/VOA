import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/renderer/components/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/renderer/components/tooltip';

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

export function SegmentedControl({
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        onValueChange={(v) => v && onChange(v)}
        className="rounded-md border border-[var(--s-field-line)] bg-[var(--s-track)] p-0.5"
      >
        {options.map((opt) =>
          opt.tooltip ? (
            <Tooltip key={opt.value}>
              <TooltipTrigger asChild>
                <span>
                  <ToggleGroupItem
                    value={opt.value}
                    disabled={opt.disabled}
                    className="h-7 rounded-sm border-none px-3 text-xs data-[state=on]:bg-[var(--s-card)] data-[state=on]:text-[var(--s-text)] data-[state=off]:text-[var(--s-text2)] data-[state=on]:shadow-sm"
                  >
                    {opt.label}
                  </ToggleGroupItem>
                </span>
              </TooltipTrigger>
              <TooltipContent>{opt.tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className="h-7 rounded-sm border-none px-3 text-xs data-[state=on]:bg-[var(--s-card)] data-[state=on]:text-[var(--s-text)] data-[state=off]:text-[var(--s-text2)] data-[state=on]:shadow-sm"
            >
              {opt.label}
            </ToggleGroupItem>
          ),
        )}
      </ToggleGroup>
    </TooltipProvider>
  );
}
