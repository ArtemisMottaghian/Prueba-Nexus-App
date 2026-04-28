import { useEffect, useState } from 'react';
import { ENDPOINTS, authFetch } from '../../services/api'; // Ruta corregida según tu estructura
import './CalendarWidget.css';

export default function CalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [googleError, setGoogleError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // El AbortController cancela la petición si el usuario cambia de página rápido
    const controller = new AbortController();

    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        setGoogleError(false);

        // 1. Intentamos cargar desde tu endpoint híbrido en FastAPI
        // Este endpoint debería devolver { "events": [...], "google_error": bool }
        const response = await authFetch(
          ENDPOINTS.calendar?.list || '/api/calendar/',
          { signal: controller.signal }
        );

        // Si el servidor responde 401, el token de Google ha caducado
        if (response.status === 401) {
          setGoogleError(true);
        }

        // Si recibimos un HTML (Error de Vite/Proxy) en lugar de JSON, esto fallará al catch
        const data = await response.json();

        // Si el backend nos dice explícitamente que Google falló pero nos manda los locales
        if (data.google_error === true) {
          setGoogleError(true);
        }

        // Guardamos los eventos (vengan de Google o sean locales)
        setEvents(data.events || []);
      } catch (err) {
        // No mostramos error si la petición simplemente fue cancelada por el sistema
        if (err.name !== 'AbortError') {
          console.error('Error en el Widget de Calendario:', err);
          setError('No se pudo sincronizar la agenda.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadEvents();

    // Limpieza al desmontar el componente
    return () => controller.abort();
  }, []);

  const handleReconnect = () => {
    // Redirige al flujo de login de Google en el backend
    window.location.href =
      ENDPOINTS.auth?.googleLogin || '/api/auth/google/login';
  };

  // Función auxiliar para formatear la fecha de Google/Local
  const formatDate = (dateValue) => {
    if (!dateValue) return { day: '', month: '', time: '' };
    const date = new Date(dateValue);

    return {
      day: date.getDate(),
      month: date.toLocaleString('es-ES', { month: 'short' }),
      time: dateValue.includes('T')
        ? date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Todo el día',
    };
  };

  // Estado de carga inicial
  if (loading && events.length === 0) {
    return (
      <div className="calendar-widget-container">
        <p className="loading-msg">Sincronizando agenda...</p>
      </div>
    );
  }

  return (
    <div className="calendar-widget-container">
      <div className="widget-header">
        <h3 className="widget-title">Próximos Eventos</h3>

        {/* Botón de advertencia parpadeante si Google falla */}
        {googleError && (
          <button
            className="mini-reconnect-btn"
            onClick={handleReconnect}
            title="Sincronización con Google pausada. Haz clic para reconectar."
          >
            ⚠️
          </button>
        )}
      </div>

      {/* Error crítico (ej. el backend no responde) */}
      {error && events.length === 0 && (
        <p className="error-message-inline">{error}</p>
      )}

      <div className="events-list">
        {events.length > 0 ? (
          events.map((event) => {
            const dateValue = event.start?.dateTime || event.start?.date;
            if (!dateValue) return null;

            // Detectamos si es local por el prefijo definido en el backend
            const isLocal =
              event.id && event.id.toString().startsWith('local_');
            const { day, month, time } = formatDate(dateValue);

            return (
              <div
                key={event.id || `event-${Math.random()}`}
                className={`event-item ${isLocal ? 'event-local' : 'event-google'}`}
              >
                <div className="event-date">
                  <span className="day">{day}</span>
                  <span className="month">{month}</span>
                </div>

                <div className="event-info">
                  <p className="event-name">
                    {event.summary || 'Sin título'}
                    {isLocal && <span className="local-indicator">•</span>}
                  </p>
                  <p className="event-time">{time}</p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="no-events">No hay eventos próximos.</p>
        )}
      </div>

      {/* Pie del widget con estado de Google */}
      {googleError && events.length > 0 && (
        <p className="google-status-msg">
          Google no sincronizado.{' '}
          <span onClick={handleReconnect}>Conectar</span>
        </p>
      )}
    </div>
  );
}
