import type { TransformFnParams } from 'class-transformer';

/** Postgres stores uuids in lower case, so mixed-case duplicates must compare equal. */
export const lowerCaseEach = ({ value }: TransformFnParams): unknown =>
  Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.toLowerCase() : item,
      )
    : value;
