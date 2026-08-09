export function LoadingIndicator({ label = 'Wird geladen …' }: { label?: string }) {
  return (
    <span className="loading-indicator" role="status">
      <span className="loading-indicator__mark" aria-hidden="true"><i /><i /><i /></span>
      <span>{label}</span>
    </span>
  );
}
