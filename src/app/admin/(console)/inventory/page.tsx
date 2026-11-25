"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { getAdminRecords } from "@/lib/admin-records";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { useDemo } from "@/lib/store";
import { AdminPageHeader, AdminKpis } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSearch,
  AdminSelect,
} from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/admin-controls";

type StockRow = {
  product_id: string;
  variant_id: string;
  available: number;
};
type Movement = {
  id: string;
  productId: string;
  variantId: string;
  before: number;
  after: number;
  delta: number;
  reason: string;
  actor: string;
  createdAt: string;
};

export default function InventoryPage() {
  const { state, actions, refresh } = useDemo();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [movements, setMovements] = useState<Movement[]>([]);
  const [query, setQuery] = useState("");
  const [vendor, setVendor] = useState("all");
  const [category, setCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [threshold, setThreshold] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAvailable, setBulkAvailable] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const rows = await api<StockRow[]>("/api/admin/inventory");
    setStock(
      Object.fromEntries(
        rows.map((row) => [
          row.product_id + ":" + row.variant_id,
          row.available,
        ]),
      ),
    );
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.product_id + ":" + row.variant_id,
          String(row.available),
        ]),
      ),
    );
    if (state.adminSession) {
      setMovements(
        (await getAdminRecords<Movement>("stockMovements")).slice(0, 20),
      );
    }
  };

  useEffect(() => {
    void load().catch((error) => setMessage((error as Error).message));
  }, []);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return state.products
      .flatMap((product) =>
        product.variants.map((variant) => {
          const key = product.id + ":" + variant.id;
          const available = stock[key] ?? 0;
          const vendorName =
            state.vendors.find((item) => item.id === product.vendorId)?.name ??
            product.vendorId;
          const categoryName =
            state.categories.find((item) => item.slug === product.categorySlug)
              ?.name ?? product.categorySlug;
          return { product, variant, key, available, vendorName, categoryName };
        }),
      )
      .filter((row) => {
        if (vendor !== "all" && row.product.vendorId !== vendor) return false;
        if (category !== "all" && row.product.categorySlug !== category)
          return false;
        if (lowOnly && row.available >= threshold) return false;
        if (!term) return true;
        return [
          row.product.name,
          row.product.sku,
          row.variant.sku,
          row.vendorName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
  }, [
    state.products,
    state.vendors,
    state.categories,
    stock,
    query,
    vendor,
    category,
    lowOnly,
    threshold,
  ]);

  async function runCommand(name: string, args: unknown[], success: string) {
    await api("/api/commands", { name, args, key: crypto.randomUUID() });
    await Promise.all([load(), refresh()]);
    setMessage(success);
    actions.notify(success, "success");
  }

  async function save(row: (typeof rows)[number]) {
    const available = Number(drafts[row.key] ?? row.available);
    const reason = reasons[row.key]?.trim();
    if (!Number.isInteger(available) || available < 0) {
      setMessage("Enter a whole number of available units.");
      return;
    }
    if (!reason || reason.length < 3) {
      setMessage("Add a reason of at least 3 characters for this adjustment.");
      return;
    }
    setBusy(true);
    try {
      await runCommand(
        "adjustStock",
        [
          {
            productId: row.product.id,
            variantId: row.variant.id,
            available,
            reason,
          },
        ],
        "Stock saved with an audited movement.",
      );
      setReasons((current) => ({ ...current, [row.key]: "" }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applyBulk() {
    const available = Number(bulkAvailable);
    if (!selected.length || !Number.isInteger(available) || available < 0) {
      setMessage("Select rows and enter a valid quantity.");
      return;
    }
    if (!bulkReason.trim() || bulkReason.trim().length < 3) {
      setMessage("Add a reason for the bulk adjustment.");
      return;
    }
    setBusy(true);
    try {
      for (const key of selected) {
        const [productId, variantId] = key.split(":");
        await api("/api/commands", {
          name: "adjustStock",
          args: [
            {
              productId,
              variantId,
              available,
              reason: bulkReason.trim() + " (bulk)",
            },
          ],
          key: crypto.randomUUID(),
        });
      }
      await Promise.all([load(), refresh()]);
      setMessage("Updated " + selected.length + " variants.");
      setSelected([]);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function exportStock() {
    downloadCsv("paydan-stock.csv", [
      ["productId", "variantId", "available", "reason"],
      ...rows.map((row) => [
        row.product.id,
        row.variant.id,
        Number(drafts[row.key] ?? row.available),
        reasons[row.key] || "CSV export",
      ]),
    ]);
  }

  async function importStock(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const [header, ...data] = parseCsv(await file.text());
      const index = (name: string) => header.indexOf(name);
      setBusy(true);
      for (const row of data) {
        await api("/api/commands", {
          name: "adjustStock",
          args: [
            {
              productId: row[index("productId")],
              variantId: row[index("variantId")],
              available: Number(row[index("available")]),
              reason: row[index("reason")] || "CSV import",
            },
          ],
          key: crypto.randomUUID(),
        });
      }
      await Promise.all([load(), refresh()]);
      setMessage("Imported " + data.length + " stock adjustments.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalUnits = rows.reduce((sum, row) => sum + row.available, 0);
  const lowCount = rows.filter((row) => row.available < threshold).length;
  const outCount = rows.filter((row) => row.available === 0).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Inventory"
        description="Record confirmed, unreserved units. Every adjustment has a reason and an audited movement."
      />
      <AdminKpis
        items={[
          {
            label: "Variant rows",
            value: rows.length,
            note: "Matching the current filters",
          },
          {
            label: "Available units",
            value: totalUnits,
            note: "Confirmed and unreserved",
          },
          {
            label: "Low stock",
            value: lowCount,
            note: "Below " + threshold + " units",
          },
          {
            label: "Out of stock",
            value: outCount,
            note: "Checkout is blocked",
          },
        ]}
      />

      <div className="inventory-toolbar">
        <AdminSearch
          value={query}
          onChange={setQuery}
          label="Search inventory"
          placeholder="Search product, SKU or supplier…"
        />
        <AdminSelect
          label="Supplier"
          value={vendor}
          onChange={setVendor}
          options={[
            { value: "all", label: "All suppliers" },
            ...state.vendors.map((item) => ({
              value: item.id,
              label: item.name,
            })),
          ]}
        />
        <AdminSelect
          label="Department"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All departments" },
            ...state.categories.map((item) => ({
              value: item.slug,
              label: item.name,
            })),
          ]}
        />
        <label>
          Low-stock threshold
          <input
            type="number"
            min={0}
            max={1000}
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </label>
        <label className="choice">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(event) => setLowOnly(event.target.checked)}
          />
          <span>Low stock only</span>
        </label>
        <button className="admin-btn quiet" type="button" onClick={exportStock}>
          Export CSV
        </button>
        <button
          className="admin-btn quiet"
          type="button"
          disabled={busy}
          onClick={() => importRef.current?.click()}
        >
          Import CSV
        </button>
        <input
          ref={importRef}
          hidden
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void importStock(event)}
        />
      </div>

      <section className="admin-card">
        <div className="inventory-toolbar">
          <strong>{selected.length} variants selected</strong>
          <label>
            Quantity for selected
            <input
              type="number"
              min={0}
              max={1000000}
              value={bulkAvailable}
              onChange={(event) => setBulkAvailable(event.target.value)}
            />
          </label>
          <label>
            Reason
            <input
              value={bulkReason}
              maxLength={200}
              onChange={(event) => setBulkReason(event.target.value)}
              placeholder="Stock count or delivery received"
            />
          </label>
          <button
            className="admin-btn secondary"
            type="button"
            disabled={!selected.length || busy}
            onClick={() => void applyBulk()}
          >
            Apply to selected
          </button>
        </div>
        {message ? <p role="status">{message}</p> : null}
      </section>

      {rows.length === 0 ? (
        <AdminEmpty
          title="No stock rows match"
          hint="Change the filters, or add product variants in the catalogue."
        />
      ) : (
        <div className="operations-list">
          {rows.map((row) => {
            const blocked =
              row.product.availability !== "in_stock" ||
              state.categories.find(
                (item) => item.slug === row.product.categorySlug,
              )?.active === false;
            return (
              <article key={row.key}>
                <label className="inventory-row-label">
                  <input
                    type="checkbox"
                    checked={selected.includes(row.key)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, row.key]
                          : current.filter((key) => key !== row.key),
                      )
                    }
                  />
                  <span>
                    <strong>{row.product.name}</strong>
                    <small>
                      {row.variant.label} · {row.variant.sku} · {row.vendorName}{" "}
                      · {row.categoryName}
                    </small>
                  </span>
                </label>
                <div className="admin-actions">
                  {row.available < threshold ? (
                    <StatusBadge value="Reorder soon" tone="warn" />
                  ) : (
                    <StatusBadge
                      value={row.available ? "Available" : "Out"}
                      tone={row.available ? "good" : "bad"}
                    />
                  )}
                  <label>
                    Available
                    <input
                      type="number"
                      min={0}
                      max={1000000}
                      value={drafts[row.key] ?? row.available}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Reason
                    <input
                      value={reasons[row.key] ?? ""}
                      maxLength={200}
                      placeholder="Required for each change"
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [row.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    className="admin-btn"
                    type="button"
                    disabled={busy}
                    onClick={() => void save(row)}
                  >
                    Save stock
                  </button>
                </div>
                {blocked ? (
                  <p className="admin-muted">
                    Checkout stays blocked for this variant because its
                    availability is{" "}
                    {row.product.availability.replaceAll("_", " ")} or its
                    department is archived. Stock alone will not publish it for
                    sale.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <section className="admin-card" style={{ marginTop: "1rem" }}>
        <h2>Recent stock movements</h2>
        {movements.length ? (
          <div className="operations-list">
            {movements.map((movement) => (
              <div className="queue-item" key={movement.id}>
                <span>
                  <strong>{movement.reason}</strong>
                  <br />
                  {movement.productId} · {movement.variantId} ·{" "}
                  {movement.before} → {movement.after} by {movement.actor}
                </span>
                <span>{new Date(movement.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="admin-muted">No stock movements recorded yet.</p>
        )}
      </section>
    </>
  );
}
