import { useLocale } from '../../i18n/LocaleContext';
import './LanguageToggle.css';

/** Kichik ekranda ham yo‘qolmaydigan bitta til tugmasi: boshqa til kodini ko‘rsatadi */
export default function LanguageToggle() {
  const { locale, toggleLocale, t } = useLocale();
  const showCode = locale === 'uz' ? 'RU' : 'UZ';
  const aria =
    locale === 'uz' ? t('lang.switch.aria.ru') : t('lang.switch.aria.uz');

  return (
    <button
      type="button"
      className="language-toggle"
      onClick={toggleLocale}
      aria-label={aria}
      title={aria}
    >
      {showCode}
    </button>
  );
}
