type SquiggleProps = {
  className?: string;
  direction?: 'horizontal' | 'vertical';
};

const paths = {
  horizontal: 'M2 16 C10 5 18 5 26 16 S42 27 50 16 S66 5 74 16 S90 27 98 16 S110 6 118 14',
  vertical: 'M14 2 C3 10 3 18 14 26 S25 42 14 50 S3 66 14 74 S25 90 14 98 S4 110 12 118',
};

export function Squiggle({ className = '', direction = 'horizontal' }: SquiggleProps) {
  return (
    <svg
      aria-hidden="true"
      className={`squiggle squiggle--${direction} ${className}`.trim()}
      focusable="false"
      preserveAspectRatio="none"
      viewBox={direction === 'vertical' ? '0 0 28 120' : '0 0 120 28'}
    >
      <path d={paths[direction]} fill="none" pathLength="120" />
    </svg>
  );
}
