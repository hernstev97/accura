import { useReducedMotion } from 'motion/react';
import { useMorph } from 'shape-morph/react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { PIN_LENGTH } from '../privacy/appProtectionStore';
import {
  chooseExpressivePinShape,
  type ExpressivePinShapeName,
} from '../privacy/expressivePinShapes';
import { Icon } from './Icon';

const PIN_SHAPE_HOLD_MS = 80;
const PIN_SHAPE_MORPH_MS = 220;
const PIN_DOT_STEP_PX = 24;

type PinIndicatorItem = {
  id: number;
  phase: 'active' | 'exiting';
  shape: ExpressivePinShapeName;
};

function MorphingPinDot({
  item,
  onExitComplete,
  position,
}: {
  item: PinIndicatorItem;
  onExitComplete: (id: number) => void;
  position: number;
}) {
  const reducedMotion = Boolean(useReducedMotion());
  const [morphToCircle, setMorphToCircle] = useState(reducedMotion);
  const [visible, setVisible] = useState(reducedMotion && item.phase === 'active');
  const { pathD, progress } = useMorph(item.shape, 'Circle', {
    duration: PIN_SHAPE_MORPH_MS,
    progress: morphToCircle ? 1 : 0,
    size: 100,
  });

  useEffect(() => {
    if (reducedMotion) {
      setMorphToCircle(true);
      return;
    }
    const timer = window.setTimeout(() => setMorphToCircle(true), PIN_SHAPE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (item.phase === 'exiting') {
      if (reducedMotion) {
        onExitComplete(item.id);
        return;
      }
      setVisible(false);
      return;
    }
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [item.id, item.phase, onExitComplete, reducedMotion]);

  return (
    <span
      className="pin-indicator"
      data-indicator-state={item.phase}
      data-morph-progress={progress.toFixed(3)}
      data-start-shape={item.shape}
      style={{ transform: `translateX(${position}px)` }}
    >
      <span
        className={`pin-indicator__shape${visible ? ' pin-indicator__shape--visible' : ''}`}
        onTransitionEnd={(event) => {
          if (item.phase === 'exiting' && event.propertyName === 'transform') onExitComplete(item.id);
        }}
      >
        <svg focusable="false" viewBox="0 0 100 100">
          <path d={pathD} />
        </svg>
      </span>
    </span>
  );
}

function PinIndicators({ length, resetToken }: { length: number; resetToken?: number }) {
  const nextIndicatorId = useRef(0);
  const previousResetToken = useRef(resetToken);
  const [indicators, setIndicators] = useState<PinIndicatorItem[]>(() =>
    Array.from({ length }, () => ({
      id: nextIndicatorId.current++,
      phase: 'active',
      shape: chooseExpressivePinShape(),
    })));
  const activeLength = indicators.filter(({ phase }) => phase === 'active').length;
  const removeIndicator = useCallback((id: number) => {
    setIndicators((current) => current.filter((indicator) => indicator.id !== id));
  }, []);

  useEffect(() => {
    if (length === activeLength) return;
    if (length < activeLength) {
      setIndicators((current) => {
        let keptActive = 0;
        return current.map((indicator) => {
          if (indicator.phase === 'exiting') return indicator;
          if (keptActive++ < length) return indicator;
          return { ...indicator, phase: 'exiting' };
        });
      });
      return;
    }

    const additions = Array.from({ length: length - activeLength }, () => ({
      id: nextIndicatorId.current++,
      phase: 'active' as const,
      shape: chooseExpressivePinShape(),
    }));
    setIndicators((current) => {
      const missing = length - current.filter(({ phase }) => phase === 'active').length;
      return missing > 0 ? [...current, ...additions.slice(0, missing)] : current;
    });
  }, [activeLength, length]);

  useEffect(() => {
    if (previousResetToken.current === resetToken) return;
    previousResetToken.current = resetToken;
    setIndicators((current) => current.map((indicator) => (
      indicator.phase === 'exiting' ? indicator : { ...indicator, phase: 'exiting' }
    )));
  }, [resetToken]);

  return (
    <div aria-hidden="true" className="pin-indicators" data-filled={length}>
      {indicators.map((item, index) => (
        <MorphingPinDot
          item={item}
          key={item.id}
          onExitComplete={removeIndicator}
          position={(index - (indicators.length - 1) / 2) * PIN_DOT_STEP_PX}
        />
      ))}
    </div>
  );
}

type PinPadProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  error?: string | null;
  status?: string;
  resetToken?: number;
  rootRef?: RefObject<HTMLDivElement | null>;
};

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function PinPad({
  disabled = false,
  error,
  onChange,
  onSubmit,
  resetToken,
  rootRef,
  status,
  value,
}: PinPadProps) {
  const appendDigit = (digit: string) => {
    if (!disabled && value.length < PIN_LENGTH) onChange(`${value}${digit}`);
  };
  const removeDigit = () => {
    if (!disabled && value.length) onChange(value.slice(0, -1));
  };
  const submit = () => {
    if (!disabled && value.length === PIN_LENGTH) onSubmit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      appendDigit(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      removeDigit();
    } else if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault();
      submit();
    }
  };

  const enteredStatus = `${value.length} von ${PIN_LENGTH} Stellen eingegeben`;

  return (
    <div
      aria-label="PIN-Eingabe"
      className="pin-pad"
      onKeyDown={onKeyDown}
      ref={rootRef}
      role="group"
      tabIndex={-1}
    >
      <PinIndicators length={value.length} resetToken={resetToken} />
      <p aria-live="polite" className="sr-only">{enteredStatus}</p>
      <div className="pin-pad__message" aria-live={error ? 'assertive' : 'polite'}>
        {error ? <p className="pin-pad__error" role="alert">{error}</p> : <p>{status ?? '\u00a0'}</p>}
      </div>
      <div className="pin-keypad" aria-label="Ziffernfeld">
        {digits.map((digit) => (
          <button aria-label={digit} className="pin-key" disabled={disabled} key={digit} onClick={() => appendDigit(digit)} type="button">
            {digit}
          </button>
        ))}
        <button aria-label="Letzte PIN-Stelle löschen" className="pin-key pin-key--action" disabled={disabled || !value.length} onClick={removeDigit} type="button">
          <Icon name="backspace" />
        </button>
        <button aria-label="0" className="pin-key" disabled={disabled} onClick={() => appendDigit('0')} type="button">0</button>
        <button aria-label="PIN bestätigen" className="pin-key pin-key--action pin-key--confirm" disabled={disabled || value.length !== PIN_LENGTH} onClick={submit} type="button">
          <Icon name="enter" />
        </button>
      </div>
    </div>
  );
}
