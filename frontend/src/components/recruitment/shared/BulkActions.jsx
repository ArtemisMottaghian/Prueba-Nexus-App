import './BulkActions.css';
import { useState } from 'react';

export default function BulkActions({
  selectedCount = 0,
  onDiscard,
  onAssign,
  onUnassign,
  onClear,
  label = 'candidato',
  hrUsers = [],
  showAssign = false,
}) {
  const [assignTarget, setAssignTarget] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <div className="d-flex align-items-center">
        <span className="bulk-count">
          <i className="bi bi-check2-square me-2"></i>
          {selectedCount} {label}
          {selectedCount !== 1 ? 's' : ''} seleccionada
          {selectedCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bulk-actions-right">
        <div className="bulk-actions-controls">
          {showAssign && (
            <>
              <select
                className="form-select form-select-sm bulk-select"
                value={assignTarget}
                onChange={(e) => setAssignTarget(e.target.value)}
              >
                <option value="">Asignar a...</option>
                {hrUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-sm btn-bulk-assign"
                onClick={() => onAssign?.(assignTarget)}
                disabled={!assignTarget}
                title="Asignar"
              >
                <i className="bi bi-person-check"></i>
                <span className="d-none d-sm-inline ms-1">Asignar</span>
              </button>

              <button
                className="btn btn-sm btn-bulk-discard"
                onClick={onUnassign}
                title="Quitar reclutador"
              >
                <i className="bi bi-person-dash"></i>
                <span className="d-none d-sm-inline ms-1">Quitar</span>
              </button>
            </>
          )}

          <button
            className="btn btn-sm btn-bulk-discard"
            onClick={onDiscard}
            title="Descartar"
          >
            <i className="bi bi-trash"></i>
            <span className="d-none d-sm-inline ms-1">Descartar</span>
          </button>
        </div>

        <div className="bulk-actions-close-group">
          <div className="bulk-divider"></div>
          <button
            className="btn-bulk-close"
            onClick={onClear}
            title="Limpiar selección"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
