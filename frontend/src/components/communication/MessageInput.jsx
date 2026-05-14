import { useState } from 'react';

export function MessageInput({ onSend }) {
  const [texto, setTexto] = useState('');

  const TextoChat = (ingreso) => {
    setTexto(ingreso.target.value);
  };

  {
    /*Funcion Enter*/
  }
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  {
    /* Funcion dejar texarea vacio una vez se envie */
  }
  const handleSend = () => {
    if (!texto.trim()) return;

    onSend(texto);
    setTexto('');
  };

  return (
    <div className="chat-input">
      <textarea
        value={texto}
        onChange={TextoChat}
        onKeyDown={handleKeyDown}
        placeholder="Escribe para inciar chat..."
      />

      <button type="button" className="send-btn" onClick={handleSend}>
        Enviar
      </button>
    </div>
  );
}
