// schemas/enums.ts - Zod enum schemas and their inferred TypeScript types for the core domain
// values: EditorFormat, KeyModifier (derived from the shared modifier-aliases util), BindingMode, and OS.
import { z } from 'zod';
import { SUPPORTED_EDITOR_FORMATS } from '../editor-formats';

export const EditorFormat = z.enum(SUPPORTED_EDITOR_FORMATS);
export type EditorFormat = z.infer<typeof EditorFormat>;

export const KeyModifier = z.string().trim().min(1);
export type KeyModifier = z.infer<typeof KeyModifier>;

export const BindingMode = z.enum(['global', 'normal', 'insert', 'visual', 'command', 'terminal']);
export type BindingMode = z.infer<typeof BindingMode>;

export const OS = z.enum(['windows', 'macos', 'linux']);
export type OS = z.infer<typeof OS>;
