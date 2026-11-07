"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MediaUpload } from "@/components/media-upload";
import { api } from "@/lib/api-client";
import { useDemo } from "@/lib/store";
export default function NewCategory() {
  const router = useRouter();
  const { refresh } = useDemo();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    title: "",
    description: "",
    image: "",
    order: 0,
    restricted: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
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
      <h1>Create department</h1>
      <form className="operations-form" onSubmit={submit}>
        {(["name", "slug", "title", "description"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              required
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Display order
          <input
            type="number"
            min={0}
            value={form.order}
            onChange={(e) =>
              setForm({ ...form, order: Number(e.target.value) })
            }
          />
        </label>
        <MediaUpload onUploaded={(image) => setForm({ ...form, image })} />
        {form.image && <p>Image ready.</p>}
        <label>
          <input
            type="checkbox"
            checked={form.restricted}
            onChange={(e) => setForm({ ...form, restricted: e.target.checked })}
          />{" "}
          Restricted department
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="admin-btn" disabled={busy || !form.image}>
          {busy ? "Saving…" : "Create department"}
        </button>
      </form>
    </>
  );
}
