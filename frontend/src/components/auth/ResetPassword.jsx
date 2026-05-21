import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ENDPOINTS } from '../../services/api';
import logoNexus from '../../assets/logo-nexus.svg';
import './LoginForm.css';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [pwd, setPwd] = useState({ next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setPwd((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Enlace inválido. Solicita un nuevo enlace de recuperación.');
      return;
    }
    if (pwd.next.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(ENDPOINTS.auth.resetPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: pwd.next }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'El enlace ha expirado o es inválido. Solicita uno nuevo.');
      }
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
            Crea una nueva
            <br />
            contraseña segura
          </h2>
        </div>
        <div className="brand-footer">
          <p className="brand-desc">
            Elige una contraseña fuerte para proteger tu cuenta en Nexus.
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
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <i
                className="bi bi-check-circle-fill"
                style={{ fontSize: '3rem', color: '#10b981', display: 'block', marginBottom: '1rem' }}
              />
              <h1
                style={{
                  color: '#111827',
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                }}
              >
                Contraseña actualizada
              </h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Tu contraseña ha sido cambiada correctamente. Redirigiendo al inicio de sesión…
              </p>
              <Link
                to="/login"
                className="submit-btn"
                style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="form-header">
                <h1>Nueva contraseña</h1>
                <p>Introduce y confirma tu nueva contraseña</p>
              </div>

              {error && <div className="form-general-error">{error}</div>}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                  <label>Nueva contraseña</label>
                  <div className="input-wrapper">
                    <i className="bi bi-lock input-icon" />
                    <input
                      name="next"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Mín. 6 caracteres"
                      value={pwd.next}
                      onChange={handleChange}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowPwd((v) => !v)}
                      tabIndex="-1"
                    >
                      <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`} />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirmar contraseña</label>
                  <div className="input-wrapper">
                    <i className="bi bi-lock-fill input-icon" />
                    <input
                      name="confirm"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Repite la nueva contraseña"
                      value={pwd.confirm}
                      onChange={handleChange}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading || !token}
                  style={{ marginBottom: '1rem' }}
                >
                  {loading ? 'Guardando...' : 'Establecer contraseña'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/forgot-password" className="forgot-password">
                  <i className="bi bi-arrow-left me-1" />
                  Solicitar nuevo enlace
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
