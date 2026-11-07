"use client";
import { useState } from "react";
import { api } from "@/lib/api-client";
export function MediaUpload({
  purpose = "catalog",
  onUploaded,
}: {
  purpose?: "catalog" | "sourcing" | "return";
  onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const signed = await api<{
        id: string;
        url: string;
        fields: Record<string, string>;
      }>("/api/media", { purpose, mime: file.type, size: file.size });
      const body = new FormData();
      for (const [key, value] of Object.entries(signed.fields))
        body.append(key, value);
      body.append("file", file);
      const result = await fetch(signed.url, { method: "POST", body });
      if (!result.ok) throw new Error("The upload failed. Please retry.");
      const ready = await api<{ url: string }>("/api/media", {
        action: "finalize",
        id: signed.id,
      });
      onUploaded(ready.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="media-upload">
      <label>
        Upload an image
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      <small>
        {busy
          ? "Uploading and preparing image…"
          : "JPG, PNG or WebP, up to 5 MB."}
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
