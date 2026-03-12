// schemas/parseResult.ts - Zod schemas and inferred types for the parser output envelope.
// ParseWarning captures non-fatal issues; ParseMetadata records provenance and counts;
// ParseResult is the top-level contract returned by every format-specific parser function.
import { z } from 'zod';
import { BindingMode, EditorFormat } from './enums';
import { KeyBinding } from './keyBinding';

const nonEmptyTrimmedString = z.string().trim().min(1);

export const ParseWarning = z
  .object({
    message: nonEmptyTrimmedString,
    line: z.number().int().positive().optional(),
    code: nonEmptyTrimmedString.optional(),
  })
  .strict();

export type ParseWarning = z.infer<typeof ParseWarning>;

export const ParseMetadata = z
  .object({
    sourceEditor: EditorFormat,
    sourceName: nonEmptyTrimmedString.optional(),
    mode: BindingMode.optional(),
    parsedAt: z.string().datetime(),
    totalBindings: z.number().int().nonnegative(),
    totalWarnings: z.number().int().nonnegative(),
  })
  .strict();

export type ParseMetadata = z.infer<typeof ParseMetadata>;

export const ParseResult = z
  .object({
    bindings: z.array(KeyBinding),
    warnings: z.array(ParseWarning),
    metadata: ParseMetadata,
  })
  .strict();

export type ParseResult = z.infer<typeof ParseResult>;
