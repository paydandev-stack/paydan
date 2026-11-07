"use client";

import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Table shell. `template` is a grid-template-columns string (e.g.
 * `"1fr 1.2fr .8fr .8fr"`) shared by the header row and every `.table-row`,
 * published as the `--cols` custom property the admin stylesheet reads.
 */
export function AdminTable({
  template,
  head,
  children,
  caption,
}: {
  template: string;
  head: ReactNode[];
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div
      className="admin-table"
      style={{ "--cols": template } as CSSProperties}
    >
      {caption ? <span className="sr-only">{caption}</span> : null}
      <div className="table-head">
        {head.map((cell, index) => (
          <span key={index}>{cell}</span>
        ))}
      </div>
      {children}
    </div>
  );
}

/** Empty state for filtered or genuinely empty collections. */
export function AdminEmpty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="admin-empty">
      <h3>{title}</h3>
      <p>{hint}</p>
    </div>
  );
}

/** Search box sized for the `.admin-filters` row. */
export function AdminSearch({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <input
      type="search"
      className="admin-input"
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function AdminSelect({
  label,
  value,
  onChange,
  options,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
} & Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "onChange" | "value" | "children"
>) {
  return (
    <select
      className="admin-select"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function AdminTextField({
  label,
  hint,
  wide,
  ...rest
}: {
  label: string;
  hint?: string;
  wide?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  return (
    <label className={`admin-field${wide ? " wide" : ""}`}>
      {label}
      <input className="admin-input" {...rest} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function AdminTextArea({
  label,
  hint,
  wide,
  ...rest
}: {
  label: string;
  hint?: string;
  wide?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  return (
    <label className={`admin-field${wide ? " wide" : ""}`}>
      {label}
      <textarea className="admin-textarea" {...rest} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
