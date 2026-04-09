// ============================================
// UserManagement.jsx
// Panel de administración — Gestión de Usuarios
// Solo accesible con rol 'admin'
// ============================================

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './UserManagement.css';

// ── Datos mock mientras el backend no está listo ──────────────────────────────
// TODO (BACKEND): Reemplazar almacenamiento local (MOCK_USERS) con llamada a fetch GET /api/users.
// Este endpoint debe estar blindado: solo puede consultarlo un token cuyo rol == 'admin'.
const MOCK_USERS = [
  {
    id: 1,
    name: 'Pablo Gargallo',
    email: 'admin@admin.com',
    role: 'admin',
    createdAt: '2026-01-10',
  },
  {
    id: 2,
    name: 'Ana López',
    email: 'ana@nexus.com',
    role: 'reclutador',
    status: 'inactive',
    avatar: 'https://i.pravatar.cc/150?u=2',
  },
  {
    id: 3,
    name: 'Tech Corp',
    email: 'contacto@techcorp.com',
    role: 'negocio',
    status: 'active',
    avatar: 'https://i.pravatar.cc/150?u=3',
  },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'reclutador', label: 'Reclutador' },
  { value: 'negocio', label: 'Negocio' },
];

// ── Formulario vacío ──────────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', email: '', role: 'reclutador' };

export default function UserManagement() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState(MOCK_USERS);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  // ── Guardia de rol ──────────────────────────────────────────────────────────
  if (!hasRole('admin')) {
    return (
      <div className="um-forbidden">
        <i className="bi bi-shield-x um-forbidden__icon"></i>
        <h2>Acceso restringido</h2>
        <p>No tienes permisos para ver esta página.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  }

  // ── Validación del formulario ───────────────────────────────────────────────
  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'El nombre es obligatorio';
    if (!form.email.trim()) {
      errors.email = 'El email es obligatorio';
    } else {
      const at = form.email.indexOf('@');
      if (at === -1 || form.email.indexOf('.', at) === -1) {
        errors.email = 'Email no válido (ej. tu@email.com)';
      }
    }
    if (!form.role) errors.role = 'Selecciona un rol';
    return errors;
  };

  const handleOpenModal = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormErrors({});
  };

  const handleSubmit = () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    // Añadimos el usuario localmente (en el futuro: POST /api/users)
    // TODO (BACKEND): Enviar `form` a POST /api/users
    // El backend se hará cargo ahí de mandar el correo de invitación / generar su contraseña temporal.
    const newUser = {
      id: Date.now(),
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setUsers((prev) => [...prev, newUser]);
    handleCloseModal();
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="um-badge um-badge--admin">Administrador</span>;
      case 'reclutador':
        return <span className="um-badge um-badge--hr">Reclutador</span>;
      case 'negocio':
        return <span className="um-badge um-badge--company">Negocio</span>;
      default:
        return <span className="um-badge">Usuario</span>;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="um-page">
      {/* Cabecera */}
      <div className="um-header">
        <div className="um-header__title">
          <h2>Configuración</h2>
          <p>Gestiona los empleados y permisos de la plataforma</p>
        </div>
        <button className="um-btn-add" onClick={handleOpenModal}>
          <i className="bi bi-person-plus-fill"></i>
          <span>Añadir empleado</span>
        </button>
      </div>

      {/* Contador */}
      <div className="um-meta">
        <span className="um-meta__count">
          {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
        </span>
      </div>

      {/* Tabla */}
      <div className="um-table-wrapper">
        <table className="um-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Alta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="um-table__row">
                <td>
                  <div className="um-user-cell">
                    <div className="um-avatar">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="um-user-cell__name">{user.name}</span>
                  </div>
                </td>
                <td className="um-table__email">{user.email}</td>
                <td>{getRoleBadge(user.role)}</td>
                <td className="um-table__date">{user.createdAt}</td>
                <td className="um-table__actions">
                  <button
                    className="um-btn-delete"
                    title="Eliminar usuario"
                    onClick={() =>
                      setUsers((prev) => prev.filter((u) => u.id !== user.id))
                    }
                  >
                    <i className="bi bi-trash3"></i>
                  </button>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="um-table__empty">
                  <i className="bi bi-people um-table__empty-icon"></i>
                  <p>No hay usuarios todavía.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal: Añadir empleado ───────────────────────────────────────────── */}
      {showModal && (
        <div className="um-modal-overlay" onClick={handleCloseModal}>
          <div
            className="um-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="um-modal-title"
          >
            {/* Header modal */}
            <div className="um-modal__header">
              <h3 id="um-modal-title" className="um-modal__title">
                <i className="bi bi-person-plus-fill me-2"></i>
                Añadir empleado
              </h3>
              <button
                className="um-modal__close"
                onClick={handleCloseModal}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Body modal */}
            <div className="um-modal__body">
              {/* Nombre */}
              <div className="um-field">
                <label className="um-field__label" htmlFor="um-name">
                  Nombre completo
                </label>
                <input
                  id="um-name"
                  type="text"
                  className={`um-field__input ${formErrors.name ? 'um-field__input--error' : ''}`}
                  placeholder="Ej. María García"
                  value={form.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                />
                {formErrors.name && (
                  <p className="um-field__error">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="um-field">
                <label className="um-field__label" htmlFor="um-email">
                  Email
                </label>
                <input
                  id="um-email"
                  type="email"
                  className={`um-field__input ${formErrors.email ? 'um-field__input--error' : ''}`}
                  placeholder="maria@nexusai.com"
                  value={form.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                />
                {formErrors.email && (
                  <p className="um-field__error">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {formErrors.email}
                  </p>
                )}
              </div>

              {/* Rol */}
              <div className="um-field">
                <label className="um-field__label" htmlFor="um-role">
                  Rol
                </label>
                <select
                  id="um-role"
                  className={`um-field__select ${formErrors.role ? 'um-field__input--error' : ''}`}
                  value={form.role}
                  onChange={(e) => handleFieldChange('role', e.target.value)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {formErrors.role && (
                  <p className="um-field__error">
                    <i className="bi bi-exclamation-circle me-1"></i>
                    {formErrors.role}
                  </p>
                )}
              </div>
            </div>

            {/* Footer modal */}
            <div className="um-modal__footer">
              <button className="um-btn-cancel" onClick={handleCloseModal}>
                Cancelar
              </button>
              <button className="um-btn-confirm" onClick={handleSubmit}>
                <i className="bi bi-check-lg me-1"></i>
                Añadir empleado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Borrado Modal Eliminado para interacción rápida */}
    </div>
  );
}
