import React from 'react';
/**
 * Componente reutilizable para campos de correo electrónico en Nexus.
 * Incluye restricción física de caracteres y validación de formato integrada.
 */
export default function EmailInput({ 
  value, 
  onChange, 
  error, 
  name = "email", 
  label = "Correo Electrónico", 
  placeholder = "ejemplo@empresa.com",
  required = false,
  ...props 
}) {
  return (
    <div className="form-group mb-3">
      {label && (
        <label className="form-label fw-medium mb-1">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      
      <div className="input-group has-validation">
        <span className="input-group-text bg-light text-muted">
          <i className="bi bi-envelope" />
        </span>
        <input
          type="email"
          name={name}
          value={value}
          onChange={onChange}
          maxLength={100} // Restricción física inquebrantable de texto masivo
          className={`form-control ${error ? 'is-invalid' : ''}`}
          placeholder={placeholder}
          {...props}
        />
        {error && <div className="invalid-feedback d-block">{error}</div>}
      </div>
    </div>
  );
}

/**
 * Función de validación compartida para el email.
 * Puedes importarla en tus archivos de lógica (como Clientes.jsx) para validar los datos antes de enviar.
 */
export const validarEmailFormato = (email, esObligatorio = true) => {
  if (!email) {
    return esObligatorio ? 'El email es obligatorio' : null;
  }
  
  // Expresión regular que obliga a llevar '@', texto y una extensión de dominio válida (.com, .es, etc.)
 const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return 'Formato de correo no válido (ejemplo: usuario@empresa.com)';
  }
  
  if (email.length > 100) {
    return `El correo es demasiado largo (máximo 100 caracteres).`;
  }
  
  return null; // Sin errores
};
