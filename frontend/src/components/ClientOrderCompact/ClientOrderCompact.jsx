import { useLocale } from '../../i18n/LocaleContext';
import './ClientOrderCompact.css';

export default function ClientOrderCompact({
  isActive = true,
  onToggleActive,
}) {
  const { t } = useLocale();

  return (
    <div className="client-order-compact">
      <label className="client-order-compact__activity">
        <span className="client-order-compact__activity-text">
          {isActive ? 'Eʼlon faol' : 'Eʼlon oʻchiq'}
        </span>
        <span className="client-order-compact__switch-wrap">
          <input
            type="checkbox"
            role="switch"
            className="client-order-compact__switch-input"
            checked={isActive}
            onChange={onToggleActive}
            aria-checked={isActive}
            aria-label={isActive ? 'Eʼlonni oʻchirish' : 'Eʼlonni faollashtirish'}
          />
          <span className="client-order-compact__switch-ui" aria-hidden />
        </span>
      </label>
    </div>
  );
}
