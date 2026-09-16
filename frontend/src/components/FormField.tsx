import type { ComponentPropsWithRef } from "react";

type FormFieldProps = ComponentPropsWithRef<"input"> & {
  label: string;
  error?: string;
};

export function FormField({ label, error, id, ...inputProps }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      />
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
