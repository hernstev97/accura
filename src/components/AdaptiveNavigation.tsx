import type { CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';

export type Destination = 'overview' | 'budget' | 'debt';

const destinations: ReadonlyArray<{ id: Destination; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Übersicht', icon: 'overview' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
  { id: 'debt', label: 'Schulden', icon: 'debt' },
];

type AdaptiveNavigationProps = {
  onSelect: (destination: Destination) => void;
  selectedId: Destination;
};

export function AdaptiveNavigation({ onSelect, selectedId }: AdaptiveNavigationProps) {
  const selectedIndex = Math.max(0, destinations.findIndex(({ id }) => id === selectedId));
  return (
    <nav
      aria-label="Hauptnavigation"
      className="adaptive-navigation bottom-navigation"
      data-selected-index={selectedIndex}
      style={{ '--navigation-offset': `${selectedIndex * 100}%` } as CSSProperties}
    >
      <span className="adaptive-navigation__track bottom-navigation__track">
        <span aria-hidden="true" className="adaptive-navigation__indicator-slot bottom-navigation__indicator-slot">
          <span className="adaptive-navigation__indicator bottom-navigation__indicator" data-testid="navigation-indicator" />
        </span>
        {destinations.map((item) => (
          <button
            aria-current={selectedId === item.id ? 'page' : undefined}
            aria-label={item.label}
            className="adaptive-navigation__item bottom-navigation__item"
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span className="adaptive-navigation__icon bottom-navigation__icon"><Icon name={item.icon} /></span>
            <span className="adaptive-navigation__label bottom-navigation__label">{item.label}</span>
          </button>
        ))}
      </span>
    </nav>
  );
}
