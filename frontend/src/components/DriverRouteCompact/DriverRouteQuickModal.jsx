import { useLocale } from '../../i18n/LocaleContext';
import DriverServiceSettings from '../DriverServiceSettings/DriverServiceSettings';
import './DriverRouteQuickModal.css';

export default function DriverRouteQuickModal({ driverData, onDriverServiceChange, onClose }) {
  const { t } = useLocale();

  return (
    <div className="driver-route-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="driver-route-modal"
        role="dialog"
        aria-labelledby="driver-route-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="driver-route-modal__head">
          <h2 id="driver-route-modal-title" className="driver-route-modal__title">
            {t('routeModal.title')}
          </h2>
          <button type="button" className="driver-route-modal__close" onClick={onClose} aria-label={t('routeModal.close')}>
            ×
          </button>
        </div>

        <div className="driver-route-modal__body">
          <DriverServiceSettings
            variant="full"
            embeddedInModal
            idPrefix="dqm-"
            driverData={driverData}
            onDriverServiceChange={onDriverServiceChange}
          />
        </div>

        <button type="button" className="driver-route-modal__done" onClick={onClose}>
          {t('routeModal.done')}
        </button>
      </div>
    </div>
  );
}
