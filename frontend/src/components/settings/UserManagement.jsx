// ============================================
// UserManagement.jsx
// Panel de administración — Gestión de Usuarios
// Solo accesible con rol 'admin'
// ============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usersService } from '../../services/userManagementService';
import './UserManagement.css';

// ── Datos de respaldo (Fallback) por si el backend está offline ──
const FALLBACK_USERS = [
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
    role: 'hr_manager',
    status: 'inactive',
    avatar: 'https://i.pravatar.cc/150?u=2',
  },
  {
    id: 3,
    name: 'Tech Corp',
    email: 'contacto@techcorp.com',
    role: 'company',
    status: 'active',
    avatar: 'https://i.pravatar.cc/150?u=3',
  },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'hr_manager', label: 'Reclutador' },
  { value: 'company', label: 'Negocio' },
];

const EMPTY_FORM = { name: '', email: '', password: '', role: 'hr_manager' };

export default function UserManagement() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // ── Petición a la DB al cargar el componente ─────────────────────────────────
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await usersService.getAllUsers();
        setUsers(data);
      } catch (error) {
        console.log(
          'Backend users endpoint offline. Using fallback data...',
          error
        );
        setUsers(FALLBACK_USERS);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

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

    if (!editingUser && !form.password) {
      errors.password = 'La contraseña es obligatoria';
    } else if (form.password && form.password.length < 6) {
      errors.password = 'Mínimo 6 caracteres';
    }

    if (!form.role) errors.role = 'Selecciona un rol';
    return errors;
  };

  // ── Funciones de Modal de Creación/Edición ──────────────────────────────────
  const handleOpenModal = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  };

  const handleEditUser = async (user) => {
    let userForForm = user;
    try {
      const freshUser = await usersService.getUserByEmail(user.email);
      if (freshUser) userForForm = freshUser;
    } catch {
      // fallback: seguimos con los datos de la tabla
    }

    setEditingUser(userForForm);
    setForm({
      name: userForForm.name,
      email: userForForm.email,
      password: '',
      role: userForForm.role,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormErrors({});
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    };
    if (form.password) payload.password = form.password;

    try {
      if (editingUser) {
        const updatedUser = await usersService.updateUser(
          editingUser.email,
          payload
        );
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? updatedUser : u))
        );
      } else {
        const newUser = await usersService.createUser(payload);
        setUsers((prev) => [...prev, newUser]);
      }
      handleCloseModal();
    } catch (error) {
      alert(`Hubo un error al ${editingUser ? 'editar' : 'crear'} el usuario.`);
      console.error(error);
    }
  };

  // ── Funciones de Borrado ────────────────────────────────────────────────────
  const requestDeleteUser = (user) => setUserToDelete(user);
  const cancelDeleteUser = () => setUserToDelete(null);

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await usersService.deleteUser(userToDelete.email);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setUserToDelete(null);
    } catch (error) {
      alert('Hubo un error al eliminar el usuario en el servidor.');
      console.error(error);
    }
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const getRoleBadge = (role) => {
    const safeRole = String(role || '').toLowerCase();
    switch (safeRole) {
      case 'admin':
        return <span className="um-badge um-badge--admin">Administrador</span>;
      case 'hr_manager':
        return <span className="um-badge um-badge--hr">Reclutador</span>;
      case 'company':
        return <span className="um-badge um-badge--company">Negocio</span>;
      default:
        return (
          <span className="um-badge text-uppercase">
            {safeRole || 'USUARIO'}
          </span>
        );
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="um-page">
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

      {loading ? (
        <div className="text-center p-5 text-muted">Cargando usuarios...</div>
      ) : (
        <>
          <div className="um-meta">
            <span className="um-meta__count">
              {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
            </span>
          </div>

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
                          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="um-user-cell__name">{user.name}</span>
                      </div>
                    </td>
                    <td className="um-table__email">{user.email}</td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td className="um-table__date">{user.createdAt}</td>
                    <td className="um-table__actions">
                      <button
                        className="um-btn-edit me-2"
                        title="Editar usuario"
                        style={{
                          color: '#0d6efd',
                          background: 'none',
                          border: 'none',
                        }}
                        onClick={() => handleEditUser(user)}
                      >
                        <i className="bi bi-pencil-square"></i>
                      </button>
                      <button
                        className="um-btn-delete"
                        title="Eliminar usuario"
                        onClick={() => requestDeleteUser(user)}
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
        </>
      )}

      {/* Modal: Añadir/Editar */}
      {showModal && (
        <div className="um-modal-overlay" onClick={handleCloseModal}>
          <div
            className="um-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="um-modal__header">
              <h3 className="um-modal__title">
                <i
                  className={`bi ${editingUser ? 'bi-pencil-square' : 'bi-person-plus-fill'} me-2`}
                ></i>
                {editingUser ? 'Editar empleado' : 'Añadir empleado'}
              </h3>
              <button
                className="um-modal__close"
                onClick={handleCloseModal}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="um-modal__body">
              {[
                {
                  id: 'um-name',
                  field: 'name',
                  label: 'Nombre completo',
                  type: 'text',
                  placeholder: 'Ej. María García',
                },
                {
                  id: 'um-email',
                  field: 'email',
                  label: 'Email',
                  type: 'email',
                  placeholder: 'maria@nexusai.com',
                  disabled: !!editingUser,
                },
                {
                  id: 'um-password',
                  field: 'password',
                  label: editingUser
                    ? 'Nueva Contraseña (Opcional)'
                    : 'Contraseña',
                  type: 'password',
                  placeholder: editingUser
                    ? 'Déjalo vacío para no cambiarla'
                    : 'Mínimo 6 caracteres',
                },
              ].map(({ id, field, label, type, placeholder, disabled }) => (
                <div className="um-field" key={field}>
                  <label className="um-field__label" htmlFor={id}>
                    {label}
                  </label>
                  <input
                    id={id}
                    type={type}
                    className={`um-field__input ${formErrors[field] ? 'um-field__input--error' : ''}`}
                    placeholder={placeholder}
                    value={form[field]}
                    disabled={disabled}
                    style={
                      disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}
                    }
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                  />
                  {formErrors[field] && (
                    <p className="um-field__error">
                      <i className="bi bi-exclamation-circle me-1"></i>
                      {formErrors[field]}
                    </p>
                  )}
                </div>
              ))}
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
            <div className="um-modal__footer">
              <button className="um-btn-cancel" onClick={handleCloseModal}>
                Cancelar
              </button>
              <button className="um-btn-confirm" onClick={handleSubmit}>
                <i className="bi bi-check-lg me-1"></i>
                {editingUser ? 'Guardar cambios' : 'Añadir empleado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {userToDelete && (
        <div className="um-modal-overlay" onClick={cancelDeleteUser}>
          <div
            className="um-modal um-modal--confirm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="um-modal__header">
              <h3 className="um-modal__title um-modal__title--danger">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                Confirmar eliminación
              </h3>
              <button
                className="um-modal__close"
                onClick={cancelDeleteUser}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div className="um-modal__body">
              <p className="um-confirm__text">
                ¿Estás seguro de que deseas eliminar permanentemente a{' '}
                <strong>
                  {userToDelete.name} ({userToDelete.email})
                </strong>
                ?
              </p>
              <p className="um-confirm__text" style={{ fontSize: '0.85em' }}>
                Esta acción no se puede deshacer y el usuario perderá el acceso
                a la plataforma.
              </p>
            </div>
            <div className="um-modal__footer">
              <button className="um-btn-cancel" onClick={cancelDeleteUser}>
                Cancelar
              </button>
              <button
                className="um-btn-delete-confirm"
                onClick={confirmDeleteUser}
              >
                <i className="bi bi-trash3 me-1"></i>Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
