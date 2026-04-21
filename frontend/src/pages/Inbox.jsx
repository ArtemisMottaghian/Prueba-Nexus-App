import { useState } from 'react';
import InboxComponent from '../components/communication/Inbox';

const MOCK_CONVERSATIONS = [
  {
    id: 1,
    name: 'Juan Pérez',
    lastMessage: '¿Cuándo es la entrevista de selección?',
    time: '10:30 AM',
  },
  {
    id: 2,
    name: 'María García',
    lastMessage: 'Gracias por la oportunidad, envié mi CV actualizado.',
    time: 'Ayer',
  },
  {
    id: 3,
    name: 'Tech Solutions',
    lastMessage: 'Hemos revisado tu propuesta para la vacante de Senior.',
    time: 'Lunes',
  },
  {
    id: 4,
    name: 'Carlos Ruiz',
    lastMessage: 'Confirmado para el miércoles a las 16:00.',
    time: '15 abr',
  },
];

const InboxPage = () => {
  // Inicializamos el estado directamente con los mocks.
  // Esto evita el useEffect y el error de "cascading renders".
  const [conversations] = useState(MOCK_CONVERSATIONS);

  const handleSelectConversation = (conversation) => {
    console.log('Conversación seleccionada:', conversation.name);
  };

  return (
    <div className="inbox-page-wrapper">
      <InboxComponent
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
      />
    </div>
  );
};

export default InboxPage;
