import { useEffect, useState } from 'react';
import BotStatusGrid from '../components/dashboard/BotStatusGrid';
import StatsPanel from '../components/dashboard/StatsPanel';

export default function Dashboard() {
  const [periodType, setPeriodType] = useState('day');
  const [stats, setStats] = useState({
    nuevas: { value: 0, change: 0 },
    contactadas: { value: 0, change: 0 },
    enProceso: { value: 0, change: 0 },
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStats = async () => {
      try {
        setLoadingStats(true);

        // Endpoints reales del proyecto.
        const response = await fetch(`/api/metrics?periodType=${periodType}`);
        if (!response.ok) {
          throw new Error(`Error al cargar stats (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          // Si Vite devuelve HTML (fallback) o el backend no responde como JSON,
          // así lo sabremos al instante.
          const text = await response.text();
          console.error(
            'API /api/metrics no devolvió JSON. Content-Type:',
            contentType,
            'Response (primeros 500 chars):',
            text.slice(0, 500)
          );
          throw new Error('Respuesta no-JSON de /api/metrics');
        }

        const data = await response.json();
        if (!isMounted) return;

        const toNumber = (v) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            const parsed = Number.parseFloat(v);
            return Number.isNaN(parsed) ? undefined : parsed;
          }
          return undefined;
        };

        const pickFromKeys = (obj, keys, fields) => {
          for (const key of keys) {
            if (!obj || obj[key] == null) continue;

            const direct = toNumber(obj[key]);
            if (direct !== undefined) return direct;

            const candidate = obj[key];
            if (typeof candidate !== 'object') continue;

            for (const field of fields) {
              const nested = toNumber(candidate?.[field]);
              if (nested !== undefined) return nested;
            }
          }
          return 0;
        };

        // Valor absoluto (número total)
        const nuevasValue = pickFromKeys(
          data,
          ['nuevas', 'newLeads', 'new_leads', 'newCount', 'new_count'],
          ['value', 'count', 'total']
        );

        const contactadasValue = pickFromKeys(
          data,
          [
            'contactadas',
            'contactedLeads',
            'contacted_leads',
            'contactedCount',
            'contacted_count',
          ],
          ['value', 'count', 'total']
        );

        const enProcesoValue = pickFromKeys(
          data,
          [
            'enProceso',
            'inProgress',
            'inProgressLeads',
            'in_progress',
            'in_progress_leads',
            'inProgressCount',
            'in_progress_count',
          ],
          ['value', 'count', 'total']
        );

        // Cambio en porcentaje (%)
        const nuevasChange = pickFromKeys(
          data,
          [
            'nuevasChange',
            'newLeadsChange',
            'new_leads_change',
            'newChange',
            'new_change',
          ],
          ['change', 'delta', 'percent', 'percentage']
        );

        const contactadasChange = pickFromKeys(
          data,
          [
            'contactadasChange',
            'contactedLeadsChange',
            'contacted_leads_change',
            'contactedChange',
            'contacted_change',
          ],
          ['change', 'delta', 'percent', 'percentage']
        );

        const enProcesoChange = pickFromKeys(
          data,
          [
            'enProcesoChange',
            'inProgressChange',
            'in_progress_change',
            'inProgressLeadsChange',
            'in_progress_leads_change',
          ],
          ['change', 'delta', 'percent', 'percentage']
        );

        setStats({
          nuevas: { value: nuevasValue, change: nuevasChange },
          contactadas: { value: contactadasValue, change: contactadasChange },
          enProceso: { value: enProcesoValue, change: enProcesoChange },
        });
      } catch (error) {
        console.error('No se pudieron cargar las estadísticas:', error);
        if (!isMounted) return;
        setStats({
          nuevas: { value: 0, change: 0 },
          contactadas: { value: 0, change: 0 },
          enProceso: { value: 0, change: 0 },
        });
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [periodType]);

  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Visión General</h2>
        <p className="text-muted">Resumen de actividad de los bots y estado comercial.</p>
        <div className="btn-group mt-3" role="group" aria-label="Filtro de periodo">
          <button
            type="button"
            className={`btn btn-sm ${
              periodType === 'day' ? 'btn-primary' : 'btn-outline-primary'
            }`}
            onClick={() => setPeriodType('day')}
            disabled={loadingStats}
          >
            Día
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              periodType === 'week' ? 'btn-primary' : 'btn-outline-primary'
            }`}
            onClick={() => setPeriodType('week')}
            disabled={loadingStats}
          >
            Semana
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              periodType === 'month' ? 'btn-primary' : 'btn-outline-primary'
            }`}
            onClick={() => setPeriodType('month')}
            disabled={loadingStats}
          >
            Mes
          </button>
        </div>
      </div>
      <BotStatusGrid />
      <StatsPanel stats={stats} />
    </>
  );
}