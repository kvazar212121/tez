import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './BottomOverlay.css';

export default function BottomOverlay({
  title,
  subtitle,
  actionLabel,
  onEditOrder,
  editOrderLabel,
  driverSlot,
  onPrimaryAction,
}) {
  return (
    <div className="ui-overlay">
      <div className="ui-overlay__text">
        <h2 className="ui-overlay__title">{title}</h2>
        <p className="ui-overlay__subtitle">{subtitle}</p>
      </div>
      {driverSlot}
      {onEditOrder && (
        <button type="button" className="ui-overlay__order-btn" onClick={onEditOrder}>
          {editOrderLabel || 'Buyurtma ma’lumotlari'}
        </button>
      )}
      {typeof onPrimaryAction === 'function' && (
        <ButtonPrimary type="button" onClick={onPrimaryAction}>
          {actionLabel}
        </ButtonPrimary>
      )}
    </div>
  );
}
