"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { MediaUpload } from "@/components/media-upload";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSelect,
  AdminTextField,
} from "@/components/admin/data-table";
import type { Banner } from "@/lib/types";
import { formatDate, plural } from "@/lib/format";
type BannerDraft = {
  title: string;
  eyebrow: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  image: string;
  placement: Banner["placement"];
  startAt: string; // yyyy-mm-dd for <input type="date">
  endAt: string;
};
function isoDay(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
function blankDraft(): BannerDraft {
  return {
    title: "",
    eyebrow: "",
    subtitle: "",
    ctaLabel: "",
    href: "",
    image: "",
    placement: "hero",
    startAt: isoDay(0),
    endAt: isoDay(30),
  };
}
function toDraft(banner: Banner): BannerDraft {
  return {
    title: banner.title,
    eyebrow: banner.eyebrow,
    subtitle: banner.subtitle,
    ctaLabel: banner.ctaLabel,
    href: banner.href,
    image: banner.image,
    placement: banner.placement,
    startAt: banner.startAt.slice(0, 10),
    endAt: banner.endAt.slice(0, 10),
  };
}
/** Shared field set for the create form and the per-banner inline editor. */
function BannerFields({
  value,
  onChange,
}: {
  value: BannerDraft;
  onChange: (patch: Partial<BannerDraft>) => void;
}) {
  return (
    <>
      <AdminTextField
        label="Eyebrow"
        value={value.eyebrow}
        onChange={(event) => onChange({ eyebrow: event.target.value })}
      />
      <AdminTextField
        label="Title"
        required
        value={value.title}
        onChange={(event) => onChange({ title: event.target.value })}
      />
      <AdminTextField
        label="Subtitle"
        wide
        value={value.subtitle}
        onChange={(event) => onChange({ subtitle: event.target.value })}
      />
      <AdminTextField
        label="Button label"
        value={value.ctaLabel}
        onChange={(event) => onChange({ ctaLabel: event.target.value })}
      />
      <AdminTextField
        label="Button link"
        required
        hint="Storefront path, e.g. /shop"
        value={value.href}
        onChange={(event) => onChange({ href: event.target.value })}
      />
      <AdminTextField
        label="Image path"
        value={value.image}
        onChange={(event) => onChange({ image: event.target.value })}
      />
      <AdminSelect
        label="Placement"
        value={value.placement}
        onChange={(placement) =>
          onChange({ placement: placement as Banner["placement"] })
        }
        options={[
          { value: "hero", label: "Hero (main banner)" },
          { value: "side", label: "Side banner" },
        ]}
      />
      <AdminTextField
        label="Starts"
        type="date"
        required
        value={value.startAt}
        onChange={(event) => onChange({ startAt: event.target.value })}
      />
      <AdminTextField
        label="Ends"
        type="date"
        required
        value={value.endAt}
        onChange={(event) => onChange({ endAt: event.target.value })}
      />
    </>
  );
}
function applyDraft(banner: Banner, draft: BannerDraft): Banner {
  return {
    ...banner,
    title: draft.title.trim(),
    eyebrow: draft.eyebrow.trim(),
    subtitle: draft.subtitle.trim(),
    ctaLabel: draft.ctaLabel.trim(),
    href: draft.href.trim(),
    image: draft.image.trim(),
    placement: draft.placement,
    startAt: `${draft.startAt}T00:00:00.000Z`,
    endAt: `${draft.endAt}T23:59:59.000Z`,
  };
}
/** Banner manager: card grid with schedule, active toggles and inline editors. */
export default function AdminBannersPage() {
  const { state, actions } = useDemo();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BannerDraft>(blankDraft);
  const [createDraft, setCreateDraft] = useState<BannerDraft>(blankDraft);
  const draftValid = (draft: BannerDraft): boolean => {
    if (!draft.title.trim() || !draft.href.trim()) {
      actions.notify("A banner needs a title and a button link.", "error");
      return false;
    }
    if (!draft.startAt || !draft.endAt) {
      actions.notify("Set both a start and an end date.", "error");
      return false;
    }
    if (draft.endAt < draft.startAt) {
      actions.notify("The end date cannot be before the start date.", "error");
      return false;
    }
    return true;
  };
  const startEdit = (banner: Banner) => {
    if (editingId === banner.id) {
      setEditingId(null);
      return;
    }
    setEditingId(banner.id);
    setEditDraft(toDraft(banner));
  };
  const saveEdit = async (
    event: FormEvent<HTMLFormElement>,
    banner: Banner,
  ) => {
    try {
      event.preventDefault();
      if (!draftValid(editDraft)) return;
      await actions.saveBanner(applyDraft(banner, editDraft));
      setEditingId(null);
    } catch (error) {}
  };
  const createBanner = async (event: FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      if (!draftValid(createDraft)) return;
      const created: Banner = applyDraft(
        {
          id: `b-${Date.now()}`,
          title: "",
          eyebrow: "",
          subtitle: "",
          ctaLabel: "",
          href: "",
          image: "",
          placement: "hero",
          active: true,
          startAt: "",
          endAt: "",
        },
        createDraft,
      );
      await actions.saveBanner(created);
      actions.notify(`Banner “${created.title}” created`, "success");
      setCreateDraft(blankDraft());
    } catch (error) {}
  };
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Banners"
        description={`${plural(state.banners.length, "banner")} in the store · each shows its placement, schedule window and live toggle`}
        action={
          <Link className="admin-btn quiet" href="/admin/promotions">
            Vouchers
          </Link>
        }
      />

      {state.banners.length === 0 ? (
        <AdminEmpty
          title="No banners"
          hint="Nothing is scheduled for the storefront yet — create the first banner with the form below."
        />
      ) : (
        <div className="admin-panels">
          {state.banners.map((banner) => (
            <article className="admin-card" key={banner.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div className="admin-chips">
                    <span
                      className={`admin-chip${banner.placement === "hero" ? " active" : ""}`}
                    >
                      {banner.placement === "hero" ? "Hero" : "Side"}
                    </span>
                    <button
                      type="button"
                      className={`admin-chip${banner.active ? " active" : ""}`}
                      aria-pressed={banner.active}
                      onClick={async () => {
                        try {
                          return await actions.toggleBanner(banner.id);
                        } catch (error) {}
                      }}
                    >
                      {banner.active ? "Active" : "Paused"}
                    </button>
                  </div>
                  <h3 style={{ margin: ".7rem 0 .3rem" }}>{banner.title}</h3>
                  <small style={{ color: "var(--muted)", fontSize: ".62rem" }}>
                    {formatDate(banner.startAt)} – {formatDate(banner.endAt)} ·{" "}
                    {banner.eyebrow || "no eyebrow"}
                  </small>
                </div>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="admin-btn ghost"
                    aria-expanded={editingId === banner.id}
                    onClick={() => startEdit(banner)}
                  >
                    {editingId === banner.id ? "Close editor" : "Edit"}
                  </button>
                </div>
              </div>

              <p style={{ marginTop: ".7rem" }}>
                {banner.subtitle || "No subtitle."}
              </p>
              <p>
                Button “{banner.ctaLabel || "—"}” → <code>{banner.href}</code>
                {banner.image ? (
                  <>
                    {" "}
                    · image <code>{banner.image}</code>
                  </>
                ) : null}
              </p>

              {editingId === banner.id ? (
                <form
                  className="form-grid"
                  style={{ marginTop: "1rem" }}
                  onSubmit={(event) => saveEdit(event, banner)}
                >
                  <MediaUpload
                    onUploaded={(url) =>
                      setEditDraft((current) =>
                        current ? { ...current, image: url } : current,
                      )
                    }
                  />
                  <BannerFields
                    value={editDraft}
                    onChange={(patch) =>
                      setEditDraft({ ...editDraft, ...patch })
                    }
                  />
                  <div
                    className="form-actions"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="primary">
                      Save banner
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <section className="admin-card" style={{ marginTop: "1.5rem" }}>
        <h2>Add a banner</h2>
        <p>
          Builds a new record with a generated id and activates it for the
          schedule window you set.
        </p>
        <form className="form-grid" onSubmit={createBanner}>
          <MediaUpload
            onUploaded={(url) =>
              setCreateDraft((current) => ({ ...current, image: url }))
            }
          />
          <BannerFields
            value={createDraft}
            onChange={(patch) => setCreateDraft({ ...createDraft, ...patch })}
          />
          <div className="form-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="primary">
              Create banner
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
