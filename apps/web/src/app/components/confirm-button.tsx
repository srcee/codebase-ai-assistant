import { useState } from 'react';

interface ConfirmButtonProps {
  /** Accessible name of the first button, for example `Delete docs`. */
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}

/** A delete button that asks once more inline instead of a blocking browser dialog. */
export function ConfirmButton({
  label,
  onConfirm,
  disabled,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        Delete
      </button>
    );
  }
  return (
    <span className="confirm">
      <button
        type="button"
        className="danger"
        aria-label={`Confirm: ${label}`}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Confirm delete
      </button>
      <button type="button" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}
