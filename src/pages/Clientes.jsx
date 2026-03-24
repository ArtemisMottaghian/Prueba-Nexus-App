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
};

const validarForm = (datos) => {
  const err = {};
  if (!datos.nombre) err.nombre = 'El nombre es obligatorio';
  if (!datos.sector) err.sector = 'El sector es obligatorio';
  if (!datos.contactoPrincipal)
    err.contactoPrincipal = 'El contacto es obligatorio';
  if (!datos.email) err.email = 'El email es obligatorio';
  if (!datos.telefono) err.telefono = 'El teléfono es obligatorio';
  return err;
};

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

  const sectores = ['Todos', ...new Set(clientes.map((c) => c.sector))];

  const clientesFiltrados = clientes.filter((c) => {
    const coincideNombre =
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.contactoPrincipal.toLowerCase().includes(busqueda.toLowerCase());
    const coincideSector =
      filtroSector === 'Todos' || c.sector === filtroSector;
    return coincideNombre && coincideSector;
  });

  const abrirModalNuevo = () => {
    setForm(formVacio);
    setErrores({});
    setClienteEditando(null);
    setModalAbierto('nuevo');
  };

  const abrirModalEditar = (e, cliente) => {
    setForm({
      ...cliente,
      cif: cliente.cif || '',
      direccion: cliente.direccion || '',
    });
    setErrores({});
    setClienteEditando(cliente);
    setModalAbierto('editar');
  };

  const abrirModalEliminar = (e, cliente) => {
    setClienteAEliminar(cliente);
    setModalEliminar(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
        setClienteSeleccionado({ ...clienteSeleccionado, ...form });
    }
    setModalAbierto(false);
  };

  const confirmarEliminar = () => {
    setClientes((prev) => prev.filter((c) => c.id !== clienteAEliminar.id));
    if (clienteSeleccionado?.id === clienteAEliminar.id)
      setClienteSeleccionado(null);
    setModalEliminar(false);
  };

  return (
    <div className="clientes-page">
      <div className="mb-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <h2 className="page-title mb-1">Directorio de Clientes</h2>
          <p className="text-muted mb-0">Gestiona tus clientes B2B.</p>
        </div>
        <button className="btn btn-primary" onClick={abrirModalNuevo}>
          + Nuevo cliente
        </button>
      </div>

      <div className="clientes-split">
        <div className="clientes-list-panel">
          <div className="d-flex gap-2 mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <select
              className="form-select"
              value={filtroSector}
              onChange={(e) => setFiltroSector(e.target.value)}
            >
              {sectores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {clientesFiltrados.map((c) => (
            <ClienteCard
              key={c.id}
              cliente={c}
              isSelected={clienteSeleccionado?.id === c.id}
              onClick={setClienteSeleccionado}
              onEdit={abrirModalEditar}
              onDelete={abrirModalEliminar}
            />
          ))}
        </div>
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
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {modalAbierto === 'nuevo'
                      ? 'Nuevo Cliente'
                      : 'Editar Cliente'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setModalAbierto(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Nombre empresa</label>
                      <input
                        name="nombre"
                        value={form.nombre}
                        onChange={handleFormChange}
                        className={`form-control ${errores.nombre ? 'is-invalid' : ''}`}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Sector</label>
                      <input
                        name="sector"
                        value={form.sector}
                        onChange={handleFormChange}
                        className={`form-control ${errores.sector ? 'is-invalid' : ''}`}
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setModalAbierto(false)}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-primary" onClick={guardarCliente}>
                    Guardar Cliente
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
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content p-4 text-center">
                <h5 className="mb-3">
                  ¿Eliminar a <strong>{clienteAEliminar?.nombre}</strong>?
                </h5>
                <div className="d-flex gap-2 justify-content-center">
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
                    Eliminar
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
