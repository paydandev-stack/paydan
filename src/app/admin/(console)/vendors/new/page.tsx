"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { nigerianStates } from "@/lib/catalog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";
import { vendorStatusMeta } from "@/lib/status";
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
  status: VendorStatus;
  paymentTerms: string;
  notes: string;
};
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
/** Create a supplier record in the vendor network. */
export default function AdminNewVendorPage() {
  const router = useRouter();
  const { state, actions } = useDemo();
  const [form, setForm] = useState<VendorForm>({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: nigerianStates[0] ?? "Lagos",
    categorySlugs: [],
    leadTimeDays: "3",
    status: "active",
    paymentTerms: "",
    notes: "",
  });
  function set<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
      const id = `v-${Date.now()}`;
      const vendor: Vendor = {
        id,
        name,
        contactName,
        email,
        phone: form.phone.trim(),
        address: form.address.trim(),
        city,
        state: form.state,
        categorySlugs: form.categorySlugs,
        status: form.status,
        leadTimeDays,
        paymentTerms: form.paymentTerms.trim(),
        notes: form.notes.trim(),
        reliability: 0,
        createdAt: new Date().toISOString(),
      };
      await actions.saveVendor(vendor);
      actions.notify(
        `${vendor.name} added to the vendor network — reliability starts at 0/100.`,
      );
      router.push(`/admin/vendors/${id}`);
    } catch (error) {}
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="New vendor"
        description="Supplier record used for sourcing, procurement groups and margin reporting."
        action={
          <Link className="admin-btn quiet" href="/admin/vendors">
            Back to vendors
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="admin-panels wide">
          <section className="admin-card">
            <h2>Supplier details</h2>
            <div className="form-grid">
              <AdminTextField
                wide
                label="Company name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="e.g. Lagos Provisions Ltd"
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
              <SelectField
                label="Status"
                value={form.status}
                onChange={(value) => set("status", value as VendorStatus)}
                options={(Object.keys(vendorStatusMeta) as VendorStatus[]).map(
                  (key) => ({
                    value: key,
                    label: vendorStatusMeta[key].label,
                  }),
                )}
                hint="On-hold suppliers are skipped for new orders."
              />
              <AdminTextField
                wide
                label="Payment terms"
                value={form.paymentTerms}
                onChange={(event) => set("paymentTerms", event.target.value)}
                placeholder="e.g. Net 7 after delivery"
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
                rows={3}
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
                hint="Operational notes for the procurement team."
              />
            </div>
            <p className="admin-note" style={{ marginTop: "1rem" }}>
              New suppliers start with a reliability score of 0/100, raised once
              delivery performance has been reviewed.
            </p>
          </section>
        </div>

        <div className="form-actions">
          <Link href="/admin/vendors">Cancel</Link>
          <button type="submit" className="primary">
            Save vendor
          </button>
        </div>
      </form>
    </>
  );
}
