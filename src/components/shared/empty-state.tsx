type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-sm text-[var(--color-ink-muted)]">
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
    </div>
  );
}
