import { useState, useRef } from 'react';

export function MessageInput({ onSend, onTyping }) {
  const [texto, setTexto] = useState('');
  const typingDebounceRef = useRef(null);

  const handleChange = (e) => {
    setTexto(e.target.value);
    if (onTyping) {
      clearTimeout(typingDebounceRef.current);
      typingDebounceRef.current = setTimeout(() => {
        onTyping();
      }, 400);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!texto.trim()) return;
    clearTimeout(typingDebounceRef.current);
    onSend(texto);
    setTexto('');
  };

  return (
    <div className="chat-input">
      <textarea
        value={texto}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Escribe para iniciar chat..."
      />
      <button type="button" className="send-btn" onClick={handleSend}>
        Enviar
      </button>
    </div>
  );
}
