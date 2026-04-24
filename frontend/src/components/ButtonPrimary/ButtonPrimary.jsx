import './ButtonPrimary.css';

export default function ButtonPrimary({ children, type = 'button', className = '', ...props }) {
  return (
    <button type={type} className={['btn-primary', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  );
}
