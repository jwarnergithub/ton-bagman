type JsonResultProps = {
  ok: boolean;
  payload: string;
};

export function JsonResult({ ok, payload }: JsonResultProps) {
  return (
    <pre
      className={`overflow-x-auto rounded-2xl px-4 py-3 text-xs leading-6 ${
        ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
      }`}
    >
      {payload}
    </pre>
  );
}
