import BotStatusGrid from '../components/dashboard/BotStatusGrid';
import StatsPanel from '../components/dashboard/StatsPanel';

export default function Dashboard() {
  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Visión General</h2>
        <p className="text-muted">
          Resumen de actividad de los bots y estado comercial.
        </p>
      </div>
      <BotStatusGrid />
      <StatsPanel />
    </>
  );
}
