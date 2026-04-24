import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import './StatusBadge.css';

export default function StatusBadge({ status }) {
  const { t } = useLocale();
  const label =
    status === 'online'
      ? t('status.online')
      : status === 'connecting'
        ? t('status.connecting')
        : t('status.offline');

  const icon =
    status === 'online' ? (
      <Wifi className="status-badge__icon status-badge__icon--online" strokeWidth={2} size={16} aria-hidden />
    ) : status === 'connecting' ? (
      <Loader2 className="status-badge__icon status-badge__icon--spin" strokeWidth={2} size={16} aria-hidden />
    ) : (
      <WifiOff className="status-badge__icon status-badge__icon--offline" strokeWidth={2} size={16} aria-hidden />
    );

  return (
    <div className="status-badge">
      {icon}
      {label}
    </div>
  );
}
