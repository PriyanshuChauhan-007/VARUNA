import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ForecastDetailDrawer from '../shared/ForecastDetailDrawer';

export default function AppLayout() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

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
      <ForecastDetailDrawer />
    </div>
  );
}
