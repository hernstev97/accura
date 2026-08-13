import { useReducedMotion } from 'motion/react';
import { useMorph } from 'shape-morph/react';
import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import { PIN_LENGTH } from '../privacy/appProtectionStore';
import {
  chooseExpressivePinShape,
  type ExpressivePinShapeName,
} from '../privacy/expressivePinShapes';
import { Icon } from './Icon';

const PIN_SHAPE_HOLD_MS = 80;
const PIN_SHAPE_MORPH_MS = 220;

function MorphingPinDot({ shape }: { shape: ExpressivePinShapeName }) {
  const reducedMotion = Boolean(useReducedMotion());
  const [morphToCircle, setMorphToCircle] = useState(reducedMotion);
  const { pathD, progress } = useMorph(shape, 'Circle', {
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

  return (
    <span
      className={`pin-indicator${reducedMotion ? '' : ' pin-indicator--entering'}`}
      data-morph-progress={progress.toFixed(3)}
      data-start-shape={shape}
    >
      <svg focusable="false" viewBox="0 0 100 100">
        <path d={pathD} />
      </svg>
    </span>
  );
}

function PinIndicators({ length, resetToken }: { length: number; resetToken?: number }) {
  const [shapes, setShapes] = useState<ExpressivePinShapeName[]>(() =>
    Array.from({ length }, chooseExpressivePinShape));

  useEffect(() => {
    setShapes((current) => {
      if (length < current.length) return current.slice(0, length);
      if (length === current.length) return current;
      return [
        ...current,
        ...Array.from({ length: length - current.length }, chooseExpressivePinShape),
      ];
    });
  }, [length]);

  useEffect(() => {
    setShapes([]);
  }, [resetToken]);

  return (
    <div aria-hidden="true" className="pin-indicators" data-filled={length}>
      {shapes.map((shape, index) => <MorphingPinDot key={`${index}-${shape}`} shape={shape} />)}
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
