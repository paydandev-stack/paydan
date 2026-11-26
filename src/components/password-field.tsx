"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  label: string;
  helper?: string;
  error?: string;
};

export function PasswordField({ label, helper, error, name, ...inputProps }: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const descriptionId = helper || error ? `${id}-description` : undefined;

  return (
    <label className="password-field" htmlFor={id}>
      <span>{label}</span>
      <span className="password-control">
        <input
          {...inputProps}
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={descriptionId}
        />
        <button
          type="button"
          className="password-visibility"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
      {error ? (
        <small id={descriptionId} className="field-error" role="alert">{error}</small>
      ) : helper ? (
        <small id={descriptionId}>{helper}</small>
      ) : null}
    </label>
  );
}
