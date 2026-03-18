import { useState } from 'react';

export default function BulkActions({ selectedCount = 0, onDiscard, onAssign, onClear }) {
  const [assignTarget, setAssignTarget] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar d-flex align-items-center justify-content-between px-4 py-3 mb-3">
      <div className="d-flex align-items-center gap-3">
        <span className="bulk-count">
          <i className="bi bi-check2-square me-2"></i>
          {selectedCount} vacante{selectedCount !== 1 ? 's' : ''} seleccionada{selectedCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="d-flex align-items-center gap-2">
        {/* Asignar a */}
        <select
          className="form-select form-select-sm bulk-select"
          value={assignTarget}
          onChange={(e) => setAssignTarget(e.target.value)}
        >
          <option value="">Asignar a...</option>
          <option value="diego">Diego Santos</option>
          <option value="maria">María García</option>
          <option value="carlos">Carlos López</option>
        </select>
        <button
          className="btn btn-sm btn-bulk-assign"
          onClick={() => onAssign?.(assignTarget)}
          disabled={!assignTarget}
        >
          <i className="bi bi-person-check me-1"></i>
          Asignar
        </button>

        {/* Descartar */}
        <button
          className="btn btn-sm btn-bulk-discard"
          onClick={onDiscard}
        >
          <i className="bi bi-trash me-1"></i>
          Descartar
        </button>

        {/* Limpiar selección */}
        <button
          className="btn-icon btn-icon-sm"
          onClick={onClear}
          title="Limpiar selección"
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>
    </div>
  );
}