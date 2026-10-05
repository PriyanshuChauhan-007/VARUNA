/** Shared loading / error / empty states used by every API-backed view. */

export function LoadingState({ label = 'Loading live data from the VARUNA API…' }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-14 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="w-7 h-7 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin" />
      <span className="text-scale-xs text-[var(--color-text-secondary)] font-medium">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, label = 'Data unavailable' }) {
  const message = error?.message || String(error || 'Unknown error');
  const modeTried = Array.isArray(error?.modeTried) ? error.modeTried : [];
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center"
      role="alert"
    >
      <span className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 flex items-center justify-center text-red-600 text-lg">
        !
      </span>
      <span className="text-scale-sm font-bold text-[var(--color-text-primary)]">{label}</span>
      <p className="text-scale-xs text-[var(--color-text-secondary)] max-w-md leading-relaxed">
        {message}
      </p>
      {modeTried.length > 0 && (
        <p className="font-data text-[10px] text-[var(--color-text-tertiary)]">
          Modes tried: {modeTried.join(' → ')}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-scale-xs font-bold bg-[var(--color-surface)] hover:bg-[var(--color-accent-subtle)] border border-[var(--color-border)] hover:border-amber-400 rounded-[var(--radius-md)] transition-all cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'Nothing to show', message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
      <span className="text-scale-sm font-bold text-[var(--color-text-primary)]">{title}</span>
      {message && (
        <p className="text-scale-xs text-[var(--color-text-secondary)] max-w-md leading-relaxed">
          {message}
        </p>
      )}
    </div>
  );
}
