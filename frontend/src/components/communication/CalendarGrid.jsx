import { useState, useEffect, useRef, useCallback } from 'react';
import './CalendarGrid.css';

const REDIRECT_URL =
  'https://accounts.google.com/o/oauth2/auth?client_id=TU_CLIENT_ID&redirect_uri=https://nexus-app.com/calendar&response_type=code&scope=https://www.googleapis.com/auth/calendar.events';

// Colores unificados con la paleta de la aplicación
const EVENT_TYPES = {
  Reunión: 'var(--color-purple-secondary)',
  'Enviar correo': 'var(--color-cyan-primary)',
  Conferencia: 'var(--color-violet)',
  'Llamada urgente': '#ef4444',
  Seguimiento: '#f59e0b',
  'Otro...': 'var(--text-muted)',
};

const PREDEFINED_OPTIONS = Object.keys(EVENT_TYPES);

export default function Calendario() {
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('events');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedDate, setSelectedDate] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [type, setType] = useState(PREDEFINED_OPTIONS[0]);
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  const eventsRef = useRef(events);

  useEffect(() => {
    eventsRef.current = events;
    localStorage.setItem('events', JSON.stringify(events));
  }, [events]);

  const closeModal = useCallback(() => {
    setSelectedDate(null);
    setEditingEventId(null);
    setType(PREDEFINED_OPTIONS[0]);
    setDescription('');
    setTime('');
  }, []);

  // Cerrar modal con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedDate) closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, closeModal]);

  // Sistema de Notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    const checkEvents = () => {
      const now = new Date();
      let hasChanged = false;
      const updatedEvents = eventsRef.current.map((e) => {
        if (!e.time || e.notified) return e;
        const [hours, minutes] = e.time.split(':');
        const eventDate = new Date(e.date + 'T00:00:00');
        eventDate.setHours(parseInt(hours), parseInt(minutes), 0);
        const diff = eventDate - now;

        if (diff > 0 && diff < 60000) {
          if (Notification.permission === 'granted') {
            new Notification('📅 Recordatorio: ' + e.text, {
              body: `${e.time} - ${e.description || 'Sin descripción'}`,
              icon: '/logo192.png',
            });
          }
          hasChanged = true;
          return { ...e, notified: true };
        }
        return e;
      });
      if (hasChanged) setEvents(updatedEvents);
    };
    const interval = setInterval(checkEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  const openEditModal = (e, event) => {
    e.stopPropagation();
    setSelectedDate(event.date);
    setEditingEventId(event.id);
    setType(event.text);
    setDescription(event.description || '');
    setTime(event.time);
  };

  const saveEvent = () => {
    if (!selectedDate || !type) return;
    const eventData = {
      text: type,
      description,
      time,
      date: selectedDate,
      notified: false,
    };
    if (editingEventId) {
      setEvents(
        events.map((e) =>
          e.id === editingEventId ? { ...e, ...eventData, id: e.id } : e
        )
      );
    } else {
      setEvents([...events, { ...eventData, id: crypto.randomUUID() }]);
    }
    closeModal();
  };

  const deleteEvent = (id) => setEvents(events.filter((e) => e.id !== id));

  const clearAllEvents = () => {
    if (
      window.confirm('¿Estás seguro de que quieres borrar todos los eventos?')
    ) {
      setEvents([]);
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const generateMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  };

  const formatDate = (day) =>
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="calendar-container">
      <div className="calendar-box">
        {/* BARRA SUPERIOR */}
        <div className="calendar-top-bar">
          <h1 className="calendar-title">Calendario</h1>
          <div className="top-actions">
            <button
              className="btn btn-sm btn-outline-danger me-2"
              onClick={clearAllEvents}
            >
              <i className="bi bi-trash3 me-1"></i> Limpiar
            </button>
            <button
              className="btn-primary-custom"
              onClick={() => window.open(REDIRECT_URL, '_blank')}
            >
              <i className="bi bi-globe me-1"></i> Sincronizar
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <div className="calendar-header">
          <div className="nav-controls d-flex align-items-center gap-2">
            <button
              onClick={() =>
                setCurrentDate(
                  new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() - 1,
                    1
                  )
                )
              }
              className="btn-icon"
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            <button
              onClick={goToToday}
              className="btn btn-sm btn-secondary-custom"
            >
              Hoy
            </button>
            <button
              onClick={() =>
                setCurrentDate(
                  new Date(
                    currentDate.getFullYear(),
                    currentDate.getMonth() + 1,
                    1
                  )
                )
              }
              className="btn-icon"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
          <span className="calendar-month-text">
            {currentDate.toLocaleDateString('es-ES', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* CABECERA DÍAS */}
        <div className="days-header">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* GRID DE DÍAS */}
        <div className="calendar-grid">
          {generateMonth().map((day, i) => {
            const date = day ? formatDate(day) : null;
            const isToday = date === todayStr;
            const dayEvents = events
              .filter((e) => e.date === date)
              .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            return (
              <div
                key={i}
                onClick={() => day && setSelectedDate(date)}
                className={`day-cell ${isToday ? 'today' : ''} ${!day ? 'empty' : ''}`}
              >
                {day && (
                  <>
                    <div className="day-number">{day}</div>
                    <div className="dots-container">
                      {dayEvents.map((e) => (
                        <div
                          key={e.id}
                          className="event-dot"
                          style={{ backgroundColor: EVENT_TYPES[e.text] }}
                        ></div>
                      ))}
                    </div>
                    {dayEvents.map((e) => (
                      <div
                        key={e.id}
                        className="event-item"
                        onClick={(ev) => openEditModal(ev, e)}
                        style={{ backgroundColor: EVENT_TYPES[e.text] }}
                      >
                        <div className="event-content">
                          <span className="event-time-type">
                            {e.time} {e.text}
                          </span>
                        </div>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            deleteEvent(e.id);
                          }}
                          className="event-delete-btn"
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* MODAL DE EVENTO */}
        {selectedDate && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-4">
                {editingEventId ? 'Editar evento' : 'Nuevo evento'}
              </h3>

              <div className="mb-3">
                <label className="input-label">Tipo de evento</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="form-select select-status-inline w-100"
                  style={{ maxWidth: '100%' }}
                >
                  {PREDEFINED_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="input-label">Descripción</label>
                <input
                  placeholder="Añadir detalles..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field"
                  onKeyDown={(e) => e.key === 'Enter' && saveEvent()}
                />
              </div>

              <div className="mb-4">
                <label className="input-label">Hora</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="d-flex gap-2">
                <button
                  onClick={closeModal}
                  className="btn btn-secondary-custom flex-grow-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEvent}
                  className="btn-primary-custom flex-grow-1"
                >
                  {editingEventId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
