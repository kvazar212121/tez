import { Car, User } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import './RoleModal.css';

export default function RoleModal({ onSelectRole }) {
  const { t } = useLocale();

  return (
    <div className="modal-overlay">
      <div className="role-modal">
        <h2 className="role-modal__title">{t('role.welcome')}</h2>
        <button type="button" className="role-card" onClick={() => onSelectRole('client')}>
          <div className="role-card__icon" aria-hidden>
            <User className="role-card__icon-svg" strokeWidth={2} size={28} />
          </div>
          <div>
            <h3 className="role-card__heading">{t('role.client')}</h3>
            <p className="role-card__hint">{t('role.clientHint')}</p>
          </div>
        </button>
        <button type="button" className="role-card" onClick={() => onSelectRole('driver')}>
          <div className="role-card__icon" aria-hidden>
            <Car className="role-card__icon-svg" strokeWidth={2} size={28} />
          </div>
          <div>
            <h3 className="role-card__heading">{t('role.driver')}</h3>
            <p className="role-card__hint">{t('role.driverHint')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
