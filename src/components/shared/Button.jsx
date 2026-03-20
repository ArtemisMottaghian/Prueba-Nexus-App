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
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    outline: 'btn-outline-secondary',
    ghost: 'btn-link text-decoration-none',
  };

  const sizeClass = size ? `btn-${size}` : '';
  const variantClass = variants[variant] || 'btn-primary';

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
