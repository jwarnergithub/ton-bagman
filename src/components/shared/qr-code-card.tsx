"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrCodeCardProps = {
  value: string;
  title: string;
  description: string;
};

export function QrCodeCard({ value, title, description }: QrCodeCardProps) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderQrCode() {
      try {
        const svg = await QRCode.toString(value, {
          errorCorrectionLevel: "M",
          margin: 1,
          type: "svg",
          width: 224,
        });

        if (!cancelled) {
          setSvgMarkup(svg);
          setErrorMessage(null);
        }
      } catch {
        if (!cancelled) {
          setSvgMarkup(null);
          setErrorMessage("QR code rendering failed.");
        }
      }
    }

    void renderQrCode();

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{description}</p>

      {svgMarkup ? (
        <div className="mt-4 flex justify-center rounded-2xl bg-white p-4">
          <div
            className="h-56 w-56"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </div>
      ) : (
        <div className="mt-4 flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-panel)] px-4 py-6 text-sm text-[var(--color-ink-muted)]">
          {errorMessage ?? "Rendering QR code..."}
        </div>
      )}
    </div>
  );
}
