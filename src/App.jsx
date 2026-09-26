import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/Landing';
import CommandCentre from './pages/CommandCentre';
import Forecast from './pages/Forecast';
import Models from './pages/Models';
import Skill from './pages/Skill';
import Extremes from './pages/Extremes';
import Explainability from './pages/Explainability';
import SystemHealth from './pages/SystemHealth';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Application Shell Workspace */}
        <Route element={<AppLayout />}>
          <Route path="/command-centre" element={<CommandCentre />} />
          <Route path="/dashboard" element={<CommandCentre />} />
          <Route path="/map" element={<CommandCentre />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/models" element={<Models />} />
          <Route path="/skill" element={<Skill />} />
          <Route path="/extremes" element={<Extremes />} />
          <Route path="/explainability" element={<Explainability />} />
          <Route path="/system" element={<SystemHealth />} />
          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/command-centre" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
