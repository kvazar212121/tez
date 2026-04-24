import { Car, User } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleContext';
import './ProfileButton.css';

export default function ProfileButton({ role, onClick }) {
  const { t } = useLocale();
  const Icon = role === 'driver' ? Car : User;
  return (
    <button type="button" className="profile-btn" onClick={onClick} aria-label={t('profileBtn.aria')}>
      <Icon className="profile-btn__icon" strokeWidth={2.25} size={22} aria-hidden />
    </button>
  );
}
