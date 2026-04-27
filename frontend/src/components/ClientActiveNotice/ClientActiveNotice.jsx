import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './ClientActiveNotice.css';

export default function ClientActiveNotice({ onDismiss }) {
  return (
    <div className="client-active-notice-overlay" role="dialog" aria-modal="true">
      <div className="client-active-notice-modal">
        <div className="client-active-notice__icon">📢</div>
        <h3 className="client-active-notice__title">Eʼloningiz faollashtirildi</h3>
        <div className="client-active-notice__text">
          <p>Taksilar sizga telefon qilishini kuting.</p>
          <p>Taksi bilan gaplashib kelishib olganingizdan soʻng, eʼloningizni oʻchirib qoʻyishni unutmang.</p>
          <p style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
            Siz xaritadan oʻzingizga yaqin taksilarga telefon qilishingiz ham mumkin.
          </p>
        </div>
        <div className="client-active-notice__actions">
          <ButtonPrimary type="button" onClick={onDismiss} style={{ padding: '10px 24px' }}>
            Tushundim
          </ButtonPrimary>
        </div>
        <div className="client-active-notice__footer">
          <span className="client-active-notice__dot" /> Kutilmoqda...
        </div>
      </div>
    </div>
  );
}
