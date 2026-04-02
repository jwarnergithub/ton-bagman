type KeyValueListProps = {
  items: Array<{
    label: string;
    value: string;
  }>;
};

export function KeyValueList({ items }: KeyValueListProps) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
        >
          <dt className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm font-medium text-[var(--color-ink)] [overflow-wrap:anywhere]">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
