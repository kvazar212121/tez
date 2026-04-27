import { Phone, Send, Map as MapIcon } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import { phoneHref, telegramHref } from '../../orderContactUtils';
import './OrderPopupContent.css';

function passengersOnBoardLabel(driverService, t) {
  const n = Number(driverService?.passengersOnBoard);
  const c = Number.isNaN(n) ? 0 : Math.min(8, Math.max(0, n));
  if (c === 0) return t('orderPopup.empty');
  return t('orderPopup.people', { n: c });
}

function formatLastSeen(lastSeenAt, t) {
  if (!lastSeenAt) return null;
  const diff = new Date() - new Date(lastSeenAt);
  if (diff < 60000) return <span className="status-online">{t('status.online') || 'Online'}</span>;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return <span className="status-offline">{t('status.minsAgo', { n: mins }) || `${mins} min oldin`}</span>;
  return <span className="status-offline">{t('status.offline') || 'Offline'}</span>;
}

export default function OrderPopupContent({ id, label, role, order, driverService, pos, lastSeenAt }) {
  const { t } = useLocale();

  if (role === 'driver') {
    return (
      <div className="order-popup">
        <div className="order-popup__header">
          <div className="order-popup__label">{label?.trim() ? label : t('orderPopup.taxi')}</div>
          <div className="order-popup__status">{formatLastSeen(lastSeenAt, t)}</div>
        </div>
        <div className="order-popup__row">
          <span className="order-popup__k">{t('orderPopup.inCar')}</span>
          <span>{passengersOnBoardLabel(driverService, t)}</span>
        </div>
        <small className="order-popup__id">{id}</small>
      </div>
    );
  }

  const o = order && typeof order === 'object' ? order : null;
  const ph = o ? phoneHref(o.phone) : null;
  const tg = o ? telegramHref(o.telegram) : null;

  return (
    <div className="order-popup">
      <div className="order-popup__header">
        {label && <div className="order-popup__label">{label}</div>}
        <div className="order-popup__status">{formatLastSeen(lastSeenAt, t)}</div>
      </div>

      {!o && <p className="order-popup__hint">{t('orderPopup.noOrder')}</p>}

      {o && (
        <>
          <div className="order-popup__row">
            <span className="order-popup__k">{t('orderPopup.from')}</span>
            <span>{o.from?.trim() || '—'}</span>
          </div>
          <div className="order-popup__row">
            <span className="order-popup__k">{t('orderPopup.to')}</span>
            <span>{o.to?.trim() || '—'}</span>
          </div>
          <div className="order-popup__row">
            <span className="order-popup__k">{t('orderPopup.when')}</span>
            <span>{o.when?.trim() || '—'}</span>
          </div>
          <div className="order-popup__row">
            <span className="order-popup__k">{t('orderPopup.price')}</span>
            <span>{o.price?.trim() || '—'}</span>
          </div>
          <div className="order-popup__row">
            <span className="order-popup__k">{t('orderPopup.passengers')}</span>
            <span>
              {(() => {
                const n = Number(o.passengerCount);
                if (n >= 1 && n <= 8) return t('orderPopup.people', { n });
                return t('orderPopup.people', { n: 1 });
              })()}
            </span>
          </div>
          {o.passengerNotes?.trim() ? (
            <div className="order-popup__row order-popup__row--notes">
              <span className="order-popup__k">{t('orderPopup.notes')}</span>
              <span className="order-popup__notes">{o.passengerNotes.trim()}</span>
            </div>
          ) : null}
          <div className="order-popup__contacts">
            {ph && (
              <a href={ph} className="order-popup__link">
                <Phone className="order-popup__link-icon" strokeWidth={2} size={15} aria-hidden />
                <span>{o.phone}</span>
              </a>
            )}
            {tg && (
              <a href={tg} className="order-popup__link" target="_blank" rel="noopener noreferrer">
                <Send className="order-popup__link-icon" strokeWidth={2} size={15} aria-hidden />
                <span>
                  {t('orderPopup.telegram')}{' '}
                  {String(o.telegram).trim().startsWith('@') ? o.telegram : `@${String(o.telegram).trim()}`}
                </span>
              </a>
            )}
            {!ph && !tg && <span className="order-popup__hint">{t('orderPopup.noContacts')}</span>}
          </div>
        </>
      )}
      {pos && pos.length === 2 && (
        <div className="order-popup__nav">
          <div className="order-popup__nav-title">
            <MapIcon size={14} strokeWidth={2.5} />
            {t('orderPopup.getDirections')}
          </div>
          <div className="order-popup__nav-links">
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${pos[0]},${pos[1]}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="order-popup__nav-btn order-popup__nav-btn--google"
            >
              {t('orderPopup.googleMaps')}
            </a>
            <a 
              href={`https://yandex.com/maps/?rtext=~${pos[0]},${pos[1]}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="order-popup__nav-btn order-popup__nav-btn--yandex"
            >
              {t('orderPopup.yandexMaps')}
            </a>
          </div>
        </div>
      )}
      <small className="order-popup__id">{id}</small>
    </div>
  );
}
