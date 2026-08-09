import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

type Segment<T extends string> = { id: T; label: string };

type MorphingSegmentedControlProps<T extends string> = {
  label: string;
  onSelectionChange: (id: T) => void;
  options: readonly Segment<T>[];
  selectedId: T;
  controlsId: string;
};

export function MorphingSegmentedControl<T extends string>({ controlsId, label, onSelectionChange, options, selectedId }: MorphingSegmentedControlProps<T>) {
  const selectedIndex = Math.max(0, options.findIndex(({ id }) => id === selectedId));
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAt = (index: number) => {
    const normalized = (index + options.length) % options.length;
    const option = options[normalized];
    if (!option) return;
    onSelectionChange(option.id);
    refs.current[normalized]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') selectAt(0);
    else if (event.key === 'End') selectAt(options.length - 1);
    else selectAt(index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1));
  };

  return (
    <div
      aria-label={label}
      className="segmented-control"
      role="tablist"
      style={{
        '--segment-count': options.length,
        '--segment-offset': `${selectedIndex * 100}%`,
        '--segment-width': `calc((100% - 8px) / ${options.length})`,
      } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="segmented-control__indicator-slot"
        data-testid="segment-indicator"
      />
      {options.map((option, index) => (
        <button
          aria-controls={`${controlsId}-${option.id}`}
          aria-selected={selectedId === option.id}
          className="segmented-control__item"
          id={`${controlsId}-tab-${option.id}`}
          key={option.id}
          onClick={() => onSelectionChange(option.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          ref={(element) => { refs.current[index] = element; }}
          role="tab"
          tabIndex={selectedId === option.id ? 0 : -1}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
