"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminTable,
  AdminTextArea,
  AdminTextField,
} from "@/components/admin/data-table";
import { StatusPill } from "@/components/status-pill";
import { plural } from "@/lib/format";
import type { Category } from "@/lib/types";
type Draft = {
  name: string;
  title: string;
  description: string;
  order: string;
  restricted: boolean;
  facets: string;
};
function toDraft(category: Category): Draft {
  return {
    name: category.name,
    title: category.title,
    description: category.description,
    order: String(category.order),
    restricted: category.restricted,
    facets: category.facets.join(", "),
  };
}
/** Department directory with an inline editor for the selected category. */
export default function AdminCategoriesPage() {
  const { state, actions } = useDemo();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const categories = [...state.categories].sort((a, b) => a.order - b.order);
  function openEditor(category: Category) {
    setSelectedSlug(category.slug);
    setDraft(toDraft(category));
  }
  function closeEditor() {
    setSelectedSlug(null);
    setDraft(null);
  }
  function setDraftField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }
  async function handleSave(event: FormEvent<HTMLFormElement>) {
    try {
      event.preventDefault();
      if (!selectedSlug || !draft) return;
      const name = draft.name.trim();
      const title = draft.title.trim();
      const orderText = draft.order.trim();
      const order = Number(orderText);
      if (!name) return actions.notify("A department needs a name.", "error");
      if (!title)
        return actions.notify(
          "Add the shelf title shown on the department page.",
          "error",
        );
      if (!orderText || !Number.isFinite(order)) {
        return actions.notify("Sort order must be a number.", "error");
      }
      await actions.updateCategory(selectedSlug, {
        name,
        title,
        description: draft.description.trim(),
        order,
        restricted: draft.restricted,
        facets: draft.facets
          .split(",")
          .map((facet) => facet.trim())
          .filter(Boolean),
      });
      actions.notify(`${name} updated`);
      closeEditor();
    } catch (error) {}
  }
  const selected = selectedSlug
    ? categories.find((item) => item.slug === selectedSlug)
    : undefined;
  return (
    <>
      <Link className="admin-btn" href="/admin/categories/new">
        Create department
      </Link>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Categories"
        description={`${plural(state.categories.length, "department")} in the navigation · select one to edit its copy, order and filters`}
      />

      <div className="admin-detail">
        <section className="admin-card">
          <h2>Departments</h2>
          {categories.length === 0 ? (
            <AdminEmpty
              title="No departments yet"
              hint="Create your first department to organize the catalogue."
            />
          ) : (
            <AdminTable
              template="1.3fr 1.3fr .8fr 1.2fr .9fr"
              head={[
                "Department",
                "Shelf title",
                "Subcategories",
                "Facets",
                "Order & edit",
              ]}
              caption="Departments sorted by navigation order"
            >
              {categories.map((category) => (
                <div className="table-row" key={category.slug}>
                  <span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong>{category.name}</strong>
                      {category.restricted ? (
                        <StatusPill tone="red">18+</StatusPill>
                      ) : null}
                    </span>
                    <small style={{ display: "block", color: "var(--muted)" }}>
                      {category.slug}
                    </small>
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {category.title}
                  </span>
                  <span>
                    {plural(
                      category.subcategories.length,
                      "subcategory",
                      "subcategories",
                    )}
                  </span>
                  <span className="admin-chips">
                    {category.facets.length ? (
                      category.facets.map((facet) => (
                        <span className="admin-chip" key={facet}>
                          {facet}
                        </span>
                      ))
                    ) : (
                      <small style={{ color: "var(--muted)" }}>None</small>
                    )}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: ".4rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <strong>{category.order}</strong>
                    <button
                      type="button"
                      className="admin-btn ghost"
                      aria-pressed={selectedSlug === category.slug}
                      onClick={() =>
                        selectedSlug === category.slug
                          ? closeEditor()
                          : openEditor(category)
                      }
                    >
                      {selectedSlug === category.slug ? "Close" : "Edit"}
                    </button>
                  </span>
                </div>
              ))}
            </AdminTable>
          )}
        </section>

        <aside className="admin-card">
          <h3>Edit department</h3>
          {selected && draft ? (
            <form
              onSubmit={handleSave}
              style={{ display: "flex", flexDirection: "column", gap: ".9rem" }}
            >
              <AdminTextField
                label="Name"
                value={draft.name}
                onChange={(event) => setDraftField("name", event.target.value)}
              />
              <AdminTextField
                label="Shelf title"
                value={draft.title}
                onChange={(event) => setDraftField("title", event.target.value)}
                hint="Heading on the public department page."
              />
              <AdminTextArea
                label="Description"
                rows={4}
                value={draft.description}
                onChange={(event) =>
                  setDraftField("description", event.target.value)
                }
              />
              <AdminTextField
                label="Navigation order"
                type="number"
                step={1}
                inputMode="numeric"
                value={draft.order}
                onChange={(event) => setDraftField("order", event.target.value)}
                hint="Lower numbers appear first."
              />
              <label
                className={`choice${draft.restricted ? " active" : ""}`}
                style={{ margin: 0 }}
              >
                <input
                  type="checkbox"
                  checked={draft.restricted}
                  onChange={(event) =>
                    setDraftField("restricted", event.target.checked)
                  }
                />
                <span>
                  Restricted (18+)
                  <small>Hidden from public department lists.</small>
                </span>
              </label>
              <AdminTextField
                label="Facets"
                value={draft.facets}
                onChange={(event) =>
                  setDraftField("facets", event.target.value)
                }
                hint="Comma-separated filters, e.g. Storage, Colour."
              />
              <div className="admin-actions">
                <button type="submit" className="admin-btn">
                  Save changes
                </button>
                <button
                  type="button"
                  className="admin-btn quiet"
                  onClick={closeEditor}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <p
              style={{
                color: "var(--muted)",
                fontSize: ".68rem",
                lineHeight: 1.7,
              }}
            >
              Select a department in the table to edit its name, shelf copy,
              sort order, 18+ flag and facet filters. Changes apply to the
              storefront navigation immediately.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
