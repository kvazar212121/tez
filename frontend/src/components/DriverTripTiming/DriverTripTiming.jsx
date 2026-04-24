import { useLocale } from '../../i18n/LocaleContext';
import './DriverTripTiming.css';

function nowLocalDatetimeValue() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DriverTripTiming({ driverData, onDriverServiceChange }) {
  const { t } = useLocale();
  const mode = driverData?.tripDepartureMode === 'scheduled' ? 'scheduled' : 'asap';
  const at = driverData?.tripDepartureAt || '';

  return (
    <div className="driver-trip-timing">
      <p className="driver-trip-timing__caption">{t('trip.caption')}</p>
      <div className="driver-trip-timing__modes" role="group" aria-label={t('trip.group')}>
        <button
          type="button"
          className={`driver-trip-timing__pill ${mode === 'asap' ? 'driver-trip-timing__pill--on' : ''}`}
          onClick={() => onDriverServiceChange({ tripDepartureMode: 'asap', tripDepartureAt: null })}
        >
          {t('trip.asap')}
        </button>
        <button
          type="button"
          className={`driver-trip-timing__pill ${mode === 'scheduled' ? 'driver-trip-timing__pill--on' : ''}`}
          onClick={() =>
            onDriverServiceChange({
              tripDepartureMode: 'scheduled',
              tripDepartureAt: at || nowLocalDatetimeValue(),
            })
          }
        >
          {t('trip.scheduled')}
        </button>
      </div>
      {mode === 'scheduled' && (
        <div className="driver-trip-timing__datetime">
          <label htmlFor="driver-trip-departure-at">{t('trip.datetime')}</label>
          <input
            id="driver-trip-departure-at"
            type="datetime-local"
            className="driver-trip-timing__input"
            min={nowLocalDatetimeValue()}
            value={at}
            onChange={(e) => {
              const v = e.target.value;
              onDriverServiceChange({
                tripDepartureMode: 'scheduled',
                tripDepartureAt: v || null,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
