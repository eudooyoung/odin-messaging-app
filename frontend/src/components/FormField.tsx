import type { ComponentPropsWithRef } from "react";

type FormFieldProps = {
  label: string;
  error?: string;
} &
  (
    | (ComponentPropsWithRef<"input"> & { as?: "input" })
    | (ComponentPropsWithRef<"textarea"> & { as: "textarea" })
  );

export function FormField({ label, error, id, ...fieldProps }: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  let control;

  if (fieldProps.as === "textarea") {
    const { as: _as, ...textareaProps } = fieldProps;
    control = (
      <textarea
        {...textareaProps}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      />
    );
  } else {
    const { as: _as, ...inputProps } = fieldProps;
    control = <input {...inputProps} id={id} aria-invalid={Boolean(error)} aria-describedby={errorId} />;
  }

  return (
    <>
      <label htmlFor={id}>{label}</label>
      {control}
      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
