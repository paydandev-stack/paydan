"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import { nigerianStates } from "@/lib/catalog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { formatDate, money, plural } from "@/lib/format";
import { productStatusMeta, vendorStatusMeta } from "@/lib/status";
import type {
  DemoState,
  Vendor,
  VendorFulfillmentLocation,
  VendorStatus,
} from "@/lib/types";
import { hasCapability } from "@/lib/capabilities";
import { getAdminRecords, putAdminRecord } from "@/lib/admin-records";
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
  locationLabel: string;
  pickupAvailable: boolean;
};
function toForm(vendor: Vendor): VendorForm {
  const primary =
    vendor.fulfillmentLocations?.find((location) => location.isPrimary) ??
    vendor.fulfillmentLocations?.[0];
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
    locationLabel: primary?.label ?? "Primary fulfilment location",
    pickupAvailable: primary?.pickupAvailable ?? false,
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

type VendorRecord = Record<string, unknown> & {
  id: string;
  vendorId?: string;
  updatedAt?: string;
};

function VendorOperations({
  vendor,
  state,
  canWrite,
}: {
  vendor: Vendor;
  state: DemoState;
  canWrite: boolean;
}) {
  const [documents, setDocuments] = useState<VendorRecord[]>([]);
  const [payout, setPayout] = useState<VendorRecord | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentExpiry, setDocumentExpiry] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutLastFour, setPayoutLastFour] = useState("");
  const [payoutBank, setPayoutBank] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canWrite) return;
    void Promise.all([
      getAdminRecords<VendorRecord>("vendorDocuments"),
      getAdminRecords<VendorRecord>("vendorPayouts"),
    ])
      .then(([savedDocuments, savedPayouts]) => {
        setDocuments(
          savedDocuments.filter((item) => item.vendorId === vendor.id),
        );
        const saved = savedPayouts.find(
          (item) => item.id === `payout:${vendor.id}`,
        );
        setPayout(saved ?? null);
        setPayoutReference(String(saved?.providerReference ?? ""));
        setPayoutLastFour(String(saved?.accountLastFour ?? ""));
        setPayoutBank(String(saved?.bankName ?? ""));
      })
      .catch((reason) => setError((reason as Error).message));
  }, [canWrite, vendor.id]);

  const groups = state.orders.flatMap((order) =>
    order.vendorGroups
      .filter((group) => group.vendorId === vendor.id)
      .map((group) => ({ order, group })),
  );
  const closed = groups.filter(({ group }) => group.stage === "closed");
  const onTime = closed.filter(({ group }) => {
    const eta = Date.parse(group.eta);
    return Number.isFinite(eta) && Date.parse(group.updatedAt) <= eta;
  }).length;
  const onTimeRate = closed.length
    ? Math.round((onTime / closed.length) * 100)
    : 0;

  if (!canWrite) return null;
  return (
    <section className="admin-panels" style={{ marginTop: "1rem" }}>
      <article className="admin-card">
        <h3>Performance scorecard</h3>
        <div className="admin-meta">
          <div>
            <span>Supplier groups</span>
            <strong>{groups.length}</strong>
          </div>
          <div>
            <span>Closed groups</span>
            <strong>{closed.length}</strong>
          </div>
          <div>
            <span>On-time delivery</span>
            <strong>{onTimeRate}%</strong>
          </div>
          <div>
            <span>Reliability</span>
            <strong>{vendor.reliability} / 100</strong>
          </div>
        </div>
        <button
          className="admin-btn secondary"
          type="button"
          onClick={() =>
            void putAdminRecord("vendorScorecards", `scorecard:${vendor.id}`, {
              vendorId: vendor.id,
              supplierGroups: groups.length,
              closedGroups: closed.length,
              onTimeDeliveries: onTime,
              onTimeRate,
              reliability: vendor.reliability,
              measuredAt: new Date().toISOString(),
            })
          }
        >
          Snapshot scorecard
        </button>
      </article>

      <form
        className="admin-card form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const saved = await putAdminRecord<VendorRecord>(
              "vendorDocuments",
              `document:${vendor.id}:${crypto.randomUUID()}`,
              {
                vendorId: vendor.id,
                title: documentTitle.trim(),
                url: documentUrl.trim(),
                expiresAt: documentExpiry
                  ? `${documentExpiry}T23:59:59.999Z`
                  : "",
                status: "active",
              },
            );
            setDocuments((current) => [saved, ...current]);
            setDocumentTitle("");
            setDocumentUrl("");
            setDocumentExpiry("");
          } catch (reason) {
            setError((reason as Error).message);
          }
        }}
      >
        <h3 className="wide">Supplier documents</h3>
        {documents.map((document) => (
          <a
            className="queue-item wide"
            key={document.id}
            href={String(document.url)}
            target="_blank"
            rel="noreferrer"
          >
            <span>
              <strong>{String(document.title)}</strong>
              <br />
              <small>{String(document.status ?? "active")}</small>
            </span>
            <span>
              {document.expiresAt
                ? `Expires ${formatDate(String(document.expiresAt))}`
                : "No expiry"}
            </span>
          </a>
        ))}
        <AdminTextField
          label="Document title"
          required
          value={documentTitle}
          onChange={(event) => setDocumentTitle(event.target.value)}
        />
        <AdminTextField
          label="Secure document URL"
          type="url"
          required
          value={documentUrl}
          onChange={(event) => setDocumentUrl(event.target.value)}
        />
        <AdminTextField
          label="Expiry date"
          type="date"
          value={documentExpiry}
          onChange={(event) => setDocumentExpiry(event.target.value)}
        />
        <button className="admin-btn primary">Add document</button>
      </form>

      <form
        className="admin-card form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            const saved = await putAdminRecord<VendorRecord>(
              "vendorPayouts",
              `payout:${vendor.id}`,
              {
                vendorId: vendor.id,
                bankName: payoutBank.trim(),
                accountLastFour: payoutLastFour.trim(),
                providerReference: payoutReference.trim(),
                status: payoutReference.trim() ? "configured" : "pending",
              },
            );
            setPayout(saved);
          } catch (reason) {
            setError((reason as Error).message);
          }
        }}
      >
        <h3 className="wide">Payout setup</h3>
        <p className="wide">
          Store the provider recipient reference and masked account details;
          full bank account numbers stay with the payment provider.
        </p>
        <AdminTextField
          label="Bank"
          required
          value={payoutBank}
          onChange={(event) => setPayoutBank(event.target.value)}
        />
        <AdminTextField
          label="Account last four"
          required
          pattern="[0-9]{4}"
          value={payoutLastFour}
          onChange={(event) => setPayoutLastFour(event.target.value)}
        />
        <AdminTextField
          label="Provider recipient reference"
          value={payoutReference}
          onChange={(event) => setPayoutReference(event.target.value)}
        />
        <button className="admin-btn primary">Save payout setup</button>
        {payout ? (
          <StatusPill
            tone={payout.status === "configured" ? "green" : "orange"}
          >
            {String(payout.status)}
          </StatusPill>
        ) : null}
        {error ? <p className="form-error wide">{error}</p> : null}
      </form>
    </section>
  );
}
/** Supplier record: editable profile alongside network stats and supply links. */
export default function AdminVendorDetailPage() {
  const params = useParams<{
    id: string;
  }>();
  const { state, actions, refresh } = useDemo();
  const canWrite = hasCapability(state.adminSession?.role, "vendors.write");
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
          locationLabel: "Primary fulfilment location",
          pickupAvailable: false,
        },
  );
  const [portalEmail, setPortalEmail] = useState("");
  const [linkedEmails, setLinkedEmails] = useState<Record<string, string>>({});
  const [portalBusy, setPortalBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [additionalLocations, setAdditionalLocations] = useState<
    VendorFulfillmentLocation[]
  >(
    () =>
      vendor?.fulfillmentLocations?.filter((location) => !location.isPrimary) ??
      [],
  );
  if (!vendor) notFound();
  function set<K extends keyof VendorForm>(key: K, value: VendorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const resetForm = () => {
    setForm(toForm(vendor));
    setAdditionalLocations(
      vendor.fulfillmentLocations?.filter((location) => !location.isPrimary) ??
        [],
    );
  };

  async function portalCommand(name: string, args: unknown[], success: string) {
    setPortalBusy(true);
    try {
      await api("/api/commands", {
        name,
        args,
        key: name + ":" + Date.now() + ":" + Math.random(),
      });
      await refresh();
      actions.notify(success, "success");
      return true;
    } catch (error) {
      actions.notify(
        error instanceof Error
          ? error.message
          : "Could not update portal access.",
        "error",
      );
      return false;
    } finally {
      setPortalBusy(false);
    }
  }
  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      if (saving) return;
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
        fulfillmentLocations: [
          {
            id:
              vendor.fulfillmentLocations?.find(
                (location) => location.isPrimary,
              )?.id ?? `${vendor.id}-primary`,
            vendorId: vendor.id,
            label: form.locationLabel.trim() || "Primary fulfilment location",
            address: form.address.trim(),
            city,
            state: form.state,
            isPrimary: true,
            active: true,
            pickupAvailable: form.pickupAvailable,
            dispatchLeadTimeDays: leadTimeDays,
          },
          ...additionalLocations,
        ],
      };
      setSaving(true);
      await actions.saveVendor(updated);
      actions.notify(`${updated.name} profile updated`);
      setForm(toForm(updated));
    } catch (cause) {
      actions.notify(
        cause instanceof Error ? cause.message : "Could not save this profile.",
        "error",
      );
    } finally {
      setSaving(false);
    }
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
              label="Primary fulfilment label"
              value={form.locationLabel}
              onChange={(event) => set("locationLabel", event.target.value)}
              hint="For example: Ikeja warehouse."
            />
            <label className="choice">
              <input
                type="checkbox"
                checked={form.pickupAvailable}
                onChange={(event) =>
                  set("pickupAvailable", event.target.checked)
                }
              />
              <span>Customer pickup available</span>
            </label>
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
            <div className="admin-field wide">
              <label>Additional fulfilment locations</label>
              {additionalLocations.map((location) => (
                <div
                  className="admin-card"
                  key={location.id}
                  style={{ marginBottom: ".75rem" }}
                >
                  <div className="form-grid">
                    <AdminTextField
                      label="Label"
                      value={location.label}
                      onChange={(event) =>
                        setAdditionalLocations((current) =>
                          current.map((item) =>
                            item.id === location.id
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <AdminTextField
                      label="City"
                      value={location.city}
                      onChange={(event) =>
                        setAdditionalLocations((current) =>
                          current.map((item) =>
                            item.id === location.id
                              ? { ...item, city: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <SelectField
                      label="State"
                      value={location.state}
                      onChange={(state) =>
                        setAdditionalLocations((current) =>
                          current.map((item) =>
                            item.id === location.id ? { ...item, state } : item,
                          ),
                        )
                      }
                      options={nigerianStates.map((state) => ({
                        value: state,
                        label: state,
                      }))}
                    />
                    <AdminTextField
                      label="Dispatch days"
                      type="number"
                      min={0}
                      value={String(location.dispatchLeadTimeDays)}
                      onChange={(event) =>
                        setAdditionalLocations((current) =>
                          current.map((item) =>
                            item.id === location.id
                              ? {
                                  ...item,
                                  dispatchLeadTimeDays: Number(
                                    event.target.value,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <AdminTextField
                      wide
                      label="Warehouse address (private)"
                      value={location.address}
                      onChange={(event) =>
                        setAdditionalLocations((current) =>
                          current.map((item) =>
                            item.id === location.id
                              ? { ...item, address: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="admin-btn danger"
                    onClick={() =>
                      setAdditionalLocations((current) =>
                        current.filter((item) => item.id !== location.id),
                      )
                    }
                  >
                    Remove location
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() =>
                  setAdditionalLocations((current) => [
                    ...current,
                    {
                      id: `${vendor.id}-${crypto.randomUUID()}`,
                      vendorId: vendor.id,
                      label: "Additional warehouse",
                      address: "",
                      city: "",
                      state: form.state,
                      isPrimary: false,
                      active: true,
                      pickupAvailable: false,
                      dispatchLeadTimeDays: Number(form.leadTimeDays) || 1,
                    },
                  ])
                }
              >
                Add fulfilment location
              </button>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="admin-btn quiet"
              disabled={saving}
              onClick={resetForm}
            >
              Discard changes
            </button>
            {canWrite ? (
              <button
                type="submit"
                className="admin-btn primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            ) : null}
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
            {canWrite ? (
              <button
                type="button"
                className={`admin-btn ${
                  vendor.status === "active" ? "danger" : "secondary"
                }`}
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
            ) : null}
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

          <h3 style={{ marginTop: "1.5rem" }}>Portal access</h3>
          {canWrite &&
          vendor.status === "active" &&
          !state.team.some(
            (member) =>
              member.role === "Vendor" && member.vendorId === vendor.id,
          ) ? (
            <>
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: ".68rem",
                  lineHeight: 1.7,
                }}
              >
                Create a vendor login so this supplier can edit assigned
                catalogue details and view their order queue.
              </p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!portalEmail.trim()) return;
                  const saved = await portalCommand(
                    "createVendorAccount",
                    [
                      {
                        vendorId: vendor.id,
                        name: vendor.contactName || vendor.name,
                        email: portalEmail.trim(),
                      },
                    ],
                    "Vendor access created and invitation queued.",
                  );
                  if (saved) setPortalEmail("");
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: ".5rem",
                  marginTop: ".6rem",
                }}
              >
                <label className="admin-field wide">
                  Vendor login email
                  <input
                    className="admin-input"
                    type="email"
                    required
                    value={portalEmail}
                    onChange={(event) => setPortalEmail(event.target.value)}
                    placeholder="supplier@example.com"
                  />
                </label>
                <button
                  type="submit"
                  className="admin-btn primary"
                  disabled={portalBusy}
                  style={{ width: "100%" }}
                >
                  Create vendor access
                </button>
              </form>
            </>
          ) : null}

          <div style={{ marginTop: ".9rem", display: "grid", gap: ".5rem" }}>
            {state.team
              .filter(
                (member) =>
                  member.role === "Vendor" && member.vendorId === vendor.id,
              )
              .map((member) => (
                <div
                  className="queue-item"
                  key={member.id}
                  style={{ width: "100%", alignItems: "flex-start" }}
                >
                  <span>
                    <strong>{member.name}</strong>
                    <br />
                    <small style={{ color: "var(--muted)" }}>
                      Linked login: {member.email} · {member.status}
                    </small>
                    {canWrite ? (
                      <span
                        style={{
                          display: "flex",
                          gap: ".35rem",
                          marginTop: ".45rem",
                        }}
                      >
                        <input
                          className="admin-input"
                          type="email"
                          aria-label={`Linked email for ${member.name}`}
                          value={linkedEmails[member.id] ?? member.email}
                          onChange={(event) =>
                            setLinkedEmails((current) => ({
                              ...current,
                              [member.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="admin-btn secondary"
                          disabled={
                            portalBusy ||
                            !(linkedEmails[member.id] ?? member.email).trim() ||
                            (linkedEmails[member.id] ?? member.email)
                              .trim()
                              .toLowerCase() === member.email.toLowerCase()
                          }
                          onClick={async () => {
                            const email = (
                              linkedEmails[member.id] ?? member.email
                            )
                              .trim()
                              .toLowerCase();
                            const saved = await portalCommand(
                              "updateVendorAccount",
                              [{ id: member.id, email }],
                              "Linked email changed and a new invitation queued.",
                            );
                            if (saved)
                              setLinkedEmails((current) => ({
                                ...current,
                                [member.id]: email,
                              }));
                          }}
                        >
                          Change email
                        </button>
                      </span>
                    ) : null}
                  </span>
                  {canWrite ? (
                    <span
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: ".3rem",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        className="admin-btn secondary"
                        disabled={portalBusy}
                        onClick={() =>
                          portalCommand(
                            "updateVendorAccount",
                            [{ id: member.id, resend: true }],
                            "Invitation email queued.",
                          )
                        }
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        className={`admin-btn ${
                          member.status === "suspended" ? "secondary" : "danger"
                        }`}
                        disabled={portalBusy}
                        onClick={() =>
                          portalCommand(
                            "updateVendorAccount",
                            [
                              {
                                id: member.id,
                                status:
                                  member.status === "suspended"
                                    ? "active"
                                    : "suspended",
                              },
                            ],
                            "Vendor access status updated.",
                          )
                        }
                      >
                        {member.status === "suspended" ? "Enable" : "Suspend"}
                      </button>
                      <button
                        type="button"
                        className="admin-btn danger"
                        disabled={portalBusy}
                        onClick={() =>
                          portalCommand(
                            "unlinkVendorAccount",
                            [member.id],
                            "Vendor access unlinked.",
                          )
                        }
                      >
                        Unlink
                      </button>
                    </span>
                  ) : null}
                </div>
              ))}
          </div>
        </aside>
      </div>
      <VendorOperations vendor={vendor} state={state} canWrite={canWrite} />
    </>
  );
}
