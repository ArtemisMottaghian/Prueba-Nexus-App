import { useState, useEffect } from 'react';
import { authFetch, ENDPOINTS } from '../../services/api';

export default function EmailIntegration() {
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkGoogleStatus = async () => {
      try {
        // endpoint ficticio
        const res = await authFetch(
          ENDPOINTS?.user?.googleStatus || '/api/google/status'
        );
        const data = await res.json();
        setIsLinked(data.isLinked);
      } catch (error) {
        console.error('Error comprobando el estado de Google', error);
      } finally {
        setLoading(false);
      }
    };
    checkGoogleStatus();
  }, []);

  const handleLinkGoogle = async () => {
    try {
      // endpoint ficticio
      const res = await authFetch(
        ENDPOINTS?.user?.getGoogleAuthUrl || '/api/google/auth-url'
      );
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error al obtener la URL de Google', error);
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
