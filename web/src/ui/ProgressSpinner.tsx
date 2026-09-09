export function ProgressSpinner({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}
