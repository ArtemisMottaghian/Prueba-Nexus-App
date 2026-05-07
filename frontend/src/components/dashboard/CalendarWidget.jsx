import { useEffect, useState } from 'react';
import { ENDPOINTS, authFetch } from '../../services/api';
import './CalendarWidget.css';

export default function CalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [googleError, setGoogleError] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        setGoogleError(false);

        const response = await authFetch(
          ENDPOINTS.calendar?.list || '/api/calendar/',
          { signal: controller.signal }
        );

        if (response.status === 401) {
          setGoogleError(true);
        }

        const data = await response.json();

        if (data.google_error === true) {
          setGoogleError(true);
        }

        setEvents(data.events || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error en el Widget de Calendario:', err);
          setError('No se pudo sincronizar la agenda.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
    return () => controller.abort();
  }, []);

  const handleReconnect = () => {
    window.location.href =
      ENDPOINTS.auth?.googleLogin || '/api/auth/google/login';
  };

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

  if (loading && events.length === 0) {
    return (
      <div className="calendar-widget-modern h-100">
        <div className="calendar-empty-state">
          <p className="loading-msg">Sincronizando agenda...</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="calendar-widget-modern h-100">
        <div className="calendar-empty-state">
          <div className="calendar-empty-icon">
            <i className="bi bi-calendar3"></i>
          </div>
          <h3 className="calendar-empty-title">Próximos Eventos</h3>
          <p className="calendar-empty-subtitle">No hay eventos próximos</p>
          {error && <p className="error-message-inline mt-2">{error}</p>}
          {googleError && (
            <p className="google-status-msg mt-3">
              Google no sincronizado.
              <span onClick={handleReconnect}>Conectar</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-widget-modern h-100">
      <div className="widget-header-modern">
        <h3 className="widget-title-modern">Próximos Eventos</h3>
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

      <div className="events-list">
        {events.map((event) => {
          const dateValue = event.start?.dateTime || event.start?.date;
          if (!dateValue) return null;

          const isLocal = event.id && event.id.toString().startsWith('local_');
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
        })}
      </div>

      {googleError && (
        <p className="google-status-msg">
          Google no sincronizado.
          <span onClick={handleReconnect}>Conectar</span>
        </p>
      )}
    </div>
  );
}
