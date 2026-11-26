"use client";

import Image from "@/components/safe-image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { money } from "@/lib/format";

export type AssistantCartLine = {
  productId: string;
  variantId: string;
  quantity: number;
  productName: string;
  variantLabel: string;
  price?: number;
  lineTotal?: number;
  image?: string;
  slug?: string;
};

function lineKey(line: AssistantCartLine) {
  return `${line.productId}:${line.variantId}`;
}

export function AssistantCartResult({
  lines,
  busy,
  onPrepareRemoval,
}: {
  lines: AssistantCartLine[];
  busy: boolean;
  onPrepareRemoval: (lines: AssistantCartLine[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedLines = useMemo(
    () => lines.filter((line) => selected.includes(lineKey(line))),
    [lines, selected],
  );
  const total = lines.reduce(
    (sum, line) => sum + (line.lineTotal ?? (line.price ?? 0) * line.quantity),
    0,
  );

  return (
    <section className="ask-cart-result" aria-label="Current cart items">
      <header>
        <span>
          {lines.length} cart {lines.length === 1 ? "line" : "lines"}
        </span>
        <strong>{money(total)}</strong>
      </header>
      <div className="ask-cart-lines">
        {lines.map((line) => {
          const key = lineKey(line);
          const checked = selected.includes(key);
          return (
            <label className={checked ? "selected" : undefined} key={key}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(key)
                      ? current.filter((item) => item !== key)
                      : [...current, key],
                  )
                }
              />
              {line.image ? (
                <Image src={line.image} alt="" width={54} height={54} />
              ) : (
                <span className="ask-cart-placeholder" aria-hidden="true" />
              )}
              <span className="ask-cart-line-copy">
                {line.slug ? (
                  <Link href={`/product/${line.slug}`}>{line.productName}</Link>
                ) : (
                  <strong>{line.productName}</strong>
                )}
                <small>
                  {line.variantLabel || "Standard"} · Qty {line.quantity}
                </small>
              </span>
              <strong>
                {money(line.lineTotal ?? (line.price ?? 0) * line.quantity)}
              </strong>
            </label>
          );
        })}
      </div>
      <footer>
        <small>
          Select items first. Nothing changes until you confirm the proposal.
        </small>
        <button
          type="button"
          disabled={busy || selectedLines.length === 0}
          onClick={() => void onPrepareRemoval(selectedLines)}
        >
          {busy
            ? "Preparing…"
            : `Review removal${selectedLines.length ? ` (${selectedLines.length})` : ""}`}
        </button>
      </footer>
    </section>
  );
}
