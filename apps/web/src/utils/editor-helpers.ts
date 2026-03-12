// editor-helpers.ts - Safe source-editor helpers for UI labels and tier lookups.
// Prevents unknown editors from being silently coerced into VS Code while reusing parser-owned validation.
import {
  getActionTier,
  isSupportedEditorFormat,
  lookupActionName,
  type Editor,
} from '@keymap-highlight/file-parsers';

export function toEditor(value: string | undefined): Editor | undefined {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue && isSupportedEditorFormat(normalizedValue)) {
    return normalizedValue;
  }

  return undefined;
}

export function lookupActionNameForSource(sourceEditor: string | undefined, actionId: string, locale?: string): string {
  const editor = toEditor(sourceEditor);
  return editor ? lookupActionName(editor, actionId, locale) : actionId;
}

export function getActionTierForSource(sourceEditor: string | undefined, command: string): 1 | 2 | null {
  const editor = toEditor(sourceEditor);
  return editor ? getActionTier(editor, command) : null;
}
