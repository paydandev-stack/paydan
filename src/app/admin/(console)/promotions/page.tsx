"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSelect,
  AdminTable,
  AdminTextArea,
  AdminTextField,
} from "@/components/admin/data-table";
import type { Voucher } from "@/lib/types";
import { money, plural } from "@/lib/format";
type VoucherDraft = {
  code: string;
  type: Voucher["type"];
  value: string;
  minimum: string;
  description: string;
};
const blankDraft: VoucherDraft = {
  code: "",
  type: "fixed",
  value: "",
  minimum: "",
  description: "",
};
function discountLabel(voucher: Voucher): string {
  return voucher.type === "fixed"
    ? `${money(voucher.value)} off`
    : `${voucher.value}% off`;
}
/** Voucher catalogue: create/edit form plus the live list with active toggles. */
export default function AdminPromotionsPage() {
  const { state, actions } = useDemo();
  const [draft, setDraft] = useState<VoucherDraft>(blankDraft);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const startEdit = (voucher: Voucher) => {
    setEditingCode(voucher.code);
    setDraft({
      code: voucher.code,
      type: voucher.type,
      value: String(voucher.value),
      minimum: String(voucher.minimum),
      description: voucher.description,
    });
  };
  const cancelEdit = () => {
    setEditingCode(null);
    setDraft(blankDraft);
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      // Codes are normalised to uppercase; they are the key saveVoucher matches on.
      const code = draft.code.trim().toUpperCase();
      const value = Number(draft.value);
      const minimum = draft.minimum.trim() === "" ? 0 : Number(draft.minimum);
      if (!code) {
        actions.notify("Enter a voucher code before saving.", "error");
        return;
      }
      if (!Number.isFinite(value) || value <= 0) {
        actions.notify(`Enter a discount value for ${code}.`, "error");
        return;
      }
      if (draft.type === "percent" && value > 100) {
        actions.notify(
          "A percentage discount cannot be higher than 100%.",
          "error",
        );
        return;
      }
      if (!Number.isFinite(minimum) || minimum < 0) {
        actions.notify("Minimum order must be zero or more.", "error");
        return;
      }
      if (editingCode === null) {
        const clash = state.vouchers.find(
          (item) => item.code.toUpperCase() === code,
        );
        if (clash) {
          actions.notify(
            `Code ${code} already exists — edit that voucher instead of creating a duplicate.`,
            "error",
          );
          return;
        }
      }
      const existing =
        editingCode === null
          ? undefined
          : state.vouchers.find((item) => item.code === editingCode);
      const voucher: Voucher = {
        // While editing, the code is locked to the record being changed.
        code: editingCode ?? code,
        type: draft.type,
        value,
        minimum,
        description: draft.description.trim(),
        active: existing?.active ?? true,
      };
      await actions.saveVoucher(voucher);
      cancelEdit();
    } catch (error) {}
  };
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Promotions"
        description={`${plural(state.vouchers.length, "promotion", "promotions")} managed by your team · codes are unique and case-insensitive, saved in upper case`}
        action={
          <>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setEditingCode(null);
                setDraft(blankDraft);
              }}
            >
              New voucher
            </button>
            <Link className="admin-btn quiet" href="/admin/promotions/banners">
              Banners
            </Link>
          </>
        }
      />

      <div className="admin-notice">
        Active promotion codes are checked at checkout. Discounts apply to
        merchandise after the minimum spend is met.
      </div>

      {state.vouchers.length === 0 ? (
        <AdminEmpty
          title="No vouchers yet"
          hint="Create your first promotion code below."
        />
      ) : (
        <AdminTable
          template=".9fr .9fr .9fr 1.2fr 1fr"
          head={["Code", "Discount", "Minimum order", "Description", "Actions"]}
          caption="Voucher codes with their discount, threshold, status toggle and edit action"
        >
          {state.vouchers.map((voucher) => (
            <div className="table-row" key={voucher.code}>
              <span style={{ fontWeight: 700 }}>{voucher.code}</span>
              <span>{discountLabel(voucher)}</span>
              <span>
                {voucher.minimum > 0 ? money(voucher.minimum) : "No minimum"}
              </span>
              <span style={{ color: "var(--muted)" }}>
                {voucher.description}
              </span>
              <span
                style={{
                  display: "flex",
                  gap: ".4rem",
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className={`admin-chip${voucher.active ? " active" : ""}`}
                  aria-pressed={voucher.active}
                  onClick={async () => {
                    try {
                      return await actions.toggleVoucher(voucher.code);
                    } catch (error) {}
                  }}
                >
                  {voucher.active ? "Active" : "Paused"}
                </button>
                <button
                  type="button"
                  className="admin-btn quiet"
                  onClick={() => startEdit(voucher)}
                >
                  Edit
                </button>
              </span>
            </div>
          ))}
        </AdminTable>
      )}

      <section className="admin-card" style={{ marginTop: "1.5rem" }}>
        <h2>{editingCode ? `Edit ${editingCode}` : "Create a voucher"}</h2>
        <p>
          {editingCode
            ? "The code itself is locked while editing because the console action matches vouchers by code — create a new voucher if the code needs to change."
            : "Codes are saved in upper case. Pick something a customer could type at checkout."}
        </p>

        <form className="form-grid" onSubmit={save}>
          <AdminTextField
            label="Code"
            required
            readOnly={editingCode !== null}
            hint={
              editingCode !== null
                ? "Locked to the voucher being edited."
                : "Stored in upper case, e.g. PAYDAN10."
            }
            value={draft.code}
            onChange={(event) =>
              setDraft({ ...draft, code: event.target.value })
            }
          />
          <AdminSelect
            label="Discount type"
            value={draft.type}
            onChange={(value) =>
              setDraft({ ...draft, type: value as Voucher["type"] })
            }
            options={[
              { value: "fixed", label: "Fixed amount off (₦)" },
              { value: "percent", label: "Percentage off (%)" },
            ]}
          />
          <AdminTextField
            label={
              draft.type === "fixed" ? "Amount off (₦)" : "Percentage off (%)"
            }
            type="number"
            min={1}
            max={draft.type === "percent" ? 100 : undefined}
            required
            value={draft.value}
            onChange={(event) =>
              setDraft({ ...draft, value: event.target.value })
            }
          />
          <AdminTextField
            label="Minimum order (₦)"
            type="number"
            min={0}
            hint="0 means no minimum."
            value={draft.minimum}
            onChange={(event) =>
              setDraft({ ...draft, minimum: event.target.value })
            }
          />
          <AdminTextArea
            label="Description"
            wide
            hint="Shown to operators; repeats what the code does."
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
          />
          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            {editingCode !== null ? (
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            ) : null}
            <button type="submit" className="primary">
              {editingCode !== null ? "Save changes" : "Create voucher"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
