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
  active: boolean;
  restricted: boolean;
  facets: string[];
  subcategories: Category["subcategories"];
  shortDescription: string;
  homepageVisible: boolean;
  homepageOrder: string;
};
function toDraft(category: Category): Draft {
  return {
    name: category.name,
    title: category.title,
    description: category.description,
    order: String(category.order),
    active: category.active !== false,
    restricted: category.restricted,
    facets: [...category.facets],
    subcategories: category.subcategories.map((item) => ({ ...item })),
    shortDescription: category.shortDescription ?? "",
    homepageVisible: category.homepageVisible !== false,
    homepageOrder: String(category.homepageOrder ?? category.order),
  };
}
/** Department directory with an inline editor for the selected category. */
export default function AdminCategoriesPage() {
  const { state, actions } = useDemo();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draggedSlug, setDraggedSlug] = useState<string | null>(null);
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
      const facetKeys = draft.facets.map((item) => item.trim().toLowerCase());
      const subcategoryKeys = draft.subcategories.map((item) =>
        item.slug.trim().toLowerCase(),
      );
      if (new Set(facetKeys).size !== facetKeys.length)
        return actions.notify("Each facet must be unique.", "error");
      if (new Set(subcategoryKeys).size !== subcategoryKeys.length)
        return actions.notify("Each subcategory slug must be unique.", "error");
      if (
        draft.facets.some((item) => !item.trim()) ||
        draft.subcategories.some(
          (item) => !item.name.trim() || !/^[a-z0-9-]+$/.test(item.slug),
        )
      )
        return actions.notify(
          "Complete every facet and subcategory. Slugs use lowercase letters, numbers and hyphens.",
          "error",
        );
      await actions.updateCategory(selectedSlug, {
        name,
        title,
        description: draft.description.trim(),
        order,
        active: draft.active,
        restricted: draft.restricted,
        facets: draft.facets.map((facet) => facet.trim()),
        subcategories: draft.subcategories.map((item) => ({
          slug: item.slug.trim(),
          name: item.name.trim(),
        })),
        shortDescription: draft.shortDescription.trim(),
        homepageVisible: draft.homepageVisible,
        homepageOrder: Number(draft.homepageOrder) || order,
      });
      actions.notify(`${name} updated`);
      closeEditor();
    } catch (error) {}
  }
  const selected = selectedSlug
    ? categories.find((item) => item.slug === selectedSlug)
    : undefined;
  const reorder = async (targetSlug: string) => {
    if (!draggedSlug || draggedSlug === targetSlug) return;
    const from = categories.findIndex((item) => item.slug === draggedSlug);
    const to = categories.findIndex((item) => item.slug === targetSlug);
    if (from < 0 || to < 0) return;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    try {
      for (const [index, category] of next.entries())
        if (category.order !== index + 1)
          await actions.updateCategory(category.slug, { order: index + 1 });
      actions.notify("Navigation order updated.");
    } finally {
      setDraggedSlug(null);
    }
  };
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
                <div
                  className="table-row"
                  key={category.slug}
                  draggable
                  onDragStart={() => setDraggedSlug(category.slug)}
                  onDragEnd={() => setDraggedSlug(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void reorder(category.slug)}
                  style={{
                    opacity: draggedSlug === category.slug ? 0.55 : 1,
                    cursor: "grab",
                  }}
                >
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
                      {category.active === false ? (
                        <StatusPill tone="neutral">Archived</StatusPill>
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
                label="Homepage summary"
                value={draft.shortDescription}
                onChange={(event) =>
                  setDraftField("shortDescription", event.target.value)
                }
                hint="Short copy shown on the homepage department card."
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
                className={`choice${draft.active ? " active" : ""}`}
                style={{ margin: 0 }}
              >
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraftField("active", event.target.checked)
                  }
                />
                <span>
                  Visible in storefront
                  <small>
                    Turn this off to remove the department from customer pages
                    without losing its setup.
                  </small>
                </span>
              </label>
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
              <fieldset className="admin-field">
                <legend>Facets</legend>
                {draft.facets.map((facet, index) => (
                  <div className="admin-actions" key={`facet-${index}`}>
                    <input
                      className="admin-input"
                      aria-label={`Facet ${index + 1}`}
                      value={facet}
                      onChange={(event) =>
                        setDraftField(
                          "facets",
                          draft.facets.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() =>
                        setDraftField(
                          "facets",
                          draft.facets.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setDraftField("facets", [...draft.facets, ""])}
                >
                  Add facet
                </button>
              </fieldset>
              <fieldset className="admin-field">
                <legend>Subcategories</legend>
                {draft.subcategories.map((subcategory, index) => (
                  <div className="form-grid" key={`subcategory-${index}`}>
                    <input
                      className="admin-input"
                      aria-label={`Subcategory ${index + 1} name`}
                      placeholder="Display name"
                      value={subcategory.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        const slug = name
                          .toLowerCase()
                          .trim()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "");
                        setDraftField(
                          "subcategories",
                          draft.subcategories.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name, slug }
                              : item,
                          ),
                        );
                      }}
                    />
                    <input
                      className="admin-input"
                      aria-label={`Subcategory ${index + 1} slug`}
                      placeholder="slug"
                      value={subcategory.slug}
                      onChange={(event) =>
                        setDraftField(
                          "subcategories",
                          draft.subcategories.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  slug: event.target.value.toLowerCase(),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() =>
                        setDraftField(
                          "subcategories",
                          draft.subcategories.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() =>
                    setDraftField("subcategories", [
                      ...draft.subcategories,
                      { name: "", slug: "" },
                    ])
                  }
                >
                  Add subcategory
                </button>
              </fieldset>
              <label
                className={`choice${draft.homepageVisible ? " active" : ""}`}
                style={{ margin: 0 }}
              >
                <input
                  type="checkbox"
                  checked={draft.homepageVisible}
                  onChange={(event) =>
                    setDraftField("homepageVisible", event.target.checked)
                  }
                />
                <span>
                  Show on homepage
                  <small>
                    The homepage uses this database-controlled setting.
                  </small>
                </span>
              </label>
              <AdminTextField
                label="Homepage order"
                type="number"
                min={0}
                step={1}
                value={draft.homepageOrder}
                onChange={(event) =>
                  setDraftField("homepageOrder", event.target.value)
                }
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
              <div className="admin-note">
                <strong>Storefront preview</strong>
                <p style={{ margin: ".4rem 0" }}>
                  {draft.name || "Department"}
                </p>
                <small>
                  {draft.shortDescription ||
                    draft.description ||
                    "Add a short summary."}
                </small>
                <div className="admin-chips" style={{ marginTop: ".6rem" }}>
                  {draft.subcategories.map((item, index) => (
                    <span className="admin-chip" key={`${item.slug}-${index}`}>
                      {item.name || "New subcategory"}
                    </span>
                  ))}
                </div>
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
              sort order, visibility, 18+ flag and facet filters. Changes apply
              to the storefront navigation immediately.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
