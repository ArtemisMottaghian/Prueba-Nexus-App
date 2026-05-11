import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import EmailIntegration from './EmailIntegration';
import './MiCuenta.css';

const ROLE_META = {
  admin: {
    label: 'Administrador',
    icon: 'bi-shield-lock-fill',
    color: 'role-admin',
  },
  hr_manager: {
    label: 'Reclutador',
    icon: 'bi-person-badge-fill',
    color: 'role-recruiter',
  },
  reclutador: {
    label: 'Reclutador',
    icon: 'bi-person-badge-fill',
    color: 'role-recruiter',
  },
  negocio: {
    label: 'Negocio',
    icon: 'bi-building-fill',
    color: 'role-negocio',
  },
  company: {
    label: 'Empresa',
    icon: 'bi-building-fill',
    color: 'role-negocio',
  },
};

const EMPTY_PWD = { current: '', next: '', confirm: '' };

export default function MiCuenta() {
  const { user } = useAuth();

  const userInitial = (user?.name ||
    user?.username ||
    user?.email ||
    'U')[0].toUpperCase();
  const userName = user?.name || user?.username || user?.email || 'Usuario';
  const userEmail = user?.email || '—';
  const role = ROLE_META[user?.role] || {
    label: user?.role || 'Usuario',
    icon: 'bi-person-fill',
    color: 'role-default',
  };

  /* ── Contraseña ── */
  const [pwd, setPwd] = useState(EMPTY_PWD);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [savingPwd, setSaving] = useState(false);

  /* ── Preferencias locales ── */
  const [notif, setNotif] = useState(
    () => localStorage.getItem('nexus_notif') !== 'false'
  );

  const handlePwdChange = (e) => {
    setPwd((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPwdMsg(null);
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    if (!pwd.current) {
      setPwdMsg({ type: 'error', text: 'Introduce tu contraseña actual.' });
      return;
    }
    if (pwd.next.length < 6) {
      setPwdMsg({ type: 'error', text: 'Mínimo 6 caracteres.' });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }

    setSaving(true);
    // TODO: PATCH /api/auth/change-password  (pendiente de backend)
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    setPwd(EMPTY_PWD);
    setPwdMsg({ type: 'success', text: 'Contraseña actualizada.' });
    setTimeout(() => setPwdMsg(null), 3500);
  };

  const toggleNotif = () => {
    const next = !notif;
    setNotif(next);
    localStorage.setItem('nexus_notif', String(next));
  };

  return (
    <div className="cuenta-page">
      {/* ── CABECERA ── */}
      <div className="cuenta-profile-card">
        <div className="cuenta-avatar-wrap">
          <div className="cuenta-avatar">{userInitial}</div>
          <span className="cuenta-avatar-dot" />
        </div>
        <div className="cuenta-profile-info">
          <h2 className="cuenta-name">{userName}</h2>
          <span className="cuenta-email">
            <i className="bi bi-envelope me-2" />
            {userEmail}
          </span>
          <span className={`cuenta-role-badge ${role.color}`}>
            <i className={`bi ${role.icon} me-1`} />
            {role.label}
          </span>
        </div>
        <div className="cuenta-stats">
          <div className="cuenta-stat">
            <span className="cuenta-stat-value">Nexus</span>
            <span className="cuenta-stat-label">Plataforma</span>
          </div>
          <div className="cuenta-stat-divider" />
          <div className="cuenta-stat">
            <span className="cuenta-stat-value">{role.label}</span>
            <span className="cuenta-stat-label">Rol activo</span>
          </div>
          <div className="cuenta-stat-divider" />
          <div className="cuenta-stat">
            <span className="cuenta-stat-value cuenta-stat-online">
              <i className="bi bi-circle-fill me-1" />
              Activo
            </span>
            <span className="cuenta-stat-label">Estado</span>
          </div>
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="cuenta-grid">
        {/* Información personal */}
        <div className="cuenta-card">
          <div className="cuenta-card-header">
            <div className="cuenta-card-icon icon-purple">
              <i className="bi bi-person-lines-fill" />
            </div>
            <div>
              <h3 className="cuenta-card-title">Información personal</h3>
              <p className="cuenta-card-subtitle">
                Datos de tu cuenta en Nexus
              </p>
            </div>
          </div>
          <div className="cuenta-fields">
            <div className="cuenta-field">
              <label>Correo electrónico</label>
              <div className="cuenta-field-value">
                <i className="bi bi-envelope text-muted me-2" />
                {userEmail}
                <span className="cuenta-field-badge">Verificado</span>
              </div>
            </div>
            <div className="cuenta-field">
              <label>Rol</label>
              <div className="cuenta-field-value">
                <i className={`bi ${role.icon} text-muted me-2`} />
                {role.label}
              </div>
            </div>
            <div className="cuenta-field">
              <label>ID de usuario</label>
              <div className="cuenta-field-value cuenta-field-muted">
                #{user?.id || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Seguridad */}
        <div className="cuenta-card">
          <div className="cuenta-card-header">
            <div className="cuenta-card-icon icon-cyan">
              <i className="bi bi-lock-fill" />
            </div>
            <div>
              <h3 className="cuenta-card-title">Seguridad</h3>
              <p className="cuenta-card-subtitle">
                Cambia tu contraseña de acceso
              </p>
            </div>
          </div>
          <form onSubmit={handlePwdSubmit} className="cuenta-form" noValidate>
            <div className="cuenta-form-group">
              <label htmlFor="current">Contraseña actual</label>
              <input
                id="current"
                name="current"
                type="password"
                className="cuenta-input"
                placeholder="••••••••"
                value={pwd.current}
                onChange={handlePwdChange}
                autoComplete="current-password"
              />
            </div>
            <div className="cuenta-form-row">
              <div className="cuenta-form-group">
                <label htmlFor="next">Nueva contraseña</label>
                <input
                  id="next"
                  name="next"
                  type="password"
                  className="cuenta-input"
                  placeholder="Mín. 6 caracteres"
                  value={pwd.next}
                  onChange={handlePwdChange}
                  autoComplete="new-password"
                />
              </div>
              <div className="cuenta-form-group">
                <label htmlFor="confirm">Confirmar</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  className="cuenta-input"
                  placeholder="Repite la nueva"
                  value={pwd.confirm}
                  onChange={handlePwdChange}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {pwdMsg && (
              <div
                className={`cuenta-msg ${pwdMsg.type === 'success' ? 'cuenta-msg--ok' : 'cuenta-msg--err'}`}
              >
                <i
                  className={`bi ${pwdMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'} me-2`}
                />
                {pwdMsg.text}
              </div>
            )}
            <button
              type="submit"
              className="cuenta-btn-save"
              disabled={savingPwd}
            >
              {savingPwd ? (
                <>
                  <i className="bi bi-arrow-repeat spin me-2" />
                  Guardando…
                </>
              ) : (
                <>
                  <i className="bi bi-lock me-2" />
                  Actualizar contraseña
                </>
              )}
            </button>
          </form>
        </div>

        {/* Preferencias */}
        <div className="cuenta-card">
          <div className="cuenta-card-header">
            <div className="cuenta-card-icon icon-orange">
              <i className="bi bi-sliders" />
            </div>
            <div>
              <h3 className="cuenta-card-title">Preferencias</h3>
              <p className="cuenta-card-subtitle">Personaliza tu experiencia</p>
            </div>
          </div>
          <div className="cuenta-prefs">
            <div className="cuenta-pref-row">
              <div className="cuenta-pref-info">
                <span className="cuenta-pref-name">
                  <i className="bi bi-bell me-2" />
                  Notificaciones
                </span>
                <span className="cuenta-pref-desc">
                  Avisos sobre actividad en la plataforma
                </span>
              </div>
              <button
                className={`cuenta-toggle ${notif ? 'cuenta-toggle--on' : ''}`}
                onClick={toggleNotif}
                type="button"
                aria-label="Toggle notificaciones"
              >
                <span className="cuenta-toggle-knob" />
              </button>
            </div>
            <div className="cuenta-pref-divider" />
            <div className="cuenta-pref-row">
              <div className="cuenta-pref-info">
                <span className="cuenta-pref-name">
                  <i className="bi bi-moon-stars me-2" />
                  Modo oscuro
                </span>
                <span className="cuenta-pref-desc">
                  Controlado desde el selector del topbar
                </span>
              </div>
              <span className="cuenta-pref-hint">
                <i className="bi bi-arrow-up-right me-1" />
                Topbar
              </span>
            </div>
          </div>
        </div>

        {/* Integración de Correo */}
        <EmailIntegration />

        {/* Sesión activa */}
        <div className="cuenta-card">
          <div className="cuenta-card-header">
            <div className="cuenta-card-icon icon-green">
              <i className="bi bi-shield-check" />
            </div>
            <div>
              <h3 className="cuenta-card-title">Sesión activa</h3>
              <p className="cuenta-card-subtitle">
                Información sobre tu acceso actual
              </p>
            </div>
          </div>
          <div className="cuenta-session-item">
            <div className="cuenta-session-icon">
              <i className="bi bi-laptop" />
            </div>
            <div className="cuenta-session-info">
              <span className="cuenta-session-name">Navegador web</span>
              <span className="cuenta-session-detail">
                Sesión actual · Activa ahora
              </span>
            </div>
            <span className="cuenta-session-live">
              <i className="bi bi-circle-fill me-1" />
              En línea
            </span>
          </div>
          <p className="cuenta-session-note">
            <i className="bi bi-info-circle me-1" />
            Si detectas actividad sospechosa, cambia tu contraseña
            inmediatamente.
          </p>
        </div>
      </div>
    </div>
  );
}
