import AppLayout from './components/AppLayout/AppLayout';
import { useTaxiAppState } from './hooks/useTaxiAppState';

export default function TaxiApp() {
  const state = useTaxiAppState();
  return <AppLayout {...state} />;
}
