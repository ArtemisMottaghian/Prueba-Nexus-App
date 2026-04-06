import SourceStatus from '../components/dashboard/SourceStatus';
import StatsPipeline from '../components/dashboard/StatsPipeline';
export default function Dashboard() {
  return (
    <>
      <div className="mb-4">
        <h2 className="page-title mb-1">Visión General</h2>
        <p className="text-muted">
          Resumen de actividad de los bots y estado comercial.
        </p>
      </div>
      <SourceStatus />
      <StatsPipeline />
    </>
  );
}
