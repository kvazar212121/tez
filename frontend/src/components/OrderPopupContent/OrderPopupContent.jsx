import { Phone, Send } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import { phoneHref, telegramHref } from '../../orderContactUtils';
import './OrderPopupContent.css';

function passengersOnBoardLabel(driverService, t) {
  const n = Number(driverService?.passengersOnBoard);
  const c = Number.isNaN(n) ? 0 : Math.min(8, Math.max(0, n));
  if (c === 0) return t('orderPopup.empty');
  return t('orderPopup.people', { n: c });
}

export default function OrderPopupContent({ id, label, role, order, driverService }) {
  const { t } = useLocale();

  if (role === 'driver') {
    return (
      <div className="order-popup">
        <div className="order-popup__label">{label?.trim() ? label : t('orderPopup.taxi')}</div>
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
      {label && <div className="order-popup__label">{label}</div>}

      {!o && <p className="order-popup__hint">{t('orderPopup.noOrder')}</p>}

      {o && (
        <>
          <div className="order-popup__row">
            <span className="order-popup__k">{t('orderPopup.kind')}</span>
            <span>
              {o.orderKind === 'interregional' ? t('orderPopup.kindIr') : t('orderPopup.kindLocal')}
            </span>
          </div>
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
      <small className="order-popup__id">{id}</small>
    </div>
  );
}
