/**
 * Honesty badges: data provenance (LIVE / CACHED / REPLAY), validation state,
 * verification scope and the attribution footer required by the data license.
 */

const MODE_STYLES = {
  LIVE: {
    label: 'LIVE',
    dot: 'bg-emerald-500 animate-pulse',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    title: 'Fresh data fetched from Open-Meteo for this request',
  },
  CACHED: {
    label: 'CACHED',
    dot: 'bg-amber-500',
    cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    title: 'Network fetch failed; serving the backend SQLite cache (stale but real data)',
  },
  REPLAY: {
    label: 'REPLAY',
    dot: 'bg-blue-500',
    cls: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    title: 'No live or cached data; serving the archived benchmark cycle (not a current forecast)',
  },
};

export function DataModeBadge({ mode, size = 'sm' }) {
  const s = MODE_STYLES[mode];
  if (!s) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 font-data font-bold text-[10px] uppercase text-[var(--color-text-tertiary)] ${
          size === 'lg' ? 'text-[11px] px-2.5 py-1' : ''
        }`}
        title="No backend response received yet"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        API STANDBY
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 font-data font-bold uppercase ${s.cls} ${
        size === 'lg' ? 'text-[11px] px-2.5 py-1' : 'text-[10px] px-2 py-0.5'
      }`}
      title={s.title}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/** validated=true only when the backend says a trained meta-model backs this. */
export function ValidatedBadge({ validated, scopeNote }) {
  return validated ? (
    <span
      className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 font-data uppercase"
      title="Blend weighting backed by the held-out benchmarked meta-model"
    >
      ✓ Validated
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 font-data uppercase"
      title={scopeNote || 'Unvalidated: no trained meta-model for this variable yet (equal fallback weights, skill not benchmarked)'}
    >
      ⚠ Unvalidated
    </span>
  );
}

/** Verification scope chip, e.g. held_out_test vs full_dataset_all_splits. */
export function ScopeBadge({ scope }) {
  if (!scope) return null;
  const label = String(scope).replace(/_/g, ' ');
  return (
    <span
      className="inline-flex items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-secondary)] font-data uppercase"
      title={
        scope === 'held_out_test'
          ? 'Chronologically last 20% of the dataset (Post-Monsoon season) — never used in training'
          : 'All three chronological splits combined; descriptive, not headline skill'
      }
    >
      {label}
    </span>
  );
}

/** Attribution footer mandated by the Open-Meteo / ERA5 data licences. */
export function AttributionFooter({ attribution, note, className = '' }) {
  return (
    <div
      className={`border-t border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2 text-[10px] leading-snug text-[var(--color-text-tertiary)] font-data transition-colors ${className}`}
    >
      {attribution || 'Data: Open-Meteo (CC BY 4.0), ECMWF, NOAA, DWD.'}
      {note ? <span className="ml-2">{note}</span> : null}
    </div>
  );
}
