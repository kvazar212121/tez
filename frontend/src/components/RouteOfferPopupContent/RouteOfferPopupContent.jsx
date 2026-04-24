import { useState } from 'react';
import { Armchair, Car, Clock, MessageSquareText } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import './RouteOfferPopupContent.css';

export default function RouteOfferPopupContent({ offer }) {
  const { t } = useLocale();
  const [imgOk, setImgOk] = useState(true);
  if (!offer) return null;

  const model = offer.carModel || offer.carLabel || t('routeOffer.taxi');
  const photo = offer.carPhotoUrl;

  return (
    <div className="route-offer-popup">
      {photo && imgOk ? (
        <div className="route-offer-popup__media">
          <img
            className="route-offer-popup__img"
            src={photo}
            alt=""
            onError={() => setImgOk(false)}
          />
        </div>
      ) : (
        <div className="route-offer-popup__media route-offer-popup__media--placeholder" aria-hidden>
          <Car className="route-offer-popup__placeholder-car" strokeWidth={1.75} size={40} />
        </div>
      )}

      <div className="route-offer-popup__label">{t('routeOffer.free')}</div>
      <div className="route-offer-popup__car">{model}</div>

      {offer.description?.trim() ? (
        <div className="route-offer-popup__desc-block">
          <div className="route-offer-popup__desc-head">
            <MessageSquareText className="route-offer-popup__desc-icon" strokeWidth={2} size={14} aria-hidden />
            <span>{t('routeOffer.driverNote')}</span>
          </div>
          <p className="route-offer-popup__desc">{offer.description.trim()}</p>
        </div>
      ) : null}

      <div className="route-offer-popup__row">
        <Clock className="route-offer-popup__icon" strokeWidth={2} size={14} aria-hidden />
        <span>{offer.departureTime || '—'}</span>
      </div>
      <div className="route-offer-popup__row">
        <Armchair className="route-offer-popup__icon" strokeWidth={2} size={14} aria-hidden />
        <span>
          {t('routeOffer.seats', {
            free: offer.seatsFree ?? '—',
            total: offer.seatsTotal ?? '—',
          })}
        </span>
      </div>
      <p className="route-offer-popup__note">{t('routeOffer.note')}</p>
    </div>
  );
}
