import { useState, useEffect, useRef, useCallback } from 'react';
import './CalendarGrid.css';

const REDIRECT_URL =
  'https://accounts.google.com/o/oauth2/auth?client_id=TU_CLIENT_ID&redirect_uri=https://[…]=code&scope=https://www.googleapis.com/auth/calendar.events';

const EVENT_TYPES = {
  'Reunión :handshake:': '#28A745',
  'Enviar correo :email:': '#007BFF',
  'Conferencia :microphone:': '#FFC107',
  'Llamada urgente :telephone_receiver:': '#DC3545',
  'Seguimiento :clipboard:': '#FD7E14',
  'Otro...': '#6C757D',
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedDate) closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDate, closeModal]);

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
          if (Notification.permission === 'granted')
            new Notification(':alarm_clock: ' + e.text, {
              body: e.description,
            });
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
    if (window.confirm('¿Borrar todos?')) setEvents([]);
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
        <div className="calendar-top-bar">
          <h1 className="calendar-title">Calendario</h1>
          <div className="top-actions">
            <button className="clear-btn" onClick={clearAllEvents}>
              Limpiar :wastebasket:
            </button>
            <button
              className="action-btn"
              onClick={() => window.open(REDIRECT_URL, '_blank')}
            >
              Web :globe_with_meridians:
            </button>
          </div>
        </div>

        <div className="calendar-header">
          <div className="nav-controls">
            <button
              onClick={() =>
                setCurrentDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
              className="nav-btn"
            >
              :arrow_backward:
            </button>
            <button onClick={goToToday} className="nav-btn today-btn">
              Hoy
            </button>
            <button
              onClick={() =>
                setCurrentDate(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
              className="nav-btn"
            >
              :arrow_forward:
            </button>
          </div>
          <span className="calendar-month-text">
            {currentDate.toLocaleDateString('es-ES', {
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        <div className="days-header">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

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
                  </>
                )}
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
                      {e.description && (
                        <span className="event-desc-small">
                          {e.description}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        deleteEvent(e.id);
                      }}
                      className="event-delete-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {selectedDate && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h3>{editingEventId ? 'Editar evento' : 'Nuevo evento'}</h3>

              <label className="input-label">Tipo de evento:</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-field"
              >
                {PREDEFINED_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <label className="input-label">Descripción:</label>
              <input
                placeholder="Detalles..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                onKeyDown={(e) => e.key === 'Enter' && saveEvent()}
              />

              <label className="input-label">Hora:</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-field"
              />

              <div className="modal-actions">
                <button onClick={closeModal} className="nav-btn">
                  Cancelar
                </button>
                <button onClick={saveEvent} className="primary-btn">
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
