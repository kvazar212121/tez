import { Routes, Route } from 'react-router-dom';
import { LocaleProvider } from './i18n/LocaleContext';
import TaxiApp from './TaxiApp';
import AdminPanel from './pages/AdminPanel';
import ModeratorPanel from './pages/ModeratorPanel';

export default function App() {
  return (
    <LocaleProvider>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/moderator" element={<ModeratorPanel />} />
        <Route path="/*" element={<TaxiApp />} />
      </Routes>
    </LocaleProvider>
  );
}
