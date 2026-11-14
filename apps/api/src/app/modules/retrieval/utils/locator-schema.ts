import type { Locator } from '@codebase-ai/contracts';
import { z } from 'zod';

const position = z.number().int().min(1);

const linesLocator = z
  .strictObject({
    kind: z.literal('lines'),
    startLine: position,
    endLine: position,
  })
  .refine((locator) => locator.endLine >= locator.startLine, {
    message: 'endLine must not be before startLine',
  });

const tableRowsLocator = z
  .strictObject({
    kind: z.literal('table_rows'),
    sheet: z.string().min(1).optional(),
    tableIndex: z.number().int().min(0).optional(),
    rowStart: position,
    rowEnd: position,
    columns: z.array(z.string()),
  })
  .refine((locator) => locator.rowEnd >= locator.rowStart, {
    message: 'rowEnd must not be before rowStart',
  });

export const locatorSchema: z.ZodType<Locator> = z.discriminatedUnion('kind', [
  linesLocator,
  z.strictObject({
    kind: z.literal('section'),
    headingPath: z.array(z.string()).min(1),
    page: position.optional(),
  }),
  z.strictObject({ kind: z.literal('page'), page: position }),
  tableRowsLocator,
  z.strictObject({
    kind: z.literal('schema_entity'),
    entity: z.string().min(1),
    path: z.string().min(1).optional(),
  }),
  z.strictObject({
    kind: z.literal('image'),
    frame: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
  }),
]);
