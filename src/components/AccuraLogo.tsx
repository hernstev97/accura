import type { SVGProps } from 'react';

const ACCURA_SOURCE = '/icons/accura-source.svg#accura-mark';

export function AccuraLogo({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : undefined}
      viewBox="0 0 327 248"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <use href={ACCURA_SOURCE} />
    </svg>
  );
}
