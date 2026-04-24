import { ChevronLeft } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './DriverRegistration.css';

export default function DriverRegistration({ driverData, onDriverDataChange, onSubmit, onBack }) {
  const { t } = useLocale();
  const handleChange = (field) => (e) => {
    onDriverDataChange((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="registration-container">
      <div className="header-small">
        <button type="button" className="back-btn" onClick={onBack} aria-label={t('reg.back')}>
          <ChevronLeft strokeWidth={2.25} size={26} aria-hidden />
        </button>
        <h2>{t('reg.title')}</h2>
      </div>

      <form className="registration-form" onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="reg-fullname">{t('reg.fullName')}</label>
          <input
            id="reg-fullname"
            type="text"
            value={driverData.fullName}
            onChange={handleChange('fullName')}
            placeholder={t('reg.fullNamePh')}
          />
        </div>

        <div className="form-group">
          <label htmlFor="reg-phone">{t('reg.phone')}</label>
          <input
            id="reg-phone"
            type="tel"
            value={driverData.phone}
            onChange={handleChange('phone')}
            placeholder={t('reg.phonePh')}
            maxLength={32}
          />
        </div>

        <div className="reg-card">
          <h4>{t('reg.carBlock')}</h4>
          <div className="form-group">
            <input
              type="text"
              placeholder={t('reg.carModelPh')}
              value={driverData.carModel}
              onChange={handleChange('carModel')}
            />
          </div>
          <div className="form-group">
            <input
              type="text"
              placeholder={t('reg.carNumberPh')}
              value={driverData.carNumber}
              onChange={handleChange('carNumber')}
            />
          </div>
        </div>

        <div className="form-group form-group--spaced">
          <label htmlFor="reg-license">{t('reg.license')}</label>
          <input
            id="reg-license"
            type="text"
            placeholder={t('reg.licensePh')}
            value={driverData.licenseNumber}
            onChange={handleChange('licenseNumber')}
          />
        </div>

        <ButtonPrimary type="submit">{t('reg.submit')}</ButtonPrimary>
      </form>
    </div>
  );
}
