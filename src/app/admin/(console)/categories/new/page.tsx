"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MediaUpload } from "@/components/media-upload";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminTextArea, AdminTextField } from "@/components/admin/data-table";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
export default function NewCategory() {
  const router = useRouter();
  const { state, refresh } = useDemo();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    title: "",
    description: "",
    image: "",
    order: 0,
    active: true,
    restricted: false,
    shortDescription: "",
    homepageVisible: true,
    homepageOrder: 0,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (state.categories.some((item) => item.slug === form.slug))
        throw new Error("A department already uses this slug.");
      await api("/api/commands", {
        name: "saveCategory",
        args: [{ ...form, subcategories: [], facets: [] }],
        key: crypto.randomUUID(),
      });
      await refresh();
      router.push("/admin/categories");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Create department"
        description="Add a storefront department with a unique generated slug and navigation position."
      />
      <form className="admin-card form-grid" onSubmit={submit}>
        <AdminTextField
          label="Name"
          required
          value={form.name}
          onChange={(event) => {
            const name = event.target.value;
            setForm({
              ...form,
              name,
              slug: slugEdited ? form.slug : slugify(name),
            });
          }}
        />
        <AdminTextField
          label="Slug"
          required
          pattern="[a-z0-9-]+"
          hint="Generated from the name. Lowercase letters, numbers and hyphens only."
          value={form.slug}
          onChange={(event) => {
            setSlugEdited(true);
            setForm({ ...form, slug: slugify(event.target.value) });
          }}
        />
        <AdminTextField
          label="Shelf title"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <AdminTextArea
          label="Description"
          wide
          rows={4}
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
        <AdminTextField
          label="Homepage summary"
          wide
          value={form.shortDescription}
          onChange={(event) =>
            setForm({ ...form, shortDescription: event.target.value })
          }
        />
        <label>
          Display order
          <input
            type="number"
            min={0}
            value={form.order}
            onChange={(e) =>
              setForm({
                ...form,
                order: Number(e.target.value),
                homepageOrder: Number(e.target.value),
              })
            }
          />
        </label>
        <MediaUpload
          images={form.image ? [form.image] : []}
          maxFiles={1}
          onUploaded={(image) => setForm({ ...form, image })}
          onRemove={() => setForm({ ...form, image: "" })}
        />
        {form.image && <p>Image ready.</p>}
        <label>
          <input
            type="checkbox"
            checked={form.restricted}
            onChange={(e) => setForm({ ...form, restricted: e.target.checked })}
          />{" "}
          Restricted department
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.homepageVisible}
            onChange={(e) =>
              setForm({ ...form, homepageVisible: e.target.checked })
            }
          />{" "}
          Show on homepage
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="admin-btn primary" disabled={busy || !form.image}>
          {busy ? "Saving…" : "Create department"}
        </button>
      </form>
    </>
  );
}
