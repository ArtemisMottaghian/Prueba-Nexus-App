import { useState } from 'react';
import ClienteCard from '../components/crm/ClienteCard';
import ClienteDetail from '../components/crm/ClienteDetail';
import clientesIniciales from '../data/clientesData.json';

const formVacio = {
  nombre: '',
  sector: '',
  contactoPrincipal: '',
  email: '',
  telefono: '',
  cif: '',
  direccion: '',
  prioritario: false,
};

const validarForm = (datos) => {
  const err = {};
  if (!datos.nombre) err.nombre = 'El nombre es obligatorio';
  if (!datos.sector) err.sector = 'El sector es obligatorio';
  if (!datos.contactoPrincipal)
    err.contactoPrincipal = 'El contacto es obligatorio';
  if (!datos.email) err.email = 'El email es obligatorio';
  if (!datos.telefono) err.telefono = 'El telefono es obligatorio';
  return err;
};

export default function Clientes() {
  const [clientes, setClientes] = useState(clientesIniciales);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSector, setFiltroSector] = useState('Todos');
  const [filtroPrioritario, setFiltroPrioritario] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [clienteAEliminar, setClienteAEliminar] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [errores, setErrores] = useState({});
  const [clienteEditando, setClienteEditando] = useState(null);

  const sectores = ['Todos', ...new Set(clientes.map((c) => c.sector))];

  const clientesFiltrados = clientes.filter((c) => {
    const coincideNombre =
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.contactoPrincipal.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.email.toLowerCase().includes(busqueda.toLowerCase());
    const coincideSector =
      filtroSector === 'Todos' || c.sector === filtroSector;
    const coincidePrioritario = !filtroPrioritario || c.prioritario === true;
    return coincideNombre && coincideSector && coincidePrioritario;
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
      prioritario: cliente.prioritario || false,
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

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: undefined }));
  };

  const guardarCliente = () => {
    const nuevosErrores = validarForm(form);
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    if (modalAbierto === 'nuevo') {
      const nuevo = {
        ...form,
        id: `c${Date.now()}`,
        vacantesAbiertas: 0,
        vacantes: [],
      };
      setClientes((prev) => [...prev, nuevo]);
    } else {
      setClientes((prev) =>
        prev.map((c) => (c.id === clienteEditando.id ? { ...c, ...form } : c))
      );
      if (clienteSeleccionado?.id === clienteEditando.id)
        setClienteSeleccionado((prev) => ({ ...prev, ...form }));
    }
    setModalAbierto(false);
  };

  const confirmarEliminar = () => {
    setClientes((prev) => prev.filter((c) => c.id !== clienteAEliminar.id));
    if (clienteSeleccionado?.id === clienteAEliminar.id)
      setClienteSeleccionado(null);
    setModalEliminar(false);
    setClienteAEliminar(null);
  };

  const togglePrioritario = (e, cliente) => {
    e.stopPropagation();
    const actualizado = { ...cliente, prioritario: !cliente.prioritario };
    setClientes((prev) =>
      prev.map((c) => (c.id === cliente.id ? actualizado : c))
    );
    if (clienteSeleccionado?.id === cliente.id)
      setClienteSeleccionado(actualizado);
  };

  return (
    <div className="clientes-page">
      {/* Cabecera */}
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2 className="page-title mb-1">Directorio de Clientes</h2>
          <p className="text-muted mb-0">
            {clientes.length} clientes registrados
            {clientes.filter((c) => c.prioritario).length > 0 && (
              <span className="ms-2" style={{ color: '#f59e0b' }}>
                · {clientes.filter((c) => c.prioritario).length} VIP
              </span>
            )}
          </p>
        </div>
        <button
          className="btn btn-primary d-flex align-items-center gap-2"
          onClick={abrirModalNuevo}
        >
          <i className="bi bi-plus-circle"></i>
          <span>Nuevo cliente</span>
        </button>
      </div>

      <div className="clientes-split">
        {/* Panel izquierdo */}
        <div className="clientes-list-panel">
          <div className="clientes-search-bar mb-2">
            <i className="bi bi-search"></i>
            <input
              type="text"
              placeholder="Buscar por nombre, contacto o email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button className="search-clear" onClick={() => setBusqueda('')}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>

          <div className="d-flex gap-2 mb-3">
            <select
              className="form-select form-select-sm clientes-select"
              value={filtroSector}
              onChange={(e) => setFiltroSector(e.target.value)}
            >
              {sectores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              className={`btn btn-sm btn-filter-vip ${filtroPrioritario ? 'active' : ''}`}
              onClick={() => setFiltroPrioritario(!filtroPrioritario)}
              title="Mostrar solo VIP"
            >
              <i className="bi bi-star-fill"></i>
            </button>
          </div>

          {clientesFiltrados.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-search fs-3 d-block mb-2"></i>
              <p className="mb-0 small">No se encontraron clientes</p>
            </div>
          ) : (
            clientesFiltrados.map((c) => (
              <ClienteCard
                key={c.id}
                cliente={c}
                isSelected={clienteSeleccionado?.id === c.id}
                onClick={setClienteSeleccionado}
                onEdit={abrirModalEditar}
                onDelete={abrirModalEliminar}
                onTogglePrioritario={togglePrioritario}
              />
            ))
          )}
        </div>

        {/* Panel derecho */}
        <div className="clientes-detail-panel">
          <ClienteDetail
            cliente={clienteSeleccionado}
            onEdit={abrirModalEditar}
            onDelete={abrirModalEliminar}
          />
        </div>
      </div>

      {/* MODAL NUEVO / EDITAR */}
      {modalAbierto && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i
                      className={`bi bi-${modalAbierto === 'nuevo' ? 'plus-circle' : 'pencil'} me-2`}
                    ></i>
                    {modalAbierto === 'nuevo'
                      ? 'Nuevo cliente'
                      : `Editar — ${clienteEditando?.nombre}`}
                  </h5>
                  <button
                    className="btn-close"
                    onClick={() => setModalAbierto(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Nombre empresa *</label>
                      <input
                        name="nombre"
                        value={form.nombre}
                        onChange={handleFormChange}
                        className={`form-control ${errores.nombre ? 'is-invalid' : ''}`}
                        placeholder="Ej: TechCorp Solutions"
                      />
                      {errores.nombre && (
                        <div className="invalid-feedback">{errores.nombre}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Sector *</label>
                      <input
                        name="sector"
                        value={form.sector}
                        onChange={handleFormChange}
                        className={`form-control ${errores.sector ? 'is-invalid' : ''}`}
                        placeholder="Ej: Tecnologia"
                      />
                      {errores.sector && (
                        <div className="invalid-feedback">{errores.sector}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Contacto principal *</label>
                      <input
                        name="contactoPrincipal"
                        value={form.contactoPrincipal}
                        onChange={handleFormChange}
                        className={`form-control ${errores.contactoPrincipal ? 'is-invalid' : ''}`}
                        placeholder="Nombre y apellidos"
                      />
                      {errores.contactoPrincipal && (
                        <div className="invalid-feedback">
                          {errores.contactoPrincipal}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Email *</label>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleFormChange}
                        className={`form-control ${errores.email ? 'is-invalid' : ''}`}
                        placeholder="contacto@empresa.com"
                      />
                      {errores.email && (
                        <div className="invalid-feedback">{errores.email}</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Telefono *</label>
                      <input
                        name="telefono"
                        type="tel"
                        value={form.telefono}
                        onChange={handleFormChange}
                        className={`form-control ${errores.telefono ? 'is-invalid' : ''}`}
                        placeholder="+34 600 000 000"
                      />
                      {errores.telefono && (
                        <div className="invalid-feedback">
                          {errores.telefono}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">CIF</label>
                      <input
                        name="cif"
                        value={form.cif}
                        onChange={handleFormChange}
                        className="form-control"
                        placeholder="Ej: B12345678"
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Direccion</label>
                      <input
                        name="direccion"
                        value={form.direccion}
                        onChange={handleFormChange}
                        className="form-control"
                        placeholder="Calle, numero, ciudad"
                      />
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="prioritario"
                          name="prioritario"
                          checked={form.prioritario}
                          onChange={handleFormChange}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="prioritario"
                        >
                          <i className="bi bi-star-fill text-warning me-1"></i>
                          Marcar como cliente VIP / prioritario
                        </label>
                      </div>
                    </div>
                  </div>
                  <p className="text-muted small mt-3 mb-0">
                    * Campos obligatorios
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModalAbierto(false)}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={guardarCliente}>
                    <i className="bi bi-check-circle me-2"></i>
                    {modalAbierto === 'nuevo'
                      ? 'Crear cliente'
                      : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}