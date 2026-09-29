import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ForecastDetailDrawer from '../shared/ForecastDetailDrawer';
import { AttributionFooter } from '../shared/Badges';
import { useStore } from '../../store/useStore';

export default function AppLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const attribution = useStore((s) => s.attribution);
  const dataMode = useStore((s) => s.dataMode);
  const loadRegions = useStore((s) => s.loadRegions);

  // Regions (with validated/benchmarked flags) are shared by every page.
  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,197,24,0.06),_transparent_30%),var(--color-surface)] text-[var(--color-text-primary)] transition-colors">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 relative overflow-hidden pb-14 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Attribution footer (hidden on mobile where the bottom nav sits) */}
      <AttributionFooter
        attribution={attribution}
        note={`Data mode: ${dataMode || '—'} · IMD station ingestion: integration pending · ERA5 is a reanalysis reference, not ground truth`}
        className="hidden md:block shrink-0"
      />
      <ForecastDetailDrawer />
    </div>
  );
}
