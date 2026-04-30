import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoNexus from '../../assets/logo-nexus.svg';
import './LoginForm.css';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const navigate = useNavigate();
  const { login, user } = useAuth();
  useEffect(() => {
    if (user) {
      navigate(getDefaultRouteForRole(user.role));
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else {
      const atIndex = email.indexOf('@');
      if (atIndex === -1 || email.indexOf('.', atIndex) === -1) {
        newErrors.email = 'El email no es válido';
      }
    }
    if (!password) {
      newErrors.password = 'La contraseña es obligatoria';
    } else if (password.length < 6) {
      newErrors.password = 'Mínimo 6 caracteres';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    if (!validateForm()) return;
    setLoading(true);

    try {
      const result = await login(email, password, rememberMe);
      if (result.success) {
        navigate(getDefaultRouteForRole(user?.role || 'admin'));
      } else {
        setGeneralError(result.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error(error);
      setGeneralError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-panel-brand">
        <div className="brand-content">
          <div className="brand-logo-container">
            <img
              src={logoNexus}
              alt="NexusAI Logo"
              className="brand-logo-image"
            />
          </div>
          <h2 className="brand-title">
            Gestiona tu pipeline
            <br />
            de reclutamiento
          </h2>
        </div>

        <div className="brand-footer">
          <p className="brand-desc">
            CRM inteligente para comerciales que captura y gestiona
            oportunidades automáticamente
          </p>
          <div className="brand-stats">
            <div className="stat-card">
              <h3>2.5K+</h3>
              <p>Vacantes</p>
            </div>
            <div className="stat-card">
              <h3>150+</h3>
              <p>Empresas</p>
            </div>
            <div className="stat-card">
              <h3>98%</h3>
              <p>Éxito</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-panel-form">
        <div className="form-container">
          <div className="form-header">
            <h1>Bienvenido de vuelta</h1>
            <p>Ingresa tus credenciales para continuar</p>
          </div>

          {generalError && (
            <div className="form-general-error">{generalError}</div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {/* Campo Email */}
            <div className="form-group">
              <label>Email</label>
              <div className={`input-wrapper ${errors.email ? 'error' : ''}`}>
                <i className="bi bi-envelope input-icon"></i>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError('email');
                  }}
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <span className="error-text">{errors.email}</span>
              )}
            </div>

            {/* Campo Contraseña */}
            <div className="form-group">
              <label>Contraseña</label>
              <div
                className={`input-wrapper ${errors.password ? 'error' : ''}`}
              >
                <i className="bi bi-lock input-icon"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError('password');
                  }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  <i
                    className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}
                  ></i>
                </button>
              </div>
              {errors.password && (
                <span className="error-text">{errors.password}</span>
              )}
            </div>

            {/* Opciones extra */}
            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Recordarme
              </label>

              <a href="#" className="forgot-password">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            {/* Botón principal */}
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Cargando...' : 'Entrar'}
            </button>
          </form>

          <div className="form-footer" style={{ marginTop: '3rem' }}>
            <a href="#">Términos</a>
            <a href="#">Privacidad</a>
            <a href="#">Ayuda</a>
          </div>
        </div>
      </div>
    </div>
  );
}

const getDefaultRouteForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'hr_manager':
      return '/candidates';
    case 'company':
      return '/clientes';
    default:
      return '/';
  }
};
