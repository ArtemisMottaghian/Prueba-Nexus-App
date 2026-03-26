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