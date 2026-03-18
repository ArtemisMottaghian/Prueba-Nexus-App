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