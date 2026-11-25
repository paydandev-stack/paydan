"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { MediaUpload } from "@/components/media-upload";

type MediaItem = {
  id: string;
  url: string;
  objectKey: string;
  purpose: string;
  mime: string;
  createdAt: string;
};

export function MediaPicker({
  value,
  onChange,
  multiple = true,
  label = "Choose from media library",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  label?: string;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manual, setManual] = useState("");

  async function load() {
    try {
      const result = await api<{ media: MediaItem[] }>("/api/media/library");
      setItems(result.media);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggle(url: string) {
    if (!multiple) {
      onChange(value[0] === url ? [] : [url]);
      return;
    }
    onChange(
      value.includes(url)
        ? value.filter((item) => item !== url)
        : [...value, url],
    );
  }

  return (
    <div className="admin-media-picker">
      <div className="admin-media-picker-head">
        <strong>{label}</strong>
        <button
          className="admin-btn quiet"
          type="button"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {loading ? <p className="admin-muted">Loading media…</p> : null}
      {error ? (
        <p className="admin-field-error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="admin-muted">
          No uploaded images yet. Use the uploader below.
        </p>
      ) : null}
      <div className="admin-media-grid">
        {items.map((item) => (
          <button
            className={
              "admin-media-tile" + (value.includes(item.url) ? " selected" : "")
            }
            key={item.id}
            type="button"
            aria-pressed={value.includes(item.url)}
            onClick={() => toggle(item.url)}
          >
            <img src={item.url} alt="" loading="lazy" />
            <span>{value.includes(item.url) ? "Selected" : "Select"}</span>
          </button>
        ))}
      </div>
      <div className="admin-media-manual">
        <input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder="Paste an existing image URL"
          aria-label="Existing image URL"
        />
        <button
          className="admin-btn secondary"
          type="button"
          disabled={!manual.trim()}
          onClick={() => {
            onChange(multiple ? [...value, manual.trim()] : [manual.trim()]);
            setManual("");
          }}
        >
          Add URL
        </button>
      </div>
      <details className="admin-media-upload">
        <summary>Upload a new image</summary>
        <MediaUpload
          purpose="catalog"
          multiple={false}
          maxFiles={1}
          title="Upload to media library"
          onUploaded={(url) => {
            onChange(multiple ? [...value, url] : [url]);
            void load();
          }}
        />
      </details>
    </div>
  );
}
