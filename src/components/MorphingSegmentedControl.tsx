type Segment = { id: string; label: string };

type MorphingSegmentedControlProps = {
  label: string;
  onSelectionChange: (id: string) => void;
  options: Segment[];
  selectedId: string;
};

export function MorphingSegmentedControl({ label, onSelectionChange, options, selectedId }: MorphingSegmentedControlProps) {
  const selectedIndex = Math.max(0, options.findIndex(({ id }) => id === selectedId));

  return (
    <div aria-label={label} className="segmented-control" role="tablist">
      <span
        aria-hidden="true"
        className="segmented-control__indicator-slot"
        data-testid="segment-indicator"
        style={{ transform: `translate3d(${selectedIndex * 100}%, 0, 0)` }}
      />
      {options.map((option) => (
        <button
          aria-selected={selectedId === option.id}
          className="segmented-control__item"
          key={option.id}
          onClick={() => onSelectionChange(option.id)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
