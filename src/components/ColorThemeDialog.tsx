import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode, type RefObject } from 'react';
import { useAppearance } from '../appearance/AppearanceProvider';
import { analyzeWallpaperFile, WALLPAPER_IMAGE_ERROR, WallpaperAnalysisRaceGuard } from '../appearance/imagePalette';
import { createWallpaperPalettes, preferenceFromCandidate, presetPalettes } from '../appearance/themePalettes';
import type { ColorSource, PaletteCandidate, ResolvedThemeMode, ThemeMode, ThemeTokenSet } from '../appearance/types';
import { AdaptiveDialog } from './AdaptiveDialog';
import { Icon, type IconName } from './Icon';

const sourceOptions: readonly { value: ColorSource; label: string; icon: IconName }[] = [
  { value: 'browser', label: 'System', icon: 'system' },
  { value: 'wallpaper', label: 'Bild', icon: 'image' },
  { value: 'preset', label: 'Farben', icon: 'palette' },
];

const modeOptions: readonly { value: ThemeMode; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System', icon: 'system' },
  { value: 'light', label: 'Hell', icon: 'light' },
  { value: 'dark', label: 'Dunkel', icon: 'dark' },
];

type SegmentedOption<T extends string> = { value: T; label: string; icon?: IconName };

function SegmentedRadio<T extends string>({ id, label, options, value, onChange }: {
  id: string;
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="appearance-segmented" aria-label={label} role="radiogroup">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label className="appearance-segmented__option" data-selected={option.value === value} key={option.value}>
          <input checked={option.value === value} name={id} onChange={() => onChange(option.value)} type="radio" value={option.value} />
          <span>{option.icon ? <Icon name={option.icon} size={18} /> : null}{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ThemePreview({ tokens, source, wallpaperUrl }: { tokens: ThemeTokenSet; source: ColorSource; wallpaperUrl: string | null }) {
  return (
    <section className="appearance-preview" aria-label="Vorschau der Finanz-App" style={tokens as CSSProperties}>
      {source === 'wallpaper' && wallpaperUrl ? (
        <figure className="appearance-preview__wallpaper">
          <img alt="Ausgewählter Bildausschnitt" src={wallpaperUrl} />
          <figcaption>Farben aus diesem Bild</figcaption>
        </figure>
      ) : (
        <div className="appearance-preview__tones" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
      )}
      <div className="appearance-preview__app">
        <div className="appearance-preview__topbar"><span>F</span><b>Finanzen</b><i /></div>
        <div className="appearance-preview__hero">
          <small>Verfügbar</small>
          <strong>1.234,56 €</strong>
          <div><span /><span /><span /></div>
        </div>
        <div className="appearance-preview__metrics"><span><i />Monat</span><span><i />Rücklagen</span></div>
        <div className="appearance-preview__nav"><i /><i className="is-active" /><i /></div>
      </div>
    </section>
  );
}

function PaletteSwatches({ candidates, selectedId, onSelect }: {
  candidates: readonly PaletteCandidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="palette-swatches" aria-label="Paletten" role="radiogroup">
      {candidates.map((candidate) => (
        <label className="palette-swatch" data-selected={candidate.id === selectedId} key={candidate.id} title={candidate.name}>
          <input
            aria-label={candidate.name}
            checked={candidate.id === selectedId}
            name="appearance-palette"
            onChange={() => onSelect(candidate.id)}
            type="radio"
          />
          <span
            aria-hidden="true"
            className="palette-swatch__color"
            style={{ background: `conic-gradient(${candidate.swatch[0]} 0 25%, ${candidate.swatch[1]} 25% 50%, ${candidate.swatch[2]} 50% 75%, ${candidate.swatch[3]} 75% 100%)` }}
          >
            <span className="palette-swatch__check"><Icon name="check" size={17} /></span>
          </span>
          <span className="palette-swatch__name">{candidate.name}</span>
        </label>
      ))}
    </div>
  );
}

function SourceContent({ children }: { children: ReactNode }) {
  return <section className="appearance-source-content">{children}</section>;
}

type ColorThemeDialogProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function ColorThemeDialog({ open, onClose, returnFocusRef }: ColorThemeDialogProps) {
  const appearance = useAppearance();
  const activeRef = useRef(appearance);
  activeRef.current = appearance;
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestGuard = useRef(new WallpaperAnalysisRaceGuard());
  const wasOpen = useRef(false);

  const [mode, setMode] = useState<ThemeMode>(appearance.preference.mode);
  const [source, setSource] = useState<ColorSource>(appearance.preference.source);
  const [browserPalette, setBrowserPalette] = useState(appearance.resolveBrowserPalette);
  const [presetId, setPresetId] = useState(() => presetPalettes[0].id);
  const [wallpaperCandidates, setWallpaperCandidates] = useState<PaletteCandidate[]>([]);
  const [wallpaperId, setWallpaperId] = useState<string | null>(null);
  const [wallpaperSeeds, setWallpaperSeeds] = useState<string[]>([]);
  const [draftThumbnail, setDraftThumbnail] = useState<Blob | null>(null);
  const [baseline, setBaseline] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const initializeDraft = useCallback(() => {
    const current = activeRef.current;
    const preference = current.preference;
    const refreshedBrowser = current.resolveBrowserPalette();
    setMode(preference.mode);
    setSource(preference.source);
    setBrowserPalette(preference.source === 'browser' ? current.activePalette : refreshedBrowser);
    setPresetId(preference.source === 'preset' && presetPalettes.some(({ id }) => id === preference.palette.id) ? preference.palette.id : presetPalettes[0].id);
    if (preference.source === 'wallpaper') {
      const palettes = createWallpaperPalettes(preference.wallpaper.seeds.length ? preference.wallpaper.seeds : [preference.palette.seed]);
      const exact = palettes.findIndex(({ id }) => id === preference.palette.id);
      if (exact >= 0) palettes[exact] = current.activePalette;
      else palettes.unshift(current.activePalette);
      setWallpaperCandidates(palettes.slice(0, 7));
      setWallpaperId(preference.palette.id);
      setWallpaperSeeds(preference.wallpaper.seeds.length ? preference.wallpaper.seeds : [preference.palette.seed]);
    } else {
      setWallpaperCandidates([]);
      setWallpaperId(null);
      setWallpaperSeeds([]);
    }
    setDraftThumbnail(null);
    setBaseline(`${preference.mode}:${preference.source}:${preference.palette.id}`);
    setAnalyzing(false);
    setApplying(false);
    setError(null);
    setStatus(null);
    setDraftReady(true);
  }, []);

  useLayoutEffect(() => {
    if (open && !wasOpen.current) initializeDraft();
    if (!open && wasOpen.current) {
      abortRef.current?.abort();
      abortRef.current = null;
      requestGuard.current.invalidate();
      setDraftReady(false);
    }
    wasOpen.current = open;
  }, [initializeDraft, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    requestGuard.current.invalidate();
    onClose();
  }, [onClose]);

  const activeCandidates = source === 'browser' ? [browserPalette] : source === 'preset' ? presetPalettes : wallpaperCandidates;
  const selectedId = source === 'browser' ? browserPalette.id : source === 'preset' ? presetId : wallpaperId;
  const selected = activeCandidates.find(({ id }) => id === selectedId) ?? null;
  const signature = `${mode}:${source}:${selected?.id ?? 'none'}${draftThumbnail ? ':new-image' : ''}`;
  const dirty = draftReady && signature !== baseline;
  const previewMode: ResolvedThemeMode = mode === 'system' ? appearance.resolvedMode : mode;
  const previewTokens = (selected?.theme ?? appearance.preference.theme)[previewMode];

  const draftThumbnailUrl = useMemo(() => draftThumbnail ? URL.createObjectURL(draftThumbnail) : null, [draftThumbnail]);
  useEffect(() => () => {
    if (draftThumbnailUrl) URL.revokeObjectURL(draftThumbnailUrl);
  }, [draftThumbnailUrl]);
  const wallpaperUrl = draftThumbnailUrl ?? (appearance.preference.source === 'wallpaper' ? appearance.wallpaperPreviewUrl : null);

  const chooseSource = (nextSource: ColorSource) => {
    setError(null);
    setStatus(null);
    if (nextSource === 'browser') setBrowserPalette(appearance.resolveBrowserPalette());
    setSource(nextSource);
  };

  const choosePalette = (id: string) => {
    if (source === 'preset') setPresetId(id);
    else if (source === 'wallpaper') setWallpaperId(id);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = requestGuard.current.begin();
    setAnalyzing(true);
    setError(null);
    setStatus('Farben werden auf diesem Gerät berechnet …');
    try {
      const result = await analyzeWallpaperFile(file, controller.signal);
      if (!requestGuard.current.isCurrent(generation) || controller.signal.aborted) return;
      setWallpaperCandidates(result.candidates);
      setWallpaperId(result.candidates[0]?.id ?? null);
      setWallpaperSeeds(result.seeds);
      setDraftThumbnail(result.thumbnail);
      setSource('wallpaper');
      setStatus(`${result.candidates.length} Paletten wurden lokal erstellt.`);
    } catch (analysisError) {
      if (analysisError instanceof DOMException && analysisError.name === 'AbortError') return;
      if (requestGuard.current.isCurrent(generation)) {
        setError(WALLPAPER_IMAGE_ERROR);
        setStatus(null);
      }
    } finally {
      if (requestGuard.current.isCurrent(generation)) {
        setAnalyzing(false);
        abortRef.current = null;
      }
    }
  };

  const removeImage = () => {
    abortRef.current?.abort();
    requestGuard.current.invalidate();
    setAnalyzing(false);
    setDraftThumbnail(null);
    setWallpaperCandidates([]);
    setWallpaperSeeds([]);
    setWallpaperId(null);
    setBrowserPalette(appearance.resolveBrowserPalette());
    setSource('browser');
    setError(null);
    setStatus('Das Bild wird erst beim Anwenden von diesem Gerät entfernt.');
  };

  const apply = async () => {
    if (!selected || !dirty || analyzing || applying) return;
    setApplying(true);
    setError(null);
    setStatus('Design wird gespeichert …');
    const preference = preferenceFromCandidate(
      source,
      mode,
      selected,
      source === 'wallpaper'
        ? { hasPreview: Boolean(draftThumbnail || (appearance.preference.source === 'wallpaper' && appearance.preference.wallpaper.hasPreview)), seeds: wallpaperSeeds }
        : { hasPreview: false, seeds: [] },
    );
    try {
      const result = await appearance.applyPreference(preference, {
        wallpaperPreview: source === 'wallpaper' ? (draftThumbnail ?? undefined) : null,
      });
      if (result.preferencePersisted && result.previewPersisted) {
        onClose();
      } else {
        setBaseline(signature);
        setStatus('Das Design ist aktiv, konnte aber nicht vollständig dauerhaft gespeichert werden.');
      }
    } catch {
      setError('Das Design konnte nicht angewendet werden. Bitte versuche es erneut.');
      setStatus(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <AdaptiveDialog
      ariaLabelledBy="color-theme-title"
      className="color-theme-layer"
      initialFocusRef={closeRef}
      onClose={close}
      open={open}
      presentation="fullscreen"
      returnFocusRef={returnFocusRef}
      surfaceClassName="color-theme-dialog"
      surfaceRef={surfaceRef}
      style={previewTokens as CSSProperties}
    >
        <header className="color-theme-dialog__header">
          <button aria-label="Farben schließen" className="icon-button color-theme-dialog__close" onClick={close} ref={closeRef} type="button"><Icon name="close" /></button>
          <h2 id="color-theme-title">Farben</h2>
          <button className="appearance-apply" disabled={!dirty || !selected || analyzing || applying} onClick={() => void apply()} type="button">
            {applying ? 'Wird angewendet …' : 'Anwenden'}
          </button>
        </header>

        <div className="color-theme-dialog__scroll">
          <ThemePreview source={source} tokens={previewTokens} wallpaperUrl={source === 'wallpaper' ? wallpaperUrl : null} />

          <section className="palette-card" aria-labelledby="palette-card-title">
            <h3 id="palette-card-title">Deine Palette</h3>
            <p>Symbole, Texte und Flächen passen sich der gewählten Palette an.</p>
            {activeCandidates.length ? <PaletteSwatches candidates={activeCandidates} onSelect={choosePalette} selectedId={selectedId} /> : (
              <p className="palette-card__empty">Wähle ein Bild aus, um passende Material-You-Paletten zu erstellen.</p>
            )}
          </section>

          <section className="appearance-control-group" aria-labelledby="appearance-mode-title">
            <div><h3 id="appearance-mode-title">Darstellung</h3><p>Hell, dunkel oder passend zum Gerätemodus.</p></div>
            <SegmentedRadio id="appearance-mode" label="Darstellung" onChange={setMode} options={modeOptions} value={mode} />
          </section>

          {source === 'browser' ? (
            <SourceContent>
              <span className="appearance-source-content__icon"><Icon name="system" /></span>
              <div><h3>System</h3><p>Verwendet den vom Browser bereitgestellten Akzent, falls verfügbar. Andernfalls nutzt die App ihr Standardtheme.</p></div>
            </SourceContent>
          ) : null}

          {source === 'preset' ? (
            <SourceContent>
              <span className="appearance-source-content__icon"><Icon name="palette" /></span>
              <div><h3>Andere Farben</h3><p>Kuratierte Material-You-Paletten mit abgestimmten hellen und dunklen Flächen.</p></div>
            </SourceContent>
          ) : null}

          {source === 'wallpaper' ? (
            <SourceContent>
              <span className="appearance-source-content__icon"><Icon name="image" /></span>
              <div className="wallpaper-controls">
                <h3>Hintergrundbild</h3>
                <p>Die Farben werden nur auf diesem Gerät berechnet. Das Originalbild wird weder hochgeladen noch dauerhaft gespeichert.</p>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Hintergrundbild auswählen"
                  className="appearance-file-input"
                  onChange={(event) => void onFileChange(event)}
                  ref={fileInputRef}
                  tabIndex={-1}
                  type="file"
                />
                <div className="wallpaper-actions">
                  <button className="secondary-action" disabled={analyzing} onClick={() => fileInputRef.current?.click()} type="button">
                    <Icon name="image" size={19} />{wallpaperUrl ? 'Bild ändern' : 'Bild auswählen'}
                  </button>
                  {wallpaperUrl ? <button className="secondary-action" disabled={analyzing} onClick={removeImage} type="button">Bild entfernen</button> : null}
                </div>
              </div>
            </SourceContent>
          ) : null}

          <div aria-live="polite" className="appearance-live-status" role="status">{analyzing ? 'Farben werden berechnet …' : status}</div>
          {error ? <p aria-live="assertive" className="appearance-error" role="alert">{error}</p> : null}

          <section className="appearance-source-picker" aria-labelledby="appearance-source-title">
            <div><h3 id="appearance-source-title">Farbquelle</h3><p>System, eigenes Bild oder kuratierte Farben.</p></div>
            <SegmentedRadio id="appearance-source" label="Farbquelle" onChange={chooseSource} options={sourceOptions} value={source} />
          </section>
        </div>
    </AdaptiveDialog>
  );
}
