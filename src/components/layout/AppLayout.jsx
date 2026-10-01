import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import NavDrawer from './NavDrawer';
import TopBar from './TopBar';
import ForecastDetailDrawer from '../shared/ForecastDetailDrawer';

export default function AppLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--varuna-bg)] text-[var(--varuna-text)] transition-colors font-sans">
      {/* Compact Top Bar with Menu Trigger */}
      <TopBar />

      {/* Main Workspace Area (Full width, no permanent sidebar) */}
      <div className="flex flex-1 min-h-0 relative">
        <main className="flex-1 min-w-0 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Left Navigation Popup Drawer */}
      <NavDrawer />

      {/* Right Forecast Details Drawer */}
      <ForecastDetailDrawer />
    </div>
  );
}
