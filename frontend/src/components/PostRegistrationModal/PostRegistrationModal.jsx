import { Sparkles } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './PostRegistrationModal.css';

export default function PostRegistrationModal({ onDismiss }) {
  const { t } = useLocale();

  return (
    <div className="post-reg-overlay" role="dialog" aria-modal="true" aria-labelledby="post-reg-title">
      <div className="post-reg-modal">
        <div className="post-reg-modal__title-row">
          <span className="post-reg-modal__title-icon" aria-hidden>
            <Sparkles strokeWidth={2} size={22} />
          </span>
          <h2 id="post-reg-title" className="post-reg-modal__title">
            {t('postReg.title')}
          </h2>
        </div>
        <p className="post-reg-modal__text">{t('postReg.text')}</p>
        <ButtonPrimary type="button" onClick={onDismiss}>
          {t('postReg.ok')}
        </ButtonPrimary>
      </div>
    </div>
  );
}
