import { useState, useEffect } from "react";

export default function Calendario() {
  const [events, setEvents] = useState(() => {
    const saved = localStorage.getItem("events");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    localStorage.setItem("events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission !== "granted") {
        Notification.requestPermission();
      }
    }

    const interval = setInterval(() => {
      const now = new Date();

      setEvents(prevEvents =>
        prevEvents.map(e => {
          if (!e.time) return e;

          const eventDateTime = new Date(`${e.date}T${e.time}`);
          const diff = eventDateTime - now;

          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            diff > 0 &&
            diff < 60000 &&
            !e.notified
          ) {
            new Notification("⏰ Recordatorio", { body: e.text });
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
        e => e.date === selectedDate && e.time === time && e.text === text
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
        notified: false
      }
    ]);

    setText("");
    setTime("");
    setSelectedDate(null);
  };

  const deleteEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const moveEvent = (id, newDate) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    setEvents(events.map(e => (e.id === id ? { ...e, date: newDate } : e)));
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
    `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f1f3f4",
      padding: "2rem",
      display: "flex",
      justifyContent: "center"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        padding: "1.5rem",
        width: "100%",
        maxWidth: "900px"
      }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>
          Calendario
        </h1>

        {/* Navegación */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem"
        }}>
          <button
            onClick={() =>
              setCurrentDate(prev =>
                new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            style={navBtn}
          >
            ◀
          </button>

          <span style={{ fontWeight: "500" }}>
            {currentDate.toLocaleDateString("es-ES", {
              month: "long",
              year: "numeric"
            })}
          </span>

          <button
            onClick={() =>
              setCurrentDate(prev =>
                new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            style={navBtn}
          >
            ▶
          </button>
        </div>

        {/* Días */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "6px",
          marginBottom: "6px",
          textAlign: "center",
          color: "#666",
          fontSize: "0.85rem"
        }}>
          {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendario */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "6px"
        }}>
          {generateMonth().map((day, i) => {
            const date = day ? formatDate(day) : null;

            const dayEvents = events
              .filter(e => e.date === date)
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

            return (
              <div
                key={i}
                onClick={() => day && setSelectedDate(date)}
                style={{
                  minHeight: "90px",
                  padding: "6px",
                  borderRadius: "10px",
                  background: date === today ? "#e8f0fe" : "white",
                  border: date === today ? "1px solid #4285f4" : "1px solid #eee",
                  cursor: day ? "pointer" : "default",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {day && <div style={{ fontWeight: "600" }}>{day}</div>}

                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    style={{
                      background: "#4285f4",
                      color: "white",
                      borderRadius: "6px",
                      padding: "2px 6px",
                      marginTop: "4px",
                      fontSize: "0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.time} {e.text}
                    </span>

                    <button
                      onClick={(ev) => {
                        ev.stopPropagation();
                        deleteEvent(e.id);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "white",
                        cursor: "pointer"
                      }}
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
          <div style={modalOverlay}>
            <div style={modalBox}>
              <h3>Nuevo evento</h3>

              <input
                placeholder="Descripción"
                value={text}
                onChange={e => setText(e.target.value)}
                style={input}
              />

              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={input}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button onClick={() => setSelectedDate(null)} style={navBtn}>
                  Cancelar
                </button>
                <button onClick={addEvent} style={primaryBtn}>
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

/* 🎨 estilos reutilizables */
const navBtn = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  background: "#f1f3f4"
};

const primaryBtn = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "none",
  background: "#4285f4",
  color: "white",
  cursor: "pointer"
};

const input = {
  padding: "6px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  width: "100%"
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.3)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const modalBox = {
  background: "white",
  padding: "1.5rem",
  borderRadius: "12px",
  width: "300px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
};