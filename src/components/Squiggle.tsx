type SquiggleProps = {
  className?: string;
};

export function Squiggle({ className = '' }: SquiggleProps) {
  return (
    <svg aria-hidden="true" className={`squiggle ${className}`.trim()} focusable="false" viewBox="0 0 120 28">
      <path d="M2 18 C14 2 26 2 38 18 S62 34 74 18 S98 2 118 14" fill="none" pathLength="120" />
    </svg>
  );
}
