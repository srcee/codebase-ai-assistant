import { Button, Group } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
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
      <Button
        variant="subtle"
        color="red"
        size="xs"
        aria-label={label}
        disabled={disabled}
        leftSection={<IconTrash size={14} />}
        onClick={() => setAsking(true)}
      >
        Delete
      </Button>
    );
  }
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        color="red"
        size="xs"
        aria-label={`Confirm: ${label}`}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Confirm delete
      </Button>
      <Button variant="default" size="xs" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </Group>
  );
}
