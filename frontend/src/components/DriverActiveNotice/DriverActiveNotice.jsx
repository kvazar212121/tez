import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './DriverActiveNotice.css';

export default function DriverActiveNotice({ onDismiss }) {
  return (
    <div className="driver-active-notice-overlay" role="dialog" aria-modal="true">
      <div className="driver-active-notice-modal">
        <div className="driver-active-notice__icon">🚖</div>
        <h3 className="driver-active-notice__title">Faoliyat yoqildi</h3>
        <div className="driver-active-notice__text">
          <p>Endi siz xaritada mijozlarga oʻzingiz koʻrsatgan yoʻnalish boʻyicha koʻrinasiz.</p>
          <p>Mijozlar sizga telefon qilishini kuting.</p>
          <p style={{ marginTop: 12, fontWeight: 700, color: '#f59e0b' }}>
            Mashinangiz toʻlgandan soʻng faoliyatni oʻchirib qoʻyishni unutmang!
          </p>
        </div>
        <div className="driver-active-notice__actions">
          <ButtonPrimary type="button" onClick={onDismiss} style={{ padding: '10px 24px' }}>
            Tushundim
          </ButtonPrimary>
        </div>
        <div className="driver-active-notice__footer">
          <span className="driver-active-notice__dot" /> Mijozlar qidirilmoqda...
        </div>
      </div>
    </div>
  );
}
