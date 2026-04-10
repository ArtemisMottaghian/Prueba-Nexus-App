import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  size = '',
  icon,
  onClick,
  disabled = false,
  className = '',
}) {
  const variants = {
    primary: 'btn-primary-custom',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    outline: 'btn-outline-secondary',
    ghost: 'btn-link text-decoration-none',
    clear: 'btn-clear',
    icon: 'btn-icon',
    viewAll: 'btn-view-all',
  };

  const sizeClass = size ? `btn-${size}` : '';
  const variantClass = variants[variant] || 'btn-primary-custom';

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <i className={`bi bi-${icon} ${children ? 'me-2' : ''}`}></i>}
      {children}
    </button>
  );
}
