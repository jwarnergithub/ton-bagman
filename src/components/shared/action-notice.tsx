type ActionNoticeProps = {
  tone: "success" | "error" | "info";
  title: string;
  description: string;
  details?: string[];
};

const toneStyles: Record<ActionNoticeProps["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

export function ActionNotice({
  tone,
  title,
  description,
  details = [],
}: ActionNoticeProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneStyles[tone]}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{description}</p>
      {details.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 opacity-85">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
