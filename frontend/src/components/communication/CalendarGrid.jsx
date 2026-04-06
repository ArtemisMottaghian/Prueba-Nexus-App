import { useState, useEffect } from 'react';
import './CalendarGrid.css';

export default function Calendario() {
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem('events');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [text, setText] = useState('');
  const [time, setTime] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }

    const interval = setInterval(() => {
      const now = new Date();

      setEvents((prevEvents) =>
        prevEvents.map((e) => {
          if (!e.time) return e;

          const eventDateTime = new Date(`${e.date}T${e.time}`);
          const diff = eventDateTime - now;

          if (
            'Notification' in window &&
            Notification.permission === 'granted' &&
            diff > 0 &&
            diff < 60000 &&
            !e.notified
          ) {
            new Notification('⏰ Recordatorio', { body: e.text });
            return { ...e, notified: true };
          }

          return e;
        })
      );
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const addEvent = () => {
    if (!selectedDate || !text) return;

    if (
      events.some(
        (e) => e.date === selectedDate && e.time === time && e.text === text
      )
    ) {
      return;
    }

    setEvents([
      ...events,
      {
        id: crypto.randomUUID(),
        date: selectedDate,
        text,
        time,
        notified: false,
      },
    ]);

    setText('');
    setTime('');
    setSelectedDate(null);
  };

  const deleteEvent = (id) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  // eslint-disable-next-line no-unused-vars
  const _moveEvent = (id, newDate) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    setEvents(events.map((e) => (e.id === id ? { ...e, date: newDate } : e)));
  };

  const generateMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  };

  const formatDate = (day) =>
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(day).padStart(2, '0')}`;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="calendar-container">
      <div className="calendar-box">
        <h1 className="calendar-title">Calendario</h1>

        {/* Navegación */}
        <div className="calendar-header">
          <button
            onClick={() =>
              setCurrentDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            className="nav-btn"
          >
            ◀
          </button>

          <span className="calendar-month-text">
            {currentDate.toLocaleDateString('es-ES', {
              month: 'long',
              year: 'numeric',
            })}
          </span>

          <button
            onClick={() =>
              setCurrentDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            className="nav-btn"
          >
            ▶
          </button>
        </div>

        {/* Días */}
        <div className="days-header">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendario */}
        <div className="calendar-grid">
          {generateMonth().map((day, i) => {
            const date = day ? formatDate(day) : null;
            const isToday = date === today;
            const isEmpty = !day;

            const dayEvents = events
              .filter((e) => e.date === date)
              .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

            return (
              <div
                key={i}
                onClick={() => day && setSelectedDate(date)}
                className={`day-cell ${isToday ? 'today' : ''} ${isEmpty ? 'empty' : ''}`}
              >
                {day && <div className="day-number">{day}</div>}

                {dayEvents.map((e) => (
                  <div key={e.id} className="event-item">
                    <span className="event-text">
                      {e.time} {e.text}
                    </span>

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

        {/* Modal */}
        {selectedDate && (
          <div className="modal-overlay">
            <div className="modal-box">
              <h3>Nuevo evento</h3>

              <input
                placeholder="Descripción"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input-field"
              />

              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input-field"
              />

              <div className="modal-actions">
                <button
                  onClick={() => setSelectedDate(null)}
                  className="nav-btn"
                >
                  Cancelar
                </button>
                <button onClick={addEvent} className="primary-btn">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
