import type { ReactNode } from 'react';

type ScreenHeaderProps = {
  id: string;
  title: ReactNode;
  supporting?: ReactNode;
  eyebrow?: ReactNode;
};

export function ScreenHeader({ eyebrow, id, supporting, title }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      {eyebrow ? <p className="screen-header__eyebrow">{eyebrow}</p> : null}
      <h1 id={id}>{title}</h1>
      {supporting ? <p className="screen-header__supporting">{supporting}</p> : null}
    </header>
  );
}
