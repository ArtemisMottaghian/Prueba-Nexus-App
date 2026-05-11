import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/recruitment/shared/FilterBar';
import CandidateGrid from '../components/recruitment/candidates/CandidateGrid';
import BulkActions from '../components/recruitment/shared/BulkActions';
import initialCandidatesData from '../data/candidatesData.json';
import { candidatesService } from '../services/candidatesService';
import { usersService } from '../services/userManagementService';
import { CANDIDATE_STATUS_OPTIONS } from '../constants/candidateStatus';
import { useAuth } from '../context/AuthContext';

import CreateCandidate from '../components/recruitment/candidates/CreateCandidate';
import EditCandidate from '../components/recruitment/candidates/EditCandidate'; // <-- IMPORTAMOS EL MODAL DE EDITAR

const ITEMS_POR_PAGINA = 10;

function filtersToApiQuery(f) {
  const q = {};
  if (f.verified === 'yes') q.verified = true;
  if (f.verified === 'no') q.verified = false;
  if (f.location && f.location !== 'All') q.location = f.location;
  if (f.habilidades && f.habilidades !== 'All') q.skills = f.habilidades;
  if (f.status && f.status !== 'All') q.status = f.status;
  if (f.source && f.source !== 'All') q.source = f.source;
  return q;
}

export default function Candidates() {
  const { user, hasAnyRole } = useAuth();
  const canVerifyCandidates = user?.role === 'admin';
  const isNegocio = hasAnyRole(['admin', 'negocio', 'company']);
  const [filters, setFilters] = useState({
    search: '',
    status: 'All',
    industry: 'All',
    location: 'All',
    source: 'All',
    habilidades: 'All',
    disponibilidad: 'All',
    experiencia: 'All',
    verified: 'All',
  });

  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationOptions, setLocationOptions] = useState([]);
  const [hrUsers, setHrUsers] = useState([]);

  const [paginaActual, setPaginaActual] = useState(1);

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showDescartadas, setShowDescartadas] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null); // <-- ESTADO PARA EDITAR

  const apiListQuery = useMemo(
    () =>
      filtersToApiQuery({
        location: filters.location,
        habilidades: filters.habilidades,
        status: filters.status,
        source: filters.source,
        verified: filters.verified,
      }),
    [
      filters.location,
      filters.habilidades,
      filters.status,
      filters.source,
      filters.verified,
    ]
  );

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locs = await candidatesService.getLocations();
        setLocationOptions(locs);
      } catch (error) {
        console.error('Error al cargar las ubicaciones normalizadas:', error);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await candidatesService.getAllCandidates(apiListQuery);
        if (!cancelled) setCandidates(data);
      } catch {
        if (!cancelled) {
          console.log('Backend offline. Using candidatesData.json...');
          setCandidates(initialCandidatesData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    if (isNegocio) {
      usersService
        .getAllUsers()
        .then((users) => {
          setHrUsers(
            users.filter(
              (u) =>
                u.role === 'negocio' ||
                u.role === 'company' ||
                u.role === 'hr_manager' ||
                u.role === 'reclutador'
            )
          );
        })
        .catch((err) => console.error('Error al cargar usuarios', err));
    }

    return () => {
      cancelled = true;
    };
  }, [apiListQuery, isNegocio]);

  const handleSaveNewCandidate = (newCandidateData) => {
    setCandidates((prev) => [newCandidateData, ...prev]);
    setIsCreateModalOpen(false);
  };

  // --- ELIMINAR CANDIDATO ---
  const handleDeleteCandidate = async (candidateId) => {
    const confirmar = window.confirm(
      '⚠️ ¿Estás seguro de que deseas eliminar este candidato definitivamente? Esta acción no se puede deshacer.'
    );
    if (!confirmar) return;

    try {
      await candidatesService.deleteCandidate(candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
      setSelectedCandidates((prev) => prev.filter((id) => id !== candidateId));
    } catch (error) {
      console.error('Error al eliminar el candidato:', error);
      alert('Hubo un problema al intentar eliminar el candidato.');
    }
  };

  // --- GUARDAR EDICIÓN DE CANDIDATO ---
  const handleSaveEditCandidate = async (candidateId, updatedData) => {
    try {
      // 1. Enviamos los datos al servidor (ya no fallará si no hay JSON)
      await candidatesService.updateCandidate(candidateId, updatedData);

      // 2. Actualizamos el estado local fusionando lo antiguo con lo nuevo
      setCandidates((prev) =>
        prev.map((c) => {
          if (c.id === candidateId) {
            return {
              ...c,
              ...updatedData, // Metemos los datos nuevos
              // Reconstruimos el nombre completo para la tarjeta
              name:
                `${updatedData.first_name || ''} ${updatedData.last_name || ''}`.trim() ||
                c.name,
              // Mapeamos 'skills' al campo 'specialty' que usa la tarjeta visualmente
              specialty: updatedData.skills || c.specialty,
            };
          }
          return c;
        })
      );

      // 3. Cerramos el modal
      setEditingCandidate(null);
    } catch (error) {
      console.error('Error al editar el candidato', error);
      alert('Hubo un error al actualizar el candidato: ' + error.message);
    }
  };

  const handleBulkAssign = async (targetUserId) => {
    const userToAssign = hrUsers.find(
      (u) => String(u.id) === String(targetUserId)
    );
    if (!userToAssign) return;

    try {
      await candidatesService.applyBulkActions(
        selectedCandidates,
        'assign',
        targetUserId
      );
      setSelectedCandidates([]);
    } catch (err) {
      console.error(err);
      alert('Error al asignar candidatos');
    }
  };

  const handleToggleFavorite = async (candidateId, currentIsFavorite) => {
    const newFavoriteStatus = !currentIsFavorite;
    setCandidates((prevCandidates) =>
      prevCandidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, isFavorite: newFavoriteStatus }
          : candidate
      )
    );

    try {
      await candidatesService.toggleFavorite(candidateId, newFavoriteStatus);
    } catch (error) {
      console.error('Error al actualizar favorito en el servidor', error);
      setCandidates((prevCandidates) =>
        prevCandidates.map((candidate) =>
          candidate.id === candidateId
            ? { ...candidate, isFavorite: currentIsFavorite }
            : candidate
        )
      );
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [filterName]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'All',
      industry: 'All',
      location: 'All',
      source: 'All',
      habilidades: 'All',
      disponibilidad: 'All',
      experiencia: 'All',
      verified: 'All',
    });
    setShowFavoritesOnly(false);
    setShowDescartadas(false);
  };

  const handleVerify = async (candidateId, verified) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, verified } : c))
    );
    try {
      await candidatesService.verifyCandidate(candidateId, verified);
    } catch (e) {
      console.error('No se pudo verificar el candidato', e);
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId ? { ...c, verified: !verified } : c
        )
      );
    }
  };

  const handleSelectCandidate = (id) => {
    setSelectedCandidates((prevSelected) => {
      if (prevSelected.includes(id))
        return prevSelected.filter((vacancyId) => vacancyId !== id);
      return [...prevSelected, id];
    });
  };

  const handleUpdateCandidateStatus = (candidateId, newStatus) => {
    setCandidates((prevCandidates) =>
      prevCandidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, status: newStatus }
          : candidate
      )
    );
  };

  const skillsOptions = [
    ...new Set(candidates.map((c) => c.specialty).filter(Boolean)),
  ].sort();

  const DISPONIBILIDAD_OPTIONS = [
    { value: 'disponible', label: 'Disponible' },
    { value: 'no_disponible', label: 'No disponible' },
  ];

  const EXPERIENCIA_OPTIONS = [
    { value: '0-2', label: '0 – 2 años' },
    { value: '3-5', label: '3 – 5 años' },
    { value: '6+', label: '6 o más años' },
  ];

  const parseExperienciaAnios = (exp) => {
    if (!exp) return 0;
    const match = String(exp).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const filteredCandidates = candidates.filter((candidate) => {
    const safeStatus = (candidate.status || '').toLowerCase().trim();
    const arrDiscard = ['descartada', 'discarded', 'rejected', 'descartado'];
    if (filters.status === 'All') {
      const isDiscarded = arrDiscard.includes(safeStatus);
      if (showDescartadas ? !isDiscarded : isDiscarded) return false;
    }

    if (showFavoritesOnly && !candidate.isFavorite) return false;

    const term = (filters.search || '').trim().toLowerCase();
    const matchSearch =
      !term ||
      candidate.name?.toLowerCase().includes(term) ||
      (candidate.email && candidate.email.toLowerCase().includes(term)) ||
      String(candidate.specialty || '')
        .toLowerCase()
        .includes(term);

    const matchEspecialidad =
      filters.industry === 'All' || candidate.specialty === filters.industry;

    const matchDisponibilidad = (() => {
      if (filters.disponibilidad === 'All') return true;
      const isAvail = candidate.isAvailable ?? candidate.is_available ?? false;
      return filters.disponibilidad === 'disponible' ? isAvail : !isAvail;
    })();

    const matchExperiencia = (() => {
      if (filters.experiencia === 'All') return true;
      const anios = parseExperienciaAnios(candidate.experience);
      if (filters.experiencia === '0-2') return anios >= 0 && anios <= 2;
      if (filters.experiencia === '3-5') return anios >= 3 && anios <= 5;
      if (filters.experiencia === '6+') return anios >= 6;
      return true;
    })();

    return (
      matchSearch &&
      matchEspecialidad &&
      matchDisponibilidad &&
      matchExperiencia
    );
  });

  useEffect(() => {
    setPaginaActual(1);
  }, [filters, showFavoritesOnly, showDescartadas]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredCandidates.length / ITEMS_POR_PAGINA)
  );
  const paginaSafe = Math.min(paginaActual, totalPaginas);

  const candidatesPaginados = useMemo(() => {
    const inicio = (paginaSafe - 1) * ITEMS_POR_PAGINA;
    return filteredCandidates.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [filteredCandidates, paginaSafe]);

  const irAPagina = (p) =>
    setPaginaActual(Math.max(1, Math.min(p, totalPaginas)));

  const paginasVisibles = useMemo(() => {
    let inicio = Math.max(1, paginaSafe - 1);
    let fin = Math.min(totalPaginas, inicio + 2);
    if (fin - inicio < 2) inicio = Math.max(1, fin - 2);
    const pages = [];
    for (let i = inicio; i <= fin; i++) pages.push(i);
    return pages;
  }, [paginaSafe, totalPaginas]);

  const desde =
    filteredCandidates.length === 0
      ? 0
      : (paginaSafe - 1) * ITEMS_POR_PAGINA + 1;
  const hasta = Math.min(
    paginaSafe * ITEMS_POR_PAGINA,
    filteredCandidates.length
  );

  return (
    <>
      <div className="controls-container sticky-controls">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          statusOptions={CANDIDATE_STATUS_OPTIONS}
          sourceOptions={[
            { value: 'LinkedIn', label: 'LinkedIn' },
            { value: 'InfoJobs', label: 'InfoJobs' },
            { value: 'Carga Manual', label: 'Carga Manual' },
            { value: 'GitHub API', label: 'GitHub API' },
          ]}
          locationOptions={locationOptions}
          skillsOptions={skillsOptions}
          disponibilidadOptions={DISPONIBILIDAD_OPTIONS}
          experienciaOptions={EXPERIENCIA_OPTIONS}
          showVerifiedFilter
        />

        {selectedCandidates.length > 0 && (
          <div className="bulk-actions-wrapper animate__animated animate__fadeInDown animate__faster">
            <BulkActions
              selectedCount={selectedCandidates.length}
              onDiscard={async () => {
                const idsToDiscard = [...selectedCandidates];
                if (idsToDiscard.length === 0) return;
                const idSet = new Set(idsToDiscard);

                setCandidates((prev) =>
                  prev.map((candidate) =>
                    idSet.has(candidate.id)
                      ? { ...candidate, status: 'Descartado' }
                      : candidate
                  )
                );

                await Promise.allSettled(
                  idsToDiscard.map((id) =>
                    candidatesService.updateCandidateStatus(id, 'Descartado')
                  )
                );

                setSelectedCandidates([]);
              }}
              onClear={() => setSelectedCandidates([])}
              onAssign={handleBulkAssign}
              hrUsers={hrUsers}
              showAssign={isNegocio}
              label="candidato"
            />
          </div>
        )}
      </div>

      {!loading && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted small">
            Mostrando {filteredCandidates.length} candidatos de{' '}
            {candidates.length}
          </div>

          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <i className="bi bi-person-plus-fill me-2"></i>
              Añadir Candidato
            </button>

            <button
              className={`btn btn-sm ${showDescartadas ? 'btn-danger' : 'btn-outline-secondary'}`}
              onClick={() => {
                setShowDescartadas(!showDescartadas);
                setPaginaActual(1);
              }}
              title="Los candidatos descartados están ocultos por defecto"
            >
              <i
                className={`bi ${showDescartadas ? 'bi-eye-fill' : 'bi-eye-slash'} me-2`}
              ></i>
              {showDescartadas ? 'Ver Activos' : 'Ver Descartados'}
            </button>
            <button
              className={`btn btn-sm ${showFavoritesOnly ? 'btn-warning' : 'btn-outline-secondary'}`}
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setShowDescartadas(false);
              }}
            >
              <i
                className={`bi ${showFavoritesOnly ? 'bi-star-fill' : 'bi-star'} me-2`}
              ></i>
              Solo Favoritos
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center p-5 text-muted">Cargando candidatos...</div>
      ) : (
        <CandidateGrid
          candidates={candidatesPaginados}
          activeFilters={null}
          selectedCandidates={selectedCandidates}
          onSelectCandidate={handleSelectCandidate}
          onUpdateCandidateStatus={handleUpdateCandidateStatus}
          onToggleFavorite={handleToggleFavorite}
          onVerify={canVerifyCandidates ? handleVerify : undefined}
          onDeleteCandidate={handleDeleteCandidate}
          onEditCandidate={setEditingCandidate} // <--- AQUÍ ESTÁ LA CONEXIÓN CLAVE
        />
      )}
      {!loading && totalPaginas > 1 && (
        <div className="clientes-pagination" style={{ marginTop: '1rem' }}>
          <span className="clientes-pagination__info">
            {desde}–{hasta} de {filteredCandidates.length}
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

      {isCreateModalOpen && (
        <CreateCandidate
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleSaveNewCandidate}
        />
      )}

      {/* RENDERIZAMOS EL MODAL DE EDITAR SI HAY UN CANDIDATO SELECCIONADO */}
      {editingCandidate && (
        <EditCandidate
          candidate={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          onSave={handleSaveEditCandidate}
        />
      )}
    </>
  );
}
