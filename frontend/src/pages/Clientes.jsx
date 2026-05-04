import { useState, useEffect, useMemo } from 'react';
import ClienteCard from '../components/crm/ClienteCard';
import ClienteDetail from '../components/crm/ClienteDetail';
import BulkActions from '../components/recruitment/shared/BulkActions';
import {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  assignUserToCompanies,
} from '../services/clientesService';

const ITEMS_POR_PAGINA = 10;

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
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClientes, setSelectedClientes] = useState([]);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    try {
      setIsLoading(true);
      const data = await getClientes();
      setClientes(data);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const seleccionarCliente = async (cliente) => {
    try {
      const detalle = await getClienteById(cliente.id);
      setClienteSeleccionado(detalle);
    } catch (error) {
      console.error('Error al cargar detalle del cliente:', error);
      setClienteSeleccionado(cliente);
    }
  };

  const [busqueda, setBusqueda] = useState('');
  const [filtroSector, setFiltroSector] = useState('Todos');
  const [filtroPrioritario, setFiltroPrioritario] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [clienteAEliminar, setClienteAEliminar] = useState(null);
  const [form, setForm] = useState(formVacio);
  const [errores, setErrores] = useState({});
  const [clienteEditando, setClienteEditando] = useState(null);

  const sectores = [
    'Todos',
    ...new Set(clientes.map((c) => c.sector).filter(Boolean)),
  ];

  // FILTRO CORREGIDO CON PROTECCIÓN DE UNDEFINED Y COMPANY_NAME
  const clientesFiltrados = clientes.filter((c) => {
    const searchLower = (busqueda || '').toLowerCase();

    const coincideNombre =
      (c.company_name || c.nombre || '').toLowerCase().includes(searchLower) ||
      (c.contactoPrincipal || '').toLowerCase().includes(searchLower) ||
      (c.email || '').toLowerCase().includes(searchLower);
    const coincideSector =
      filtroSector === 'Todos' || c.sector === filtroSector;
    const coincidePrioritario = !filtroPrioritario || c.prioritario === true;
    return coincideNombre && coincideSector && coincidePrioritario;
  });

  // Reset página al cambiar filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroSector, filtroPrioritario]);

  // Cálculo de paginación
  const totalPaginas = Math.max(
    1,
    Math.ceil(clientesFiltrados.length / ITEMS_POR_PAGINA)
  );
  const paginaSafe = Math.min(paginaActual, totalPaginas);

  const clientesPaginados = useMemo(() => {
    const inicio = (paginaSafe - 1) * ITEMS_POR_PAGINA;
    return clientesFiltrados.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [clientesFiltrados, paginaSafe]);

  const irAPagina = (p) =>
    setPaginaActual(Math.max(1, Math.min(p, totalPaginas)));

  // Páginas visibles
  const paginasVisibles = useMemo(() => {
    let inicio = Math.max(1, paginaSafe - 1);
    let fin = Math.min(totalPaginas, inicio + 2);
    if (fin - inicio < 2) inicio = Math.max(1, fin - 2);
    const pages = [];
    for (let i = inicio; i <= fin; i++) pages.push(i);
    return pages;
  }, [paginaSafe, totalPaginas]);

  const desde =
    clientesFiltrados.length === 0
      ? 0
      : (paginaSafe - 1) * ITEMS_POR_PAGINA + 1;
  const hasta = Math.min(
    paginaSafe * ITEMS_POR_PAGINA,
    clientesFiltrados.length
  );

  const abrirModalNuevo = () => {
    setForm(formVacio);
    setErrores({});
    setClienteEditando(null);
    setModalAbierto('nuevo');
  };

  // MODAL DE EDICIÓN CORREGIDO (Protegemos todo si viene nulo)
  const abrirModalEditar = (e, cliente) => {
    e.stopPropagation();
    setForm({
      nombre: cliente.company_name || cliente.nombre || '',
      sector: cliente.sector || '',
      contactoPrincipal: cliente.contactoPrincipal || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
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

  const guardarCliente = async () => {
    const nuevosErrores = validarForm(form);
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    try {
      if (modalAbierto === 'nuevo') {
        const nuevo = await createCliente(form);
        setClientes((prev) => [...prev, nuevo]);
      } else {
        const actualizado = await updateCliente(clienteEditando.id, form);
        setClientes((prev) =>
          prev.map((c) =>
            c.id === clienteEditando.id ? { ...c, ...actualizado } : c
          )
        );
        if (clienteSeleccionado?.id === clienteEditando.id)
          setClienteSeleccionado((prev) => ({ ...prev, ...actualizado }));
      }
      setModalAbierto(false);
    } catch (error) {
      console.error('Error al guardar el cliente:', error);
      alert('Error al guardar el cliente. Por favor, intente de nuevo.');
    }
  };

  const confirmarEliminar = async () => {
    try {
      await deleteCliente(clienteAEliminar.id);
      setClientes((prev) => prev.filter((c) => c.id !== clienteAEliminar.id));
      if (clienteSeleccionado?.id === clienteAEliminar.id)
        setClienteSeleccionado(null);
      setModalEliminar(false);
      setClienteAEliminar(null);
      // Limpiarlo de seleccionados si lo estaba
      setSelectedClientes((prev) =>
        prev.filter((id) => id !== clienteAEliminar.id)
      );
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      alert('Error al eliminar el cliente. Por favor, intente de nuevo.');
    }
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

  // Manejo de checkbox múltiple
  const handleSelectCliente = (id) => {
    setSelectedClientes((prev) => {
      if (prev.includes(id)) return prev.filter((cid) => cid !== id);
      return [...prev, id];
    });
  };

  // Asignar masivamente a Comercial (Ander)
  const handleBulkAssign = async (targetUser) => {
    try {
      await assignUserToCompanies(selectedClientes, targetUser);
      setSelectedClientes([]);
      alert(`Empresas asignadas con éxito a ${targetUser}`);
    } catch (err) {
      console.error(err);
      alert('Hubo un problema asignando las empresas en el servidor.');
    }
  };

  // Descarte masivo
  const handleBulkDiscard = () => {
    alert(
      'Función de descarte masivo de clientes aún no implementada en Backend'
    );
  };

  return (
    <div className="clientes-page">
      {/* Cabecera */}
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <p className="text-muted mb-0">
            {clientes.length} empresas registradas
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
          <span>Nueva empresa</span>
        </button>
      </div>

      {/* Barra de Acciones Masivas si hay seleccionados */}
      {selectedClientes.length > 0 && (
        <div className="mb-3 animate__animated animate__fadeInDown animate__faster">
          <BulkActions
            selectedCount={selectedClientes.length}
            label="empresa"
            onDiscard={handleBulkDiscard}
            onAssign={handleBulkAssign}
            onClear={() => setSelectedClientes([])}
          />
        </div>
      )}

      <div
        className={`clientes-split${clienteSeleccionado ? ' has-selected' : ''}`}
      >
        {/* Panel izquierdo */}
        <div className="clientes-list-panel">
          {/* Cabecera fija: buscador + filtros */}
          <div className="clientes-list-header">
            <div className="clientes-search-bar mb-2">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Buscar por nombre, contacto o email..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button
                  className="search-clear"
                  onClick={() => setBusqueda('')}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>

            <div className="d-flex gap-2">
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
          </div>

          {/* Zona scrolleable de tarjetas */}
          <div className="clientes-list-scroll">
            {isLoading ? (
              <div className="text-center text-muted py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-2 mb-0 small">Cargando clientes...</p>
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="text-center text-muted py-4">
                <i className="bi bi-search fs-3 d-block mb-2"></i>
                <p className="mb-0 small">No se encontraron clientes</p>
              </div>
            ) : (
              clientesPaginados.map((c) => (
                <ClienteCard
                  key={c.id}
                  cliente={c}
                  isSelected={clienteSeleccionado?.id === c.id}
                  isBulkSelected={selectedClientes.includes(c.id)}
                  onBulkSelect={handleSelectCliente}
                  onClick={seleccionarCliente}
                  onEdit={abrirModalEditar}
                  onDelete={abrirModalEliminar}
                  onTogglePrioritario={togglePrioritario}
                />
              ))
            )}
          </div>

          {/* Paginación */}
          {!isLoading && totalPaginas > 1 && (
            <div className="clientes-pagination">
              <span className="clientes-pagination__info">
                {desde}–{hasta} de {clientesFiltrados.length}
              </span>
              <div className="clientes-pagination__controls">
                <button
                  className="clientes-pagination__btn"
                  onClick={() => irAPagina(paginaSafe - 1)}
                  disabled={paginaSafe === 1}
                  aria-label="Página anterior"
                >
                  <i className="bi bi-chevron-left"></i>
                </button>

                {paginasVisibles[0] > 1 && (
                  <>
                    <button
                      className="clientes-pagination__btn"
                      onClick={() => irAPagina(1)}
                    >
                      1
                    </button>
                    {paginasVisibles[0] > 2 && (
                      <span className="clientes-pagination__dots">…</span>
                    )}
                  </>
                )}

                {paginasVisibles.map((p) => (
                  <button
                    key={p}
                    className={`clientes-pagination__btn ${p === paginaSafe ? 'active' : ''}`}
                    onClick={() => irAPagina(p)}
                  >
                    {p}
                  </button>
                ))}

                {paginasVisibles[paginasVisibles.length - 1] < totalPaginas && (
                  <>
                    {paginasVisibles[paginasVisibles.length - 1] <
                      totalPaginas - 1 && (
                      <span className="clientes-pagination__dots">…</span>
                    )}
                    <button
                      className="clientes-pagination__btn"
                      onClick={() => irAPagina(totalPaginas)}
                    >
                      {totalPaginas}
                    </button>
                  </>
                )}

                <button
                  className="clientes-pagination__btn"
                  onClick={() => irAPagina(paginaSafe + 1)}
                  disabled={paginaSafe === totalPaginas}
                  aria-label="Página siguiente"
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho */}
        <div className="clientes-detail-panel">
          {clienteSeleccionado && (
            <button
              className="btn-volver-mobile"
              onClick={() => setClienteSeleccionado(null)}
            >
              <i className="bi bi-arrow-left"></i>
              Volver a clientes
            </button>
          )}
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
                      ? 'Nueva empresa'
                      : `Editar — ${clienteEditando?.company_name || clienteEditando?.nombre}`}
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

      {/* MODAL ELIMINAR */}
      {modalEliminar && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title text-danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>Eliminar
                    empresa
                  </h5>
                  <button
                    className="btn-close"
                    onClick={() => setModalEliminar(false)}
                  ></button>
                </div>
                <div className="modal-body pt-2">
                  <p className="mb-1">Estas seguro de que quieres eliminar a</p>
                  <p className="fw-semibold mb-3">
                    &quot;
                    {clienteAEliminar?.company_name || clienteAEliminar?.nombre}
                    &quot;?
                  </p>
                  <p className="text-muted small mb-0">
                    <i className="bi bi-info-circle me-1"></i>
                    Esta accion no se puede deshacer.
                  </p>
                </div>
                <div className="modal-footer border-0">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModalEliminar(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={confirmarEliminar}
                  >
                    <i className="bi bi-trash me-2"></i>Si, eliminar
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
