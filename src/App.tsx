import { AnimatePresence, LayoutGroup, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { SharedBottomNavigation, type Destination } from './components/SharedBottomNavigation';
import { OverviewScreen } from './screens/OverviewScreen';

const budgetScreenModule = import('./screens/BudgetScreen');
const debtScreenModule = import('./screens/DebtScreen');
const BudgetScreen = lazy(() => budgetScreenModule.then((module) => ({ default: module.BudgetScreen })));
const DebtScreen = lazy(() => debtScreenModule.then((module) => ({ default: module.DebtScreen })));

const destinationOrder: Destination[] = ['overview', 'budget', 'debt'];
const screenNames: Record<Destination, string> = {
  overview: 'Übersicht',
  budget: 'Budget',
  debt: 'Schulden',
};

function ScreenLoading() {
  return (
    <div className="screen screen-loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      <p>Ansicht wird geladen …</p>
    </div>
  );
}

function InfoDisclosure() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <LayoutGroup id="info-disclosure">
      {!open ? (
        <motion.button
          aria-label="Über diese App"
          className="icon-button icon-button--contextual"
          key="info-source"
          layoutId="info-surface"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Icon name="info" />
        </motion.button>
      ) : <span className="info-action-placeholder" aria-hidden="true" />}

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="info-scrim"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onPointerDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <motion.section
              aria-labelledby="info-title"
              aria-modal="true"
              className="info-surface"
              layoutId="info-surface"
              role="dialog"
            >
              <div className="info-surface__header">
                <div>
                  <p>Lokale Übersicht</p>
                  <h2 id="info-title">Finanzen · v0.1</h2>
                </div>
                <button aria-label="Informationen schließen" className="icon-button" onClick={() => setOpen(false)} ref={closeRef} type="button">
                  <Icon name="close" />
                </button>
              </div>
              <p>Eine installierbare Übersicht für Budget, Konten und Schulden.</p>
              <p>Alle Werte stammen aus einer lokalen Beispieldatei. Es findet keine Verbindung zu Banken oder Google Sheets statt.</p>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </LayoutGroup>
  );
}

function Screen({ destination, direction }: { destination: Destination; direction: number }) {
  const reduceMotion = useReducedMotion();
  const axisDistance = reduceMotion ? 0 : 20 * direction;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="screen-transition"
      custom={direction}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.995, x: reduceMotion ? 0 : -12 * direction }}
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.995, x: axisDistance }}
      transition={{ duration: reduceMotion ? 0.1 : 0.32, ease: [0.2, 0, 0, 1] }}
    >
      <Suspense fallback={<ScreenLoading />}>
        {destination === 'overview' ? <OverviewScreen /> : null}
        {destination === 'budget' ? <BudgetScreen /> : null}
        {destination === 'debt' ? <DebtScreen /> : null}
      </Suspense>
    </motion.div>
  );
}

function App() {
  const [destination, setDestination] = useState<Destination>('overview');
  const [direction, setDirection] = useState(1);
  const mainRef = useRef<HTMLElement>(null);

  const selectDestination = (nextDestination: Destination) => {
    if (nextDestination === destination) return;
    setDirection(Math.sign(destinationOrder.indexOf(nextDestination) - destinationOrder.indexOf(destination)) || 1);
    setDestination(nextDestination);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [destination]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div className="app-content">
          <header className="top-app-bar">
            <div className="screen-identity">
              <span className="brand-mark" aria-hidden="true">F</span>
              <div>
                <span>Finanzen</span>
                <strong>{screenNames[destination]}</strong>
              </div>
            </div>
            <InfoDisclosure />
          </header>

          <main aria-label={screenNames[destination]} ref={mainRef} tabIndex={-1}>
            <AnimatePresence custom={direction} initial={false} mode="popLayout">
              <Screen destination={destination} direction={direction} key={destination} />
            </AnimatePresence>
          </main>

          <SharedBottomNavigation onSelect={selectDestination} selectedId={destination} />
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
