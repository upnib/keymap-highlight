// schemas/keyBinding.ts - Zod schemas for a single key chord and a full key binding entry.
// KeyChord represents one physical key press with its modifier list; KeyBinding extends that
// with command, optional when-clause, multi-chord sequences, and source editor metadata.
import { z } from 'zod';
import { EditorFormat, KeyModifier } from './enums';

const nonEmptyTrimmedString = z.string().trim().min(1);

export const KeyChord = z
  .object({
    key: nonEmptyTrimmedString,
    modifiers: z.array(KeyModifier),
  })
  .strict();

export type KeyChord = z.infer<typeof KeyChord>;

export const KeyBinding = z
  .object({
    key: nonEmptyTrimmedString,
    command: nonEmptyTrimmedString,
    when: z.string().trim().default(''),
    modifiers: z.array(KeyModifier),
    chords: z.array(KeyChord),
    sourceEditor: EditorFormat,
    isConflict: z.boolean().optional(),
  })
  .strict();

export type KeyBinding = z.infer<typeof KeyBinding>;
