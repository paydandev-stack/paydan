"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { nigerianStates } from "@/lib/catalog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, money, plural } from "@/lib/format";
import { productStatusMeta, vendorStatusMeta } from "@/lib/status";
import type { Vendor, VendorStatus } from "@/lib/types";
type VendorForm = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  categorySlugs: string[];
  leadTimeDays: string;
  paymentTerms: string;
  notes: string;
};
function toForm(vendor: Vendor): VendorForm {
  return {
    name: vendor.name,
    contactName: vendor.contactName,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    city: vendor.city,
    state: vendor.state,
    categorySlugs: [...vendor.categorySlugs],
    leadTimeDays: String(vendor.leadTimeDays),
    paymentTerms: vendor.paymentTerms,
    notes: vendor.notes,
  };
}
/** Labeled select built from the same vocabulary as AdminTextField. */
function SelectField({
  label,
  hint,
  wide,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  options: {
    value: string;
    label: string;
  }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className={`admin-field${wide ? " wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="admin-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}
/** Multi-select for the departments a vendor supplies, with a chip read-out. */
function MultiSelectField({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  options: {
    value: string;
    label: string;
  }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  return (
    <div className="admin-field wide">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="admin-select"
        multiple
        size={Math.min(6, Math.max(3, options.length))}
        value={values}
        onChange={(event) =>
          onChange(
            Array.from(event.target.selectedOptions, (option) => option.value),
          )
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small>{hint}</small>
      {values.length ? (
        <div className="admin-chips">
          {values.map((value) => (
            <span className="admin-chip active" key={value}>
              {options.find((option) => option.value === value)?.label ?? value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
/** Supplier record: editable profile alongside network stats and supply links. */
export default function AdminVendorDetailPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions } = useDemo();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const vendor = state.vendors.find((item) => item.id === idParam);
  const [form, setForm] = useState<VendorForm>(() =>
    vendor
      ? toForm(vendor)
      : {
          name: "",
          contactName: "",
          email: "",
          phone: "",
          address: "",
          city: "",
          state: nigerianStates[0] ?? "Lagos",
          categorySlugs: [],
          leadTimeDays: "1",
          paymentTerms: "",
          notes: "",
        },
  );
  if (!vendor) notFound();
  function set<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const resetForm = () => {
    setForm(toForm(vendor));
  };
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      const name = form.name.trim();
      const contactName = form.contactName.trim();
      const email = form.email.trim();
      const city = form.city.trim();
      const leadTimeDays = Number(form.leadTimeDays);
      if (!name) return actions.notify("Add the supplier name.", "error");
      if (!contactName)
        return actions.notify(
          "Add a contact person for this supplier.",
          "error",
        );
      if (!email.includes("@"))
        return actions.notify("Add a valid contact email.", "error");
      if (!form.phone.trim())
        return actions.notify("Add a contact phone number.", "error");
      if (!city)
        return actions.notify(
          "Add the city the supplier operates from.",
          "error",
        );
      if (form.categorySlugs.length === 0) {
        return actions.notify(
          "Choose at least one department this supplier covers.",
          "error",
        );
      }
      if (!Number.isFinite(leadTimeDays) || leadTimeDays < 1) {
        return actions.notify("Lead time must be at least one day.", "error");
      }
      const updated: Vendor = {
        ...vendor,
        name,
        contactName,
        email,
        phone: form.phone.trim(),
        address: form.address.trim(),
        city,
        state: form.state,
        categorySlugs: form.categorySlugs,
        leadTimeDays,
        paymentTerms: form.paymentTerms.trim(),
        notes: form.notes.trim(),
      };
      await actions.saveVendor(updated);
      actions.notify(`${updated.name} profile updated`);
      setForm(toForm(updated));
    } catch (error) {}
  };
  const supplied = state.products.filter(
    (product) => product.vendorId === vendor.id,
  );
  const ordersWithVendor = state.orders.filter((order) =>
    order.items.some((item) => item.vendorId === vendor.id),
  );
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title={vendor.name}
        description={`${vendor.contactName} · ${vendor.city}, ${vendor.state} · ${plural(vendor.leadTimeDays, "day")} lead time · joined ${formatDate(vendor.createdAt)}`}
        action={
          <Link className="admin-btn quiet" href="/admin/vendors">
            Back to vendors
          </Link>
        }
      />

      <div className="admin-detail">
        <form className="admin-card" onSubmit={handleSave}>
          <h2>Supplier profile</h2>
          <div className="form-grid">
            <AdminTextField
              wide
              label="Company name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
            />
            <AdminTextField
              label="Contact person"
              value={form.contactName}
              onChange={(event) => set("contactName", event.target.value)}
            />
            <AdminTextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
            />
            <AdminTextField
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
            <AdminTextField
              label="City"
              value={form.city}
              onChange={(event) => set("city", event.target.value)}
            />
            <SelectField
              label="State"
              value={form.state}
              onChange={(value) => set("state", value)}
              options={nigerianStates.map((stateName) => ({
                value: stateName,
                label: stateName,
              }))}
            />
            <AdminTextField
              wide
              label="Street address"
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
            />
            <AdminTextField
              label="Lead time (days)"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.leadTimeDays}
              onChange={(event) => set("leadTimeDays", event.target.value)}
              hint="Working days from order to dispatch."
            />
            <AdminTextField
              wide
              label="Payment terms"
              value={form.paymentTerms}
              onChange={(event) => set("paymentTerms", event.target.value)}
              hint="Internal only."
            />
            <MultiSelectField
              label="Departments supplied"
              hint="Ctrl/Cmd-click to select more than one."
              options={state.categories.map((item) => ({
                value: item.slug,
                label: item.name,
              }))}
              values={form.categorySlugs}
              onChange={(values) => set("categorySlugs", values)}
            />
            <AdminTextArea
              wide
              label="Notes"
              rows={4}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
              hint="Operational notes for the procurement team."
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={resetForm}>
              Discard changes
            </button>
            <button type="submit" className="primary">
              Save profile
            </button>
          </div>
        </form>

        <aside className="admin-card">
          <h3>Network stats</h3>
          <div className="admin-meta">
            <div>
              <span>Products supplied</span>
              <strong>{plural(supplied.length, "listing")}</strong>
            </div>
            <div>
              <span>Orders containing them</span>
              <strong>{ordersWithVendor.length}</strong>
            </div>
            <div>
              <span>Lead time</span>
              <strong>{plural(vendor.leadTimeDays, "day")}</strong>
            </div>
            <div>
              <span>Reliability</span>
              <strong>{vendor.reliability} / 100</strong>
            </div>
            <div>
              <span>On the network since</span>
              <strong>{formatDate(vendor.createdAt)}</strong>
            </div>
          </div>

          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: ".6rem",
              alignItems: "flex-start",
            }}
          >
            <StatusPill tone={vendorStatusMeta[vendor.status].tone}>
              {vendorStatusMeta[vendor.status].label}
            </StatusPill>
            <button
              type="button"
              className="admin-btn ghost"
              style={{ width: "100%" }}
              onClick={async () => {
                try {
                  return await actions.saveVendor({
                    ...vendor,
                    status: vendor.status === "active" ? "on_hold" : "active",
                  });
                } catch (error) {}
              }}
            >
              {vendor.status === "active" ? "Put on hold" : "Reactivate"}
            </button>
          </div>

          <h3 style={{ marginTop: "1.5rem" }}>Supplied products</h3>
          {supplied.length ? (
            supplied.map((product) => (
              <Link
                key={product.id}
                href={`/admin/products/${product.id}/edit`}
                className="queue-item"
                style={{ width: "100%" }}
              >
                <span>
                  <strong>{product.name}</strong>
                  <br />
                  <small style={{ color: "var(--muted)" }}>
                    {money(product.price)}
                  </small>
                </span>
                <StatusPill tone={productStatusMeta[product.status].tone}>
                  {productStatusMeta[product.status].label}
                </StatusPill>
              </Link>
            ))
          ) : (
            <p
              style={{
                color: "var(--muted)",
                fontSize: ".68rem",
                lineHeight: 1.7,
              }}
            >
              No catalogue listings are assigned to this supplier yet — set the
              supplying vendor on a product to link one.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
