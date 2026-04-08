import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Para redirigir tras login exitoso
import './LoginForm.css';

// Funciones de validación
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validarCampos({ email, password }) {
  const errores = {};
  if (!email.trim()) errores.email = 'El correo electrónico es obligatorio.';
  else if (!validarEmail(email)) errores.email = 'Introduce un correo válido.';
  if (!password) errores.password = 'La contraseña es obligatoria.';
  else if (password.length < 6) errores.password = 'Mínimo 6 caracteres.';
  return errores;
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [tocado, setTocado] = useState({});
  const [cargando, setCargando] = useState(false); // Estado para mostrar carga durante autenticación
  const navigate = useNavigate();

  const handleBlur = (campo) => {
    setTocado((prev) => ({ ...prev, [campo]: true }));
    setErrores(validarCampos({ email, password }));
  };

  const handleChange = (campo, valor) => {
    if (campo === 'email') setEmail(valor);
    if (campo === 'password') setPassword(valor);
    if (tocado[campo]) {
      setErrores(
        validarCampos({
          email: campo === 'email' ? valor : email,
          password: campo === 'password' ? valor : password,
        })
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTocado({ email: true, password: true });
    const nuevosErrores = validarCampos({ email, password });
    setErrores(nuevosErrores);

    if (Object.keys(nuevosErrores).length > 0) return;

    setCargando(true);

    try {
      // Autenticación con backend (Corregido al puerto 8000 y ruta correcta)
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Almacenar token en localStorage
        localStorage.setItem('token', data.token);
        // Redirigir al dashboard
        navigate('/');
      } else {
        // Mostrar error del backend (si lo hay) o un mensaje genérico
        setErrores({ backend: data.message || 'Credenciales incorrectas' });
      }
    } catch (_error) { // Corregido con guion bajo para el Linter
      setErrores({ backend: 'Error de conexión con el servidor' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg">
        <div className="login-bg__orb login-bg__orb--1" />
        <div className="login-bg__orb login-bg__orb--2" />
        <div className="login-bg__grid" />
      </div>

      <div className="login-card">
        <div className="login-card__logo">
          {/* ... Tu SVG de logo ... */}
          <span className="login-card__logo-text">
            Nexus<span className="login-card__logo-accent">AI</span>
          </span>
        </div>

        <div className="login-card__header">
          <h1 className="login-card__title">Bienvenido</h1>
          <p className="login-card__subtitle">Accede a tu panel</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="login-form__group">
            <div
              className={`login-form__input-wrapper ${errores.email && tocado.email ? 'login-form__input-wrapper--error' : ''}`}
            >
              <input
                className="login-form__input"
                type="email"
                placeholder="tu@empresa.com"
                value={email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
              />
            </div>
            {errores.email && tocado.email && (
              <p className="login-form__error">{errores.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="login-form__group">
            <div
              className={`login-form__input-wrapper ${errores.password && tocado.password ? 'login-form__input-wrapper--error' : ''}`}
            >
              <input
                className="login-form__input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
              />
            </div>
            {errores.password && tocado.password && (
              <p className="login-form__error">{errores.password}</p>
            )}
          </div>

          {/* Error de backend */}
          {errores.backend && (
            <p
              className="login-form__error"
              style={{ textAlign: 'center', marginBottom: '10px' }}
            >
              {errores.backend}
            </p>
          )}

          <button
            className="login-form__submit"
            type="submit"
            disabled={cargando}
          >
            <span>{cargando ? 'Entrando...' : 'Iniciar sesión'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}