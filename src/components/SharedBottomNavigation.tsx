import { Icon, type IconName } from './Icon';

export type Destination = 'overview' | 'budget' | 'debt';

const destinations: Array<{ id: Destination; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Übersicht', icon: 'overview' },
  { id: 'budget', label: 'Budget', icon: 'budget' },
  { id: 'debt', label: 'Schulden', icon: 'debt' },
];

type SharedBottomNavigationProps = {
  onSelect: (destination: Destination) => void;
  selectedId: Destination;
};

export function SharedBottomNavigation({ onSelect, selectedId }: SharedBottomNavigationProps) {
  const selectedIndex = destinations.findIndex(({ id }) => id === selectedId);

  return (
    <nav aria-label="Hauptnavigation" className="bottom-navigation">
      <span className="bottom-navigation__track">
        <span
          aria-hidden="true"
          className="bottom-navigation__indicator-slot"
          style={{ transform: `translate3d(${selectedIndex * 100}%, 0, 0)` }}
        >
          <span className="bottom-navigation__indicator" data-testid="navigation-indicator" />
        </span>
        {destinations.map((item) => (
          <button
            aria-current={selectedId === item.id ? 'page' : undefined}
            className="bottom-navigation__item"
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span className="bottom-navigation__icon"><Icon name={item.icon} /></span>
            <span className="bottom-navigation__label">{item.label}</span>
          </button>
        ))}
      </span>
    </nav>
  );
}
