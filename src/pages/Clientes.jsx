import { useState } from 'react';

const clientesIniciales = [
  {
    id: 'c1',
    nombre: 'TechCorp Solutions',
    sector: 'Tecnología',
    contactoPrincipal: 'Ana Ruiz',
    email: 'ana.ruiz@techcorp.com',
    telefono: '+34 600 111 222',
    vacantesAbiertas: 3,
    cif: 'B12345678',
    direccion: 'Calle Gran Vía 28, Madrid',
    vacantes: [
      { id: 'v1', titulo: 'Senior Frontend Developer', estado: 'Nueva', fecha: 'Hace 2h' },
      { id: 'v4', titulo: 'DevOps Engineer', estado: 'Contactada', fecha: 'Hace 1 día' },
      { id: 'v5', titulo: 'Product Manager', estado: 'En proceso', fecha: 'Hace 3 días' },
    ],
  },
  {
    id: 'c2',
    nombre: 'Meliá Hotels',
    sector: 'Turismo',
    contactoPrincipal: 'Roberto Fernández',
    email: 'r.fernandez@melia.com',
    telefono: '+34 600 333 444',
    vacantesAbiertas: 5,
    cif: 'A87654321',
    direccion: 'Paseo de la Castellana 55, Madrid',
    vacantes: [
      { id: 'v3', titulo: 'Data Scientist', estado: 'En proceso', fecha: 'Hace 1 día' },
      { id: 'v6', titulo: 'Revenue Manager', estado: 'Nueva', fecha: 'Hace 4h' },
      { id: 'v7', titulo: 'Marketing Digital', estado: 'Contactada', fecha: 'Hace 2 días' },
      { id: 'v8', titulo: 'UX Designer', estado: 'Nueva', fecha: 'Hace 5h' },
      { id: 'v9', titulo: 'Backend Java', estado: 'Nueva', fecha: 'Hace 6h' },
    ],
  },
  {
    id: 'c3',
    nombre: 'Banco Santander Tech',
    sector: 'Finanzas',
    contactoPrincipal: 'Laura Gómez',
    email: 'l.gomez@santander.com',
    telefono: '+34 600 555 666',
    vacantesAbiertas: 2,
    cif: 'A39000013',
    direccion: 'Ciudad Grupo Santander, Boadilla del Monte',
    vacantes: [
      { id: 'v10', titulo: 'Data Engineer Python', estado: 'Nueva', fecha: 'Hace 3h' },
      { id: 'v11', titulo: 'Cybersecurity Analyst', estado: 'Contactada', fecha: 'Hace 2 días' },
    ],
  },
];

// Formulario vacío para nuevo cliente o edición
const formVacio = {
  nombre: '',
  sector: '',
  contactoPrincipal: '',
  email: '',
  telefono: '',
  cif: '',
  direccion: '',
};

const getBadgeEstado = (estado) => {
  const map = {
    'Nueva': 'badge-nueva',
    'Contactada': 'badge-contactada',
    'En proceso': 'badge-en-proceso',
    'Descartada': 'badge-descartada',
  };
  return map[estado] || 'badge-nueva';
};

// Validaciones básicas del formulario
const validarForm = (form) => {
  const errores = {};
  if (!form.nombre.trim()) errores.nombre = 'El nombre es obligatorio';
  if (!form.sector.trim()) errores.sector = 'El sector es obligatorio';
  if (!form.contactoPrincipal.trim()) errores.contactoPrincipal = 'El contacto es obligatorio';
  if (!form.email.trim()) {
    errores.email = 'El email es obligatorio';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errores.email = 'Email no válido';
  }
  if (!form.telefono.trim()) errores.telefono = 'El teléfono es obligatorio';
  return errores;
};

export default function Clientes() {
  const [clientes, setClientes] = useState(clientesIniciales);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSector, setFiltroSector] = useState('Todos');

  const sectores = ['Todos', ...new Set(clientes.map(c => c.sector))];

  const clientesFiltrados = clientes.filter(c => {
    const coincideNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.contactoPrincipal.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.email.toLowerCase().includes(busqueda.toLowerCase());
    const coincideSector = filtroSector === 'Todos' || c.sector === filtroSector;
    return coincideNombre && coincideSector;
  });

  return (
    <div className="clientes-page">
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2 className="page-title mb-1">Directorio de Clientes</h2>
          <p className="text-muted mb-0">Gestiona tus clientes B2B y sus vacantes asociadas.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2">
          <i className="bi bi-plus-circle"></i>
          <span>Nuevo cliente</span>
        </button>
      </div>

      <div className="clientes-split">
        <div className="clientes-list-panel">
          <div className="clientes-filters mb-3">
            <div className="topbar-search mb-2">
              <i className="bi bi-search"></i>
              <input type="text" placeholder="Buscar por nombre, contacto o email..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
            <select className="form-select filter-select" value={filtroSector} onChange={(e) => setFiltroSector(e.target.value)}>
              {sectores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {clientesFiltrados.map(cliente => (
            <div key={cliente.id} className={`cliente-card ${clienteSeleccionado?.id === cliente.id ? 'active' : ''}`} onClick={() => setClienteSeleccionado(cliente)}>
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                  <h6 className="cliente-nombre mb-1 text-truncate">{cliente.nombre}</h6>
                  <span className="cliente-sector">{cliente.sector}</span>
                </div>
                <span className="cliente-vacantes-badge">{cliente.vacantesAbiertas} {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}</span>
              </div>
              <div className="cliente-contacto mt-2"><i className="bi bi-person me-1"></i>{cliente.contactoPrincipal}</div>
            </div>
          ))}

          {clientesFiltrados.length === 0 && (
            <div className="text-center text-muted py-4">
              <i className="bi bi-building fs-3 d-block mb-2"></i>
              No se encontraron clientes
            </div>
          )}
        </div>

        <div className="clientes-detail-panel">
          <div className="clientes-empty-state">
            <i className="bi bi-building fs-1 mb-3 d-block"></i>
            <h5>Selecciona un cliente</h5>
            <p className="text-muted">Haz clic en un cliente para ver sus datos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}