import type { CSSProperties, MouseEvent } from 'react';
import { APP_ROUTES, type Destination } from '../navigation/appNavigation';
import { Icon, type IconName } from './Icon';

const icons: Record<Destination, IconName> = {
  overview: 'overview',
  upcoming: 'calendar',
  budget: 'budget',
  debt: 'debt',
};

type AdaptiveNavigationProps = {
  onNavigate: (destination: Destination, event: MouseEvent<HTMLAnchorElement>) => void;
  selectedId: Destination;
};

export function AdaptiveNavigation({ onNavigate, selectedId }: AdaptiveNavigationProps) {
  const selectedIndex = Math.max(0, APP_ROUTES.findIndex(({ destination }) => destination === selectedId));
  return (
    <nav
      aria-label="Hauptnavigation"
      className="adaptive-navigation bottom-navigation"
      data-selected-index={selectedIndex}
      style={{ '--navigation-offset': `${selectedIndex * 100}%`, '--navigation-count': APP_ROUTES.length } as CSSProperties}
    >
      <span className="adaptive-navigation__track bottom-navigation__track">
        <span aria-hidden="true" className="adaptive-navigation__indicator-slot bottom-navigation__indicator-slot">
          <span className="adaptive-navigation__indicator bottom-navigation__indicator" data-testid="navigation-indicator" />
        </span>
        {APP_ROUTES.map((route) => (
          <a
            aria-current={selectedId === route.destination ? 'page' : undefined}
            aria-label={route.label}
            className="adaptive-navigation__item bottom-navigation__item"
            href={route.path}
            key={route.destination}
            onClick={(event) => onNavigate(route.destination, event)}
          >
            <span className="adaptive-navigation__icon bottom-navigation__icon"><Icon name={icons[route.destination]} /></span>
            <span className="adaptive-navigation__label bottom-navigation__label">{route.label}</span>
          </a>
        ))}
      </span>
    </nav>
  );
}
