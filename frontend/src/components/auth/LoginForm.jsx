import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LoginForm.css';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setCargando(true);

    // Simulación de validación y carga de 800ms para que se vea el spinner
    setTimeout(() => {
      // Guardamos el token falso para que ProtectedRoute nos deje pasar
      localStorage.setItem('token', 'token-demo-nexus-2024');

      // Redirigimos al Dashboard principal
      navigate('/');

      setCargando(false);
    }, 800);
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
        <div className="login-card__logo">
          <span className="login-card__logo-text">
            Nexus<span className="login-card__logo-accent">AI</span>
          </span>
        </div>

        <div className="login-card__header">
          <h1 className="login-card__title">Bienvenido</h1>
          <p className="login-card__subtitle">Accede a tu panel de control</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Campo Email */}
          <div className="login-form__group">
            <label className="login-form__label">Email</label>
            <div className="login-form__input-wrapper">
              <i className="bi bi-envelope login-form__input-icon"></i>
              <input
                className="login-form__input"
                type="email"
                placeholder="demo@nexusai.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Campo Password */}
          <div className="login-form__group">
            <label className="login-form__label">Contraseña</label>
            <div className="login-form__input-wrapper">
              <i className="bi bi-lock login-form__input-icon"></i>
              <input
                className="login-form__input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Botón de Iniciar Sesión */}
          <button
            className="login-form__submit"
            type="submit"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                ></span>
                <span>Entrando...</span>
              </>
            ) : (
              <>
                <span>Iniciar sesión</span>
                <i className="bi bi-arrow-right-short ms-1"></i>
              </>
            )}
          </button>
        </form>

        <div className="login-card__footer">
          Modo Demo: Haz clic en Iniciar Sesión para entrar.
        </div>
      </div>
    </div>
  );
}