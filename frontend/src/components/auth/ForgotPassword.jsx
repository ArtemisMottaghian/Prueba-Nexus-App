import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ENDPOINTS } from '../../services/api';
import logoNexus from '../../assets/logo-nexus.svg';
import './LoginForm.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Introduce tu correo electrónico.');
      return;
    }
    setLoading(true);
    try {
      await fetch(ENDPOINTS.auth.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-panel-brand">
        <div className="brand-content">
          <div className="brand-logo-container">
            <img src={logoNexus} alt="NexusAI Logo" className="brand-logo-image" />
          </div>
          <h2 className="brand-title">
            Recupera tu acceso
            <br />a Nexus
          </h2>
        </div>
        <div className="brand-footer">
          <p className="brand-desc">
            Te enviaremos un enlace seguro para restablecer tu contraseña.
          </p>
          <div className="brand-stats">
            <div className="stat-card">
              <h3>JWT</h3>
              <p>Cifrado</p>
            </div>
            <div className="stat-card">
              <h3>30m</h3>
              <p>Válido</p>
            </div>
            <div className="stat-card">
              <h3>bcrypt</h3>
              <p>Seguro</p>
            </div>
          </div>
        </div>
      </div>

      <div className="login-panel-form">
        <div className="form-container">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <i
                className="bi bi-envelope-check-fill"
                style={{ fontSize: '3rem', color: '#7c3aed', display: 'block', marginBottom: '1rem' }}
              />
              <h1
                style={{
                  color: '#111827',
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                }}
              >
                Revisa tu email
              </h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Si el correo está registrado en Nexus, recibirás un enlace para restablecer tu
                contraseña en los próximos minutos.
              </p>
              <Link
                to="/login"
                className="submit-btn"
                style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="form-header">
                <h1>¿Olvidaste tu contraseña?</h1>
                <p>Introduce tu email y te enviaremos un enlace de recuperación</p>
              </div>

              {error && <div className="form-general-error">{error}</div>}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label>Email</label>
                  <div className="input-wrapper">
                    <i className="bi bi-envelope input-icon" />
                    <input
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                  style={{ marginBottom: '1rem' }}
                >
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/login" className="forgot-password">
                  <i className="bi bi-arrow-left me-1" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}

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
