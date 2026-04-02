type DataPillProps = {
  label: string;
  value: string;
};

export function DataPill({ label, value }: DataPillProps) {
  return (
    <div className="max-w-full rounded-full border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-xs">
      <span className="uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
        {label}
      </span>{" "}
      <span className="font-medium text-[var(--color-ink)] [overflow-wrap:anywhere]">
        {value}
      </span>
    </div>
  );
}
