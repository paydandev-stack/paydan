"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSearch,
  AdminSelect,
  AdminTable,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { money, plural } from "@/lib/format";
import { vendorStatusMeta } from "@/lib/status";
/** Vendor network: search, status filter, supply counts and hold/activate controls. */
export default function AdminVendorsPage() {
  const { state, actions } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return state.vendors.filter((vendor) => {
      if (status !== "all" && vendor.status !== status) return false;
      if (!term) return true;
      return (
        vendor.name.toLowerCase().includes(term) ||
        vendor.contactName.toLowerCase().includes(term) ||
        vendor.email.toLowerCase().includes(term) ||
        vendor.city.toLowerCase().includes(term)
      );
    });
  }, [state.vendors, query, status]);
  const activeCount = state.vendors.filter(
    (vendor) => vendor.status === "active",
  ).length;
  const holdCount = state.vendors.length - activeCount;
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Vendors"
        description={`${plural(state.vendors.length, "supplier")} in the network · ${activeCount} active, ${holdCount} on hold`}
        action={
          <Link className="admin-btn" href="/admin/vendors/new">
            New vendor
          </Link>
        }
      />

      <div className="admin-filters">
        <AdminSearch
          value={query}
          onChange={setQuery}
          placeholder="Search name, contact, email or city…"
          label="Search vendors by name, contact, email or city"
        />
        <AdminSelect
          label="Filter by vendor status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "on_hold", label: "On hold" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <AdminEmpty
          title="No vendors match this filter"
          hint="Clear the search box or switch the status filter to see the rest of the supplier network."
        />
      ) : (
        <AdminTable
          template=".9fr 1fr .8fr 1fr 1fr"
          head={[
            "Vendor",
            "City",
            "Lead time",
            "Products supplied",
            "Status & actions",
          ]}
          caption="Vendors matching the current filter"
        >
          {filtered.map((vendor) => {
            const supplied = state.products.filter(
              (product) => product.vendorId === vendor.id,
            );
            const suppliedValue = supplied.reduce(
              (sum, product) => sum + product.price,
              0,
            );
            return (
              <div className="table-row" key={vendor.id}>
                <span>
                  <strong style={{ display: "block" }}>{vendor.name}</strong>
                  <small style={{ color: "var(--muted)" }}>
                    {vendor.contactName}
                  </small>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {vendor.email}
                  </small>
                </span>
                <span>
                  <strong style={{ display: "block" }}>{vendor.city}</strong>
                  <small style={{ color: "var(--muted)" }}>
                    {vendor.state}
                  </small>
                </span>
                <span>
                  {plural(vendor.leadTimeDays, "day")}
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {vendor.paymentTerms || "No terms recorded"}
                  </small>
                </span>
                <span>
                  <strong style={{ display: "block" }}>
                    {plural(supplied.length, "listing")}
                  </strong>
                  <small style={{ color: "var(--muted)" }}>
                    {supplied.length
                      ? `${money(suppliedValue)} at list price`
                      : "Nothing assigned"}
                  </small>
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: ".4rem",
                    alignItems: "flex-start",
                  }}
                >
                  <StatusPill tone={vendorStatusMeta[vendor.status].tone}>
                    {vendorStatusMeta[vendor.status].label}
                  </StatusPill>
                  <Link
                    className="admin-btn quiet"
                    href={`/admin/vendors/${vendor.id}`}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    className="admin-btn ghost"
                    onClick={async () => {
                      try {
                        return await actions.saveVendor({
                          ...vendor,
                          status:
                            vendor.status === "active" ? "on_hold" : "active",
                        });
                      } catch (error) {}
                    }}
                  >
                    {vendor.status === "active" ? "Put on hold" : "Reactivate"}
                  </button>
                </span>
              </div>
            );
          })}
        </AdminTable>
      )}
    </>
  );
}
