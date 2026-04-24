import { useState } from 'react';
import { useLocale } from '../../i18n/LocaleContext';
import DriverRouteQuickModal from './DriverRouteQuickModal';
import './DriverRouteCompact.css';

export default function DriverRouteCompact({
  driverData,
  onDriverServiceChange,
  activityOn = true,
  onToggleActivity,
}) {
  const { t } = useLocale();
  const [modalOpen, setModalOpen] = useState(false);

  const onBoard = Math.min(8, Math.max(0, Number(driverData?.passengersOnBoard) || 0));

  return (
    <div className="driver-route-compact">
      <div className="driver-route-compact__boarding">
        <label className="driver-route-compact__boarding-label" htmlFor="drv-onboard">
          {t('compact.boarding')}
        </label>
        <select
          id="drv-onboard"
          className="driver-route-compact__select"
          value={String(onBoard)}
          onChange={(e) =>
            onDriverServiceChange({ passengersOnBoard: Number(e.target.value) || 0 })
          }
        >
          <option value="0">{t('compact.empty')}</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={n}>
              {t('compact.people', { n })}
            </option>
          ))}
        </select>
      </div>

      <div className="driver-route-compact__actions-row">
        <button type="button" className="driver-route-compact__open-modal" onClick={() => setModalOpen(true)}>
          {t('compact.openModal')}
        </button>
        <label className="driver-route-compact__activity">
          <span className="driver-route-compact__activity-text">{t('compact.activity')}</span>
          <span className="driver-route-compact__switch-wrap">
            <input
              type="checkbox"
              role="switch"
              className="driver-route-compact__switch-input"
              checked={activityOn}
              onChange={onToggleActivity}
              aria-checked={activityOn}
              aria-label={activityOn ? t('compact.activityOn') : t('compact.activityOff')}
            />
            <span className="driver-route-compact__switch-ui" aria-hidden />
          </span>
        </label>
      </div>

      {modalOpen && (
        <DriverRouteQuickModal
          driverData={driverData}
          onDriverServiceChange={onDriverServiceChange}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
