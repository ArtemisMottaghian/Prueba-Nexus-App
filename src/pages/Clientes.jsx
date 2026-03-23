import { useState } from 'react';
import VacancyModal from '../components/recruitment/VacancyModal';

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

// Adapta una vacante del cliente al formato que espera VacancyModal
const adaptarVacante = (vacante, cliente) => ({
  id: vacante.id,
  title: vacante.titulo,
  companyName: cliente.nombre,
  location: cliente.direccion || 'No especificada',
  status: vacante.estado,
  source: 'Nexus',
  time: vacante.fecha,
  salary: null,
});

export default function Clientes() {
  const [clientes, setClientes] = useState(clientesIniciales);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSector, setFiltroSector] = useState('Todos');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [clienteAEliminar, setClienteAEliminar] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [errores, setErrores] = useState({});
  const [clienteEditando, setClienteEditando] = useState(null);

  // Estado para la vacante seleccionada dentro del panel de detalle
  const [vacanteSeleccionada, setVacanteSeleccionada] = useState(null);

  const sectores = ['Todos', ...new Set(clientes.map(c => c.sector))];

  const clientesFiltrados = clientes.filter(c => {
    const coincideNombre = c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.contactoPrincipal.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.email.toLowerCase().includes(busqueda.toLowerCase());
    const coincideSector = filtroSector === 'Todos' || c.sector === filtroSector;
    return coincideNombre && coincideSector;
  });

  const abrirModalNuevo = () => {
    setForm(formVacio);
    setErrores({});
    setClienteEditando(null);
    setModalAbierto('nuevo');
  };

  const abrirModalEditar = (e, cliente) => {
    e.stopPropagation();
    setForm({
      nombre: cliente.nombre,
      sector: cliente.sector,
      contactoPrincipal: cliente.contactoPrincipal,
      email: cliente.email,
      telefono: cliente.telefono,
      cif: cliente.cif || '',
      direccion: cliente.direccion || '',
    });
    setErrores({});
    setClienteEditando(cliente);
    setModalAbierto('editar');
  };

  const abrirModalEliminar = (e, cliente) => {
    e.stopPropagation();
    setClienteAEliminar(cliente);
    setModalEliminar(true);
  };

  const guardarCliente = () => {
    const nuevosErrores = validarForm(form);
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    if (modalAbierto === 'nuevo') {
      const nuevoCliente = {
        ...form,
        id: `c${Date.now()}`,
        vacantesAbiertas: 0,
        vacantes: [],
      };
      setClientes(prev => [...prev, nuevoCliente]);
    } else if (modalAbierto === 'editar') {
      setClientes(prev => prev.map(c =>
        c.id === clienteEditando.id ? { ...c, ...form } : c
      ));
      if (clienteSeleccionado?.id === clienteEditando.id) {
        setClienteSeleccionado(prev => ({ ...prev, ...form }));
      }
    }
    setModalAbierto(false);
  };

  const confirmarEliminar = () => {
    setClientes(prev => prev.filter(c => c.id !== clienteAEliminar.id));
    if (clienteSeleccionado?.id === clienteAEliminar.id) {
      setClienteSeleccionado(null);
    }
    setModalEliminar(false);
    setClienteAEliminar(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: undefined }));
  };

  return (
    <div className="clientes-page">

      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2 className="page-title mb-1">Directorio de Clientes</h2>
          <p className="text-muted mb-0">Gestiona tus clientes B2B y sus vacantes asociadas.</p>
        </div>
        <button className="btn btn-primary d-flex align-items-center gap-2" onClick={abrirModalNuevo}>
          <i className="bi bi-plus-circle"></i>
          <span>Nuevo cliente</span>
        </button>
      </div>

      <div className="clientes-split">

        {/* Panel izquierdo */}
        <div className="clientes-list-panel">
          <div className="clientes-filters mb-3">
            <div className="topbar-search mb-2">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Buscar por nombre, contacto o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select
              className="form-select filter-select"
              value={filtroSector}
              onChange={(e) => setFiltroSector(e.target.value)}
            >
              {sectores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {clientesFiltrados.map(cliente => (
            <div
              key={cliente.id}
              className={`cliente-card ${clienteSeleccionado?.id === cliente.id ? 'active' : ''}`}
              onClick={() => setClienteSeleccionado(cliente)}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                  <h6 className="cliente-nombre mb-1 text-truncate">{cliente.nombre}</h6>
                  <span className="cliente-sector">{cliente.sector}</span>
                </div>
                <div className="d-flex align-items-center gap-1 flex-shrink-0">
                  <span className="cliente-vacantes-badge me-1">
                    {cliente.vacantesAbiertas} {cliente.vacantesAbiertas !== 1 ? 'vacantes' : 'vacante'}
                  </span>
                  <button
                    className="btn-icon btn-icon-sm"
                    title="Editar cliente"
                    onClick={(e) => abrirModalEditar(e, cliente)}
                  >
                    <i className="bi bi-pencil"></i>
                  </button>
                  <button
                    className="btn-icon btn-icon-sm text-danger"
                    title="Eliminar cliente"
                    onClick={(e) => abrirModalEliminar(e, cliente)}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div className="cliente-contacto mt-2">
                <i className="bi bi-person me-1"></i>
                {cliente.contactoPrincipal}
              </div>
            </div>
          ))}

          {clientesFiltrados.length === 0 && (
            <div className="text-center text-muted py-4">
              <i className="bi bi-building fs-3 d-block mb-2"></i>
              No se encontraron clientes
            </div>
          )}
        </div>

        {/* Panel derecho */}
        <div className="clientes-detail-panel">
          {clienteSeleccionado ? (
            <>
              <div className="cliente-profile-header mb-4">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div>
                    <h3 className="cliente-profile-nombre">{clienteSeleccionado.nombre}</h3>
                    <span className="cliente-sector">{clienteSeleccionado.sector}</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="cliente-vacantes-badge grande">
                      {clienteSeleccionado.vacantesAbiertas} vacantes abiertas
                    </span>
                    <button
                      className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                      onClick={(e) => abrirModalEditar(e, clienteSeleccionado)}
                    >
                      <i className="bi bi-pencil"></i>
                      <span className="d-none d-sm-inline">Editar</span>
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                      onClick={(e) => abrirModalEliminar(e, clienteSeleccionado)}
                    >
                      <i className="bi bi-trash"></i>
                      <span className="d-none d-sm-inline">Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-12 col-lg-6">
                  <div className="cliente-info-card h-100">
                    <h6 className="info-card-title">
                      <i className="bi bi-person-badge me-2"></i>Datos de contacto
                    </h6>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Contacto principal</span>
                        <span className="info-value">{clienteSeleccionado.contactoPrincipal}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Email</span>
                        <a href={`mailto:${clienteSeleccionado.email}`} className="info-value text-decoration-none">
                          <i className="bi bi-envelope me-1 text-muted"></i>
                          {clienteSeleccionado.email}
                        </a>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Teléfono</span>
                        <a href={`tel:${clienteSeleccionado.telefono}`} className="info-value text-decoration-none">
                          <i className="bi bi-telephone me-1 text-muted"></i>
                          {clienteSeleccionado.telefono}
                        </a>
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      <a href={`mailto:${clienteSeleccionado.email}`} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
                        <i className="bi bi-envelope"></i><span>Email</span>
                      </a>
                      <a href={`tel:${clienteSeleccionado.telefono}`} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1">
                        <i className="bi bi-telephone"></i><span>Llamar</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-6">
                  <div className="cliente-info-card h-100">
                    <h6 className="info-card-title">
                      <i className="bi bi-building me-2"></i>Datos fiscales
                    </h6>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">CIF</span>
                        <span className="info-value">{clienteSeleccionado.cif || '—'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Dirección</span>
                        <span className="info-value">{clienteSeleccionado.direccion || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vacantes vinculadas — clicables para abrir VacancyModal */}
              <div className="cliente-info-card">
                <h6 className="info-card-title mb-3">
                  <i className="bi bi-briefcase me-2"></i>
                  Vacantes vinculadas ({clienteSeleccionado.vacantes.length})
                </h6>
                {clienteSeleccionado.vacantes.length > 0 ? (
                  clienteSeleccionado.vacantes.map(v => (
                    <div
                      key={v.id}
                      className="vacante-vinculada d-flex align-items-center justify-content-between mb-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setVacanteSeleccionada(adaptarVacante(v, clienteSeleccionado))}
                    >
                      <div>
                        <p className="mb-0 vacante-vinculada-titulo">{v.titulo}</p>
                        <span className="activity-time">{v.fecha}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${getBadgeEstado(v.estado)}`}>{v.estado}</span>
                        <i className="bi bi-chevron-right text-muted" style={{ fontSize: '12px' }}></i>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted small mb-0">No hay vacantes vinculadas.</p>
                )}
              </div>
            </>
          ) : (
            <div className="clientes-empty-state">
              <i className="bi bi-building fs-1 mb-3 d-block"></i>
              <h5>Selecciona un cliente</h5>
              <p className="text-muted">Haz clic en un cliente de la lista para ver sus datos y vacantes asociadas.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL DE VACANTE VINCULADA ── */}
      {vacanteSeleccionada && (
        <VacancyModal
          job={vacanteSeleccionada}
          onClose={() => setVacanteSeleccionada(null)}
        />
      )}

      {/* ── MODAL NUEVO / EDITAR CLIENTE ── */}
      {modalAbierto && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className={`bi bi-${modalAbierto === 'nuevo' ? 'plus-circle' : 'pencil'} me-2`}></i>
                    {modalAbierto === 'nuevo' ? 'Nuevo cliente' : `Editar — ${clienteEditando?.nombre}`}
                  </h5>
                  <button className="btn-icon" onClick={() => setModalAbierto(false)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="filter-label">Nombre empresa *</label>
                      <input type="text" name="nombre" className={`form-control filter-select ${errores.nombre ? 'is-invalid' : ''}`} placeholder="Ej: TechCorp Solutions" value={form.nombre} onChange={handleFormChange} />
                      {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="filter-label">Sector *</label>
                      <input type="text" name="sector" className={`form-control filter-select ${errores.sector ? 'is-invalid' : ''}`} placeholder="Ej: Tecnología" value={form.sector} onChange={handleFormChange} />
                      {errores.sector && <div className="invalid-feedback">{errores.sector}</div>}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="filter-label">Contacto principal *</label>
                      <input type="text" name="contactoPrincipal" className={`form-control filter-select ${errores.contactoPrincipal ? 'is-invalid' : ''}`} placeholder="Nombre y apellidos" value={form.contactoPrincipal} onChange={handleFormChange} />
                      {errores.contactoPrincipal && <div className="invalid-feedback">{errores.contactoPrincipal}</div>}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="filter-label">Email *</label>
                      <input type="email" name="email" className={`form-control filter-select ${errores.email ? 'is-invalid' : ''}`} placeholder="contacto@empresa.com" value={form.email} onChange={handleFormChange} />
                      {errores.email && <div className="invalid-feedback">{errores.email}</div>}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="filter-label">Teléfono *</label>
                      <input type="tel" name="telefono" className={`form-control filter-select ${errores.telefono ? 'is-invalid' : ''}`} placeholder="+34 600 000 000" value={form.telefono} onChange={handleFormChange} />
                      {errores.telefono && <div className="invalid-feedback">{errores.telefono}</div>}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="filter-label">CIF</label>
                      <input type="text" name="cif" className="form-control filter-select" placeholder="Ej: B12345678" value={form.cif} onChange={handleFormChange} />
                    </div>
                    <div className="col-12">
                      <label className="filter-label">Dirección</label>
                      <input type="text" name="direccion" className="form-control filter-select" placeholder="Calle, número, ciudad" value={form.direccion} onChange={handleFormChange} />
                    </div>
                  </div>
                  <p className="text-muted small mt-3 mb-0">* Campos obligatorios</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setModalAbierto(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={guardarCliente}>
                    <i className="bi bi-check-circle me-2"></i>
                    {modalAbierto === 'nuevo' ? 'Crear cliente' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL CONFIRMAR ELIMINAR ── */}
      {modalEliminar && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title text-danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Eliminar cliente
                  </h5>
                  <button className="btn-icon" onClick={() => setModalEliminar(false)}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
                <div className="modal-body pt-2">
                  <p className="mb-1">¿Estás seguro de que quieres eliminar a</p>
                  <p className="fw-semibold mb-3">"{clienteAEliminar?.nombre}"?</p>
                  <p className="text-muted small mb-0">
                    <i className="bi bi-info-circle me-1"></i>
                    Esta acción no se puede deshacer. Se eliminarán también todas sus vacantes vinculadas.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button className="btn btn-secondary" onClick={() => setModalEliminar(false)}>Cancelar</button>
                  <button className="btn btn-danger" onClick={confirmarEliminar}>
                    <i className="bi bi-trash me-2"></i>
                    Sí, eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}