type StatusCardProps = {
  title: string;
  description: string;
  badge: string;
};

export function StatusCard({ title, description, badge }: StatusCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-panel)] p-5 shadow-[var(--shadow-panel)]">
      <div className="mb-4 inline-flex rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
        {badge}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-[var(--color-ink-muted)]">
        {description}
      </p>
    </article>
  );
}
