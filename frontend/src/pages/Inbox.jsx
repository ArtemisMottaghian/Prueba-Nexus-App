import React, { useState, useEffect } from 'react';
import InboxComponent from '../components/communication/Inbox';

const InboxPage = () => {
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    // Aquí harás el fetch a tu backend http://127.0.0.1:8000/api/inbox
    // Por ahora usamos datos ficticios:
    const mockData = [
      { id: 1, name: 'Juan Pérez', lastMessage: '¿Cuándo es la entrevista?', time: '10:30 AM' },
      { id: 2, name: 'María García', lastMessage: 'Gracias por la oportunidad.', time: 'Ayer' },
      { id: 3, name: 'Tech Solutions', lastMessage: 'Hemos revisado tu CV.', time: 'Lunes' },
    ];
    setConversations(mockData);
  }, []);

  const handleSelect = (conversation) => {
    console.log("Cargando chat de:", conversation.name);
    // Aquí podrías disparar otro fetch para obtener los mensajes reales
  };

  return (
    <div className="p-6 h-full">
      <h1 className="text-2xl font-bold mb-4">Bandeja de Entrada</h1>
      <InboxComponent 
        conversations={conversations} 
        onSelectConversation={handleSelect} 
      />
    </div>
  );
};

export default InboxPage;