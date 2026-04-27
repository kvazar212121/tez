import { useEffect, useState } from 'react';
import { Car, ChevronLeft, User } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { useLocale } from '../../i18n/LocaleContext';
import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import DriverServiceSettings from '../DriverServiceSettings/DriverServiceSettings';
import './ProfileScreen.css';

function fullImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

export default function ProfileScreen({
  role,
  driverData,
  driverDbId,
  onClose,
  onLogout,
  onDeleteAccount,
  onDriverProfileSync,
  telegramUser,
}) {
  const { t } = useLocale();
  const isDriver = role === 'driver';

  const [avatarFile, setAvatarFile] = useState(null);
  const [carPhotoFile, setCarPhotoFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [carPreview, setCarPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (carPreview) URL.revokeObjectURL(carPreview);
    };
  }, [avatarPreview, carPreview]);

  const onAvatarChange = (e) => {
    const f = e.target.files?.[0];
    setAvatarFile(f || null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(f ? URL.createObjectURL(f) : null);
  };

  const onCarChange = (e) => {
    const f = e.target.files?.[0];
    setCarPhotoFile(f || null);
    if (carPreview) URL.revokeObjectURL(carPreview);
    setCarPreview(f ? URL.createObjectURL(f) : null);
  };

  const handleSaveExtras = async (e) => {
    e.preventDefault();
    if (!driverDbId) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('originPlace', driverData.originPlace || '');
      if (avatarFile) fd.append('avatar', avatarFile);
      if (carPhotoFile) fd.append('carPhoto', carPhotoFile);
      const res = await fetch(`${API_BASE_URL}/api/drivers/${driverDbId}`, {
        method: 'PATCH',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || t('profile.saveFailed'));
      onDriverProfileSync({
        originPlace: data.originPlace || '',
        avatarUrl: data.avatarUrl,
        carPhotoUrl: data.carPhotoUrl,
      });
      setAvatarFile(null);
      setCarPhotoFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (carPreview) URL.revokeObjectURL(carPreview);
      setAvatarPreview(null);
      setCarPreview(null);
    } catch (err) {
      alert(err.message || t('profile.error'));
    } finally {
      setSaving(false);
    }
  };

  const avatarShown = avatarPreview || fullImageUrl(driverData.avatarUrl);
  const carShown = carPreview || fullImageUrl(driverData.carPhotoUrl);

  return (
    <div className="profile-screen">
      <div className="profile-screen__header">
        <h2 className="profile-screen__title">{t('profile.title')}</h2>
        <button type="button" className="profile-screen__close-btn" onClick={onClose} aria-label="Back">
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="profile-screen__scroll">
      <div className="profile-screen__badge" role="status">
        {isDriver ? (
          <Car className="profile-screen__badge-icon" strokeWidth={2} size={18} aria-hidden />
        ) : (
          <User className="profile-screen__badge-icon" strokeWidth={2} size={18} aria-hidden />
        )}
        <span>{isDriver ? t('profile.badge.driver') : t('profile.badge.client')}</span>
      </div>

      {isDriver ? (
        <>
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.name')}</div>
            <div className="profile-screen__value">{driverData.fullName || '—'}</div>
          </div>
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.phone')}</div>
            <div className="profile-screen__value">{driverData.phone || '—'}</div>
          </div>
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.car')}</div>
            <div className="profile-screen__value">{driverData.carModel || '—'}</div>
          </div>
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.plate')}</div>
            <div className="profile-screen__value">{driverData.carNumber || '—'}</div>
          </div>
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.license')}</div>
            <div className="profile-screen__value">{driverData.licenseNumber || '—'}</div>
          </div>
          {driverDbId != null && (
            <div className="profile-screen__row">
              <div className="profile-screen__label">{t('profile.id')}</div>
              <div className="profile-screen__value">#{driverDbId}</div>
            </div>
          )}

          <DriverServiceSettings driverData={driverData} onDriverServiceChange={onDriverProfileSync} />

          <form className="profile-screen__form" onSubmit={handleSaveExtras}>
            <h3 className="profile-screen__section-title">{t('profile.sectionPhotos')}</h3>

            <div className="profile-screen__field">
              <span className="profile-screen__label">{t('profile.avatar')}</span>
              <div className="profile-screen__photo-row">
                {avatarShown ? (
                  <img className="profile-screen__thumb" src={avatarShown} alt="" />
                ) : (
                  <div className="profile-screen__thumb profile-screen__thumb--empty">{t('profile.noPhoto')}</div>
                )}
                <label className="profile-screen__file-btn">
                  {t('profile.pickPhoto')}
                  <input type="file" accept="image/*" className="profile-screen__file-input" onChange={onAvatarChange} />
                </label>
              </div>
            </div>

            <div className="profile-screen__field">
              <span className="profile-screen__label">{t('profile.carPhoto')}</span>
              <div className="profile-screen__photo-row">
                {carShown ? (
                  <img className="profile-screen__thumb" src={carShown} alt="" />
                ) : (
                  <div className="profile-screen__thumb profile-screen__thumb--empty">{t('profile.noPhoto')}</div>
                )}
                <label className="profile-screen__file-btn">
                  {t('profile.pickPhoto')}
                  <input type="file" accept="image/*" className="profile-screen__file-input" onChange={onCarChange} />
                </label>
              </div>
            </div>

            <div className="profile-screen__field">
              <label className="profile-screen__label" htmlFor="origin-place">
                {t('profile.origin')}
              </label>
              <input
                id="origin-place"
                className="profile-screen__input"
                type="text"
                value={driverData.originPlace || ''}
                onChange={(e) => onDriverProfileSync({ originPlace: e.target.value })}
                placeholder={t('profile.originPh')}
                autoComplete="off"
              />
            </div>

            <ButtonPrimary type="submit" disabled={saving}>
              {saving ? t('profile.saving') : t('profile.save')}
            </ButtonPrimary>
          </form>
        </>
      ) : (
        <>
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.name')}</div>
            <div className="profile-screen__value">
              {telegramUser 
                ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || t('profile.client')
                : t('profile.client')}
            </div>
          </div>
          {telegramUser?.username && (
            <div className="profile-screen__row">
              <div className="profile-screen__label">Username</div>
              <div className="profile-screen__value">@{telegramUser.username}</div>
            </div>
          )}
          <div className="profile-screen__row">
            <div className="profile-screen__label">{t('profile.state')}</div>
            <div className="profile-screen__value">{t('profile.clientHint')}</div>
          </div>
          
          <div className="profile-screen__moderator-invite">
            <h3 className="profile-screen__moderator-title">Moderator boʻlishni xohlaysizmi?</h3>
            <p className="profile-screen__moderator-text">
              Siz taksislarni platformaga taklif qilish orqali daromad qilishingiz mumkin. 
              Taksislar sizning havolangiz orqali qoʻshilsa, siz ularga oylik toʻlov xizmatini 
              taklif qilib, moderatorlikni boshlashingiz mumkin.
            </p>
            <div className="profile-screen__moderator-link-box">
              https://t.me/yurtaxi_bot
            </div>
            <button 
              type="button" 
              className="profile-screen__moderator-btn"
              onClick={() => window.open('https://t.me/gvazar', '_blank')}
            >
              Moderatorlik uchun soʻrov yuborish
            </button>
          </div>
          
          <div className="profile-screen__mt-auto">
            <ButtonPrimary onClick={onClose}>
               {t('profile.backToHome')}
            </ButtonPrimary>
          </div>
        </>
      )}
      </div>

      <div className="profile-screen__actions">
        <button type="button" className="profile-screen__btn-logout" onClick={onLogout}>
          {t('profile.logout')}
        </button>
        {isDriver && driverDbId != null && onDeleteAccount && (
          <button type="button" className="profile-screen__btn-delete" onClick={onDeleteAccount}>
            {t('profile.delete')}
          </button>
        )}
      </div>
    </div>
  );
}
