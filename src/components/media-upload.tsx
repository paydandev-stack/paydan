"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { api } from "@/lib/api-client";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type QueueItem = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "failed";
  error?: string;
};

export type MediaUploadProps = {
  purpose?: "catalog" | "sourcing" | "return";
  onUploaded: (url: string) => void;
  images?: string[];
  onRemove?: (url: string) => void;
  alts?: Record<string, string>;
  onAltChange?: (url: string, alt: string) => void;
  onMove?: (from: number, to: number) => void;
  multiple?: boolean;
  maxFiles?: number;
  title?: string;
  onBusyChange?: (busy: boolean) => void;
};

function friendlyError(error: unknown) {
  if (error instanceof TypeError && /fetch/i.test(error.message))
    return "The upload could not reach storage. Check your connection and try again.";
  return error instanceof Error ? error.message : "Image upload failed.";
}

/** Browser-to-S3 uploader with validation, sequential uploads, retry and previews. */
export function MediaUpload({
  purpose = "catalog",
  onUploaded,
  images = [],
  onRemove,
  alts,
  onAltChange,
  onMove,
  multiple = true,
  maxFiles = 12,
  title = "Add product photos",
  onBusyChange,
}: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const runningRef = useRef(false);
  const inputId = useId();
  const hintId = useId();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [failedPreviews, setFailedPreviews] = useState<Set<string>>(new Set());
  const [previewRetries, setPreviewRetries] = useState<Record<string, number>>(
    {},
  );

  const activeCount =
    images.length + queue.filter((item) => item.status !== "failed").length;
  const uploadingIndex = queue.findIndex((item) => item.status === "uploading");
  const activeUploads = queue.filter((item) => item.status !== "failed").length;
  const busy = queue.some(
    (item) => item.status === "uploading" || item.status === "queued",
  );
  const blocked = busy || failedPreviews.size > 0;

  useEffect(() => {
    onBusyChange?.(blocked);
  }, [blocked, onBusyChange]);

  function updateQueue(next: QueueItem[]) {
    queueRef.current = next;
    setQueue(next);
  }

  async function uploadOne(item: QueueItem) {
    const signed = await api<{
      id: string;
      url: string;
      fields: Record<string, string>;
    }>("/api/media", {
      purpose,
      mime: item.file.type,
      size: item.file.size,
    });

    const body = new FormData();
    for (const [key, value] of Object.entries(signed.fields))
      body.append(key, value);
    body.append("file", item.file);

    const result = await fetch(signed.url, { method: "POST", body });
    if (!result.ok) throw new Error("The upload failed. Please retry.");

    const ready = await api<{ id: string; url: string }>("/api/media", {
      action: "finalize",
      id: signed.id,
    });
    onUploaded(ready.url);
  }

  async function processQueue() {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      while (true) {
        const next = queueRef.current.find((item) => item.status === "queued");
        if (!next) break;
        updateQueue(
          queueRef.current.map((item) =>
            item.id === next.id
              ? { ...item, status: "uploading", error: undefined }
              : item,
          ),
        );
        try {
          await uploadOne(next);
          updateQueue(queueRef.current.filter((item) => item.id !== next.id));
        } catch (cause) {
          updateQueue(
            queueRef.current.map((item) =>
              item.id === next.id
                ? { ...item, status: "failed", error: friendlyError(cause) }
                : item,
            ),
          );
        }
      }
    } finally {
      runningRef.current = false;
    }
  }

  function acceptFiles(files: FileList | File[]) {
    setError("");
    const selected = Array.from(files);
    if (selected.length === 0) return;
    if (!multiple && selected.length > 1) {
      setError("Choose one image at a time in this form.");
      return;
    }

    const invalid = selected.find(
      (file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES,
    );
    if (invalid) {
      setError(
        !ACCEPTED_TYPES.has(invalid.type)
          ? "Only JPG, PNG and WebP images are supported."
          : invalid.name + " is larger than 5 MB.",
      );
      return;
    }

    const available = Math.max(0, maxFiles - activeCount);
    if (selected.length > available) {
      setError(
        "You can add " +
          available +
          " more image" +
          (available === 1 ? "" : "s") +
          ".",
      );
      return;
    }

    updateQueue([
      ...queueRef.current,
      ...selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "queued" as const,
      })),
    ]);
    void processQueue();
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFiles(event.target.files ?? []);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(event.dataTransfer.files);
  }

  function retry(itemId: string) {
    updateQueue(
      queueRef.current.map((item) =>
        item.id === itemId
          ? { ...item, status: "queued", error: undefined }
          : item,
      ),
    );
    void processQueue();
  }

  return (
    <div className="media-upload-wrap">
      <div
        className={"media-dropzone" + (dragging ? " dragging" : "")}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="media-dropzone-icon" aria-hidden="true">
          ⬆
        </span>
        <h2>{title}</h2>
        <p>Drag images here or choose them from your device.</p>
        <input
          ref={inputRef}
          className="media-file-input"
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          disabled={busy || activeCount >= maxFiles}
          onChange={onInputChange}
          aria-describedby={hintId}
        />
        <button
          type="button"
          className="admin-btn primary media-choose"
          disabled={busy || activeCount >= maxFiles}
          onClick={() => inputRef.current?.click()}
        >
          Choose images
        </button>
        <small id={hintId}>
          JPG, PNG or WebP · Up to 5 MB each · Drag and drop supported
        </small>
        <span className="media-count" role="status">
          {activeCount} of {maxFiles} images
        </span>
      </div>

      <div className="media-queue" aria-live="polite">
        {uploadingIndex >= 0 ? (
          <p className="media-progress" role="status">
            <span className="media-spinner" aria-hidden="true" />
            Uploading image {uploadingIndex + 1} of {activeUploads}…
          </p>
        ) : null}
        {queue
          .filter((item) => item.status === "failed")
          .map((item) => (
            <div className="media-error" key={item.id} role="alert">
              <span>
                <strong>{item.file.name}</strong> —{" "}
                {item.error ?? "Upload failed."}
              </span>
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => retry(item.id)}
              >
                Retry
              </button>
            </div>
          ))}
        {error ? (
          <p className="media-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {images.length > 0 || onMove ? (
        <div className="media-gallery">
          {images.map((url, index) => (
            <article className="media-preview" key={url}>
              <img
                src={
                  previewRetries[url]
                    ? `${url}${url.includes("?") ? "&" : "?"}previewRetry=${previewRetries[url]}`
                    : url
                }
                alt={alts?.[url] || "Product image " + (index + 1)}
                width={90}
                height={90}
                onLoad={() =>
                  setFailedPreviews((current) => {
                    if (!current.has(url)) return current;
                    const next = new Set(current);
                    next.delete(url);
                    return next;
                  })
                }
                onError={() =>
                  setFailedPreviews((current) => new Set(current).add(url))
                }
              />
              <div className="media-preview-body">
                {index === 0 ? (
                  <strong className="media-cover">Cover image</strong>
                ) : null}
                {onAltChange ? (
                  <label>
                    Alt text
                    <input
                      value={alts?.[url] ?? ""}
                      onChange={(event) => onAltChange(url, event.target.value)}
                    />
                  </label>
                ) : null}
                {failedPreviews.has(url) ? (
                  <div className="media-error" role="alert">
                    <span>
                      Preview unavailable. The image is not ready to attach.
                    </span>
                    <button
                      type="button"
                      className="admin-btn secondary"
                      onClick={() => {
                        setFailedPreviews((current) => {
                          const next = new Set(current);
                          next.delete(url);
                          return next;
                        });
                        setPreviewRetries((current) => ({
                          ...current,
                          [url]: (current[url] ?? 0) + 1,
                        }));
                      }}
                    >
                      Retry preview
                    </button>
                  </div>
                ) : null}
                <div className="media-preview-actions">
                  {onMove ? (
                    <>
                      <button
                        type="button"
                        className="admin-btn quiet"
                        disabled={index === 0}
                        onClick={() => onMove(index, index - 1)}
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        className="admin-btn quiet"
                        disabled={index === images.length - 1}
                        onClick={() => onMove(index, index + 1)}
                      >
                        Move down
                      </button>
                    </>
                  ) : null}
                  {onRemove ? (
                    <button
                      type="button"
                      className="admin-btn danger"
                      onClick={() => onRemove(url)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
