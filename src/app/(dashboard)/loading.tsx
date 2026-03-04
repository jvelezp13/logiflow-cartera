export default function DashboardLoading() {
  return (
    <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
