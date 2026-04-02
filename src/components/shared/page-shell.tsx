import Link from "next/link";
import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const navigation = [
  { href: "/", label: "Bag Management" },
  { href: "/create", label: "Bag Creation" },
  { href: "/providers", label: "Providers" },
  { href: "/my-provider", label: "My Provider" },
  { href: "/settings", label: "Safety" },
];

export function PageShell({
  eyebrow,
  title,
  description,
  children,
}: PageShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:px-10">
      <header className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface-panel)]/95 p-6 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--color-accent-strong)]">
              {eyebrow}
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight [overflow-wrap:anywhere]">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-ink-muted)]">
                {description}
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-3">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-ink-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
