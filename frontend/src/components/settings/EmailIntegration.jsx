import { useState, useEffect } from 'react';
import { authFetch } from '../../services/api';

export default function EmailIntegration() {
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeComponent = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('google_success') === 'true') {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }

      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const response = await authFetch(`${apiUrl}/api/emails/google/status`);

        if (response.ok) {
          const data = await response.json();
          setIsLinked(data.is_linked);
        }
      } catch (error) {
        console.error('Error comprobando el estado de Google', error);
      } finally {
        setLoading(false);
      }
    };

    initializeComponent();
  }, []);

  const handleLinkGoogle = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await authFetch(`${apiUrl}/api/emails/google/login`);

      if (!response.ok) {
        throw new Error('No se pudo generar el enlace de Google');
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error al iniciar vinculación con Google:', error);
      alert('No se pudo iniciar la conexión con Google. Revisa la consola.');
    }
  };

  const handleUnlink = async () => {
    // Un pequeño aviso por si le dan sin querer
    if (!window.confirm('¿Seguro que quieres desvincular tu cuenta de Google?'))
      return;

    try {
      setLoading(true); // Ponemos la pantalla de carga un segundito
      const apiUrl = import.meta.env.VITE_API_URL;

      const response = await authFetch(`${apiUrl}/api/emails/google/unlink`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsLinked(false); // ¡Magia! Vuelve a salir el botón gris de Conectar
      } else {
        throw new Error('Error al desvincular la cuenta');
      }
    } catch (error) {
      console.error('Error al desvincular:', error);
      alert('Hubo un problema al desvincular la cuenta. Revisa la consola.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="cuenta-card">
      <div className="cuenta-card-header">
        <div
          className="cuenta-card-icon"
          style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
        >
          <i className="bi bi-google" />
        </div>
        <div>
          <h3 className="cuenta-card-title">Integración de Correo</h3>
          <p className="cuenta-card-subtitle">
            Conecta tu cuenta de Google Workspace
          </p>
        </div>
      </div>

      <div className="cuenta-fields">
        <p
          style={{
            color: '#64748b',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}
        >
          Permite a Nexus enviar correos automáticos a candidatos y clientes
          utilizando tu propia dirección de correo.
        </p>

        {isLinked ? (
          <div
            className="cuenta-field-value"
            style={{ color: '#10b981', fontWeight: '500' }}
          >
            <i className="bi bi-check-circle-fill me-2" />
            Cuenta de Google vinculada
            <span
              className="cuenta-field-badge ms-auto"
              style={{
                cursor: 'pointer',
                backgroundColor: '#fee2e2',
                color: '#ef4444',
              }}
              onClick={handleUnlink}
            >
              Desvincular
            </span>
          </div>
        ) : (
          <button onClick={handleLinkGoogle} className="cuenta-btn-save">
            <i className="bi bi-google me-2" />
            Conectar con Google
          </button>
        )}
      </div>
    </div>
  );
}
