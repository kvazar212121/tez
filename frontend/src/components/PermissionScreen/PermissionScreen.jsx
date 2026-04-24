import { AlertTriangle, MapPin } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './PermissionScreen.css';

export default function PermissionScreen({ onRequestGPS, gpsError }) {
  const { t } = useLocale();

  return (
    <div className="permission-screen">
      <div className="permission-screen__icon" aria-hidden>
        <MapPin className="permission-screen__icon-svg" strokeWidth={2} size={44} />
      </div>
      <h1 className="permission-screen__title">{t('permission.title')}</h1>
      <p className="permission-screen__text">{t('permission.text')}</p>
      <ButtonPrimary onClick={onRequestGPS}>{t('permission.cta')}</ButtonPrimary>
      {gpsError ? (
        <p className="permission-screen__error">
          <AlertTriangle className="permission-screen__error-icon" strokeWidth={2} size={18} aria-hidden />
          {t('gps.denied')}
        </p>
      ) : null}
    </div>
  );
}
