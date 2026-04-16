// ============================================
// LoginForm.jsx
// Formulario de login con validación y Google OAuth
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  const [searchParams] = useSearchParams();

  // Si el usuario ya está autenticado, redirigir
  useEffect(() => {
    if (user) {
      navigate(getDefaultRouteForRole(user.role));
    }
  }, [user, navigate]);

  // Manejar callback de Google OAuth
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.location.href = '/'; // Recargar para actualizar el contexto
    }
  }, [searchParams]);

  /**
   * Validar campos del formulario
   */
  const validateForm = () => {
    const newErrors = {};

    // Validar email
    if (!email.trim()) {
      newErrors.email = 'El email es obligatorio';
    } else {
      const atIndex = email.indexOf('@');
      if (atIndex === -1 || email.indexOf('.', atIndex) === -1) {
        newErrors.email = 'El email no es válido (ej. tu@email.com)';
      }
    }

    // Validar contraseña
    if (!password) {
      newErrors.password = 'La contraseña es obligatoria';
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'La contraseña debe contener al menos una mayúscula';
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = 'La contraseña debe contener al menos un número';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Manejar envío del formulario
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    // Validar formulario
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const result = await login(email, password, rememberMe);

      if (result.success) {
        // Login exitoso, redirigir
        navigate(getDefaultRouteForRole(user?.role || 'admin'));
      } else {
        // Error de autenticación
        setGeneralError(result.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Error durante el login:', error);
      setGeneralError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Manejar login con Google (eliminado)
   */

  /**
   * Limpiar error de un campo específico
   */
  const clearError = (field) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <div className="login-wrapper">
      {/* Fondo con orbes y cuadrícula */}
      <div className="login-bg">
        <div className="login-bg__orb login-bg__orb--1" />
        <div className="login-bg__orb login-bg__orb--2" />
        <div className="login-bg__grid" />
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-card__logo">
          <svg
            className="login-card__logo-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="login-card__logo-text">
            Nexus<span className="login-card__logo-accent">AI</span>
          </span>
        </div>

        {/* Encabezado */}
        <div className="login-card__header">
          <h1 className="login-card__title">Bienvenido</h1>
          <p className="login-card__subtitle">Accede a tu panel de control</p>
        </div>

        {/* Error general */}
        {generalError && (
          <div className="login-form__general-error">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
              <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
            </svg>
            {generalError}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Campo Email */}
          <div className="login-form__group">
            <label className="login-form__label">Email</label>
            <div
              className={`login-form__input-wrapper ${errors.email ? 'login-form__input-wrapper--error' : ''}`}
            >
              <svg
                className="login-form__input-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <input
                className={`login-form__input ${errors.email ? 'login-form__input--error' : ''}`}
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError('email');
                  setGeneralError('');
                }}
                disabled={loading}
              />
            </div>
            {errors.email && (
              <p className="login-form__error">
                <svg
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                </svg>
                {errors.email}
              </p>
            )}
          </div>

          {/* Campo Password */}
          <div className="login-form__group">
            <label className="login-form__label">Contraseña</label>
            <div
              className={`login-form__input-wrapper ${errors.password ? 'login-form__input-wrapper--error' : ''}`}
            >
              <svg
                className="login-form__input-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <input
                className={`login-form__input login-form__input--password ${errors.password ? 'login-form__input--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError('password');
                  setGeneralError('');
                }}
                disabled={loading}
              />
              <button
                type="button"
                className="login-form__eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                tabIndex={-1}
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                {showPassword ? (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="login-form__error">
                <svg
                  width="14"
                  height="14"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                </svg>
                {errors.password}
              </p>
            )}
          </div>

          {/* Recordarme */}
          <div className="login-form__meta">
            <label className="login-form__remember">
              <input
                type="checkbox"
                className="login-form__checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              Recordarme
            </label>
          </div>

          {/* Botón de Iniciar Sesión */}
          <button
            className="login-form__submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                />
                <span>Entrando...</span>
              </>
            ) : (
              <span>Entrar</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-card__footer">
          © 2026 NexusAI. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
}

/**
 * Obtiene la ruta por defecto según el rol del usuario
 */
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
