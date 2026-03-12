// lookupActionName — maps technical action IDs to human-readable descriptions for all supported editors.
import vscodeActions from './data/names/vscode-actions.json';
import jetbrainsActions from './data/names/jetbrains-actions.json';
import vimActions from './data/names/vim-actions.json';
import zedActions from './data/names/zed-actions.json';
import emacsActions from './data/names/emacs-actions.json';
import kritaActions from './data/names/krita-actions.json';
import illustratorActions from './data/names/illustrator-actions.json';
import blenderActions from './data/names/blender-actions.json';
import type { Editor } from './editor-formats';

export type { Editor } from './editor-formats';

type LocalizedActionValue = string | Record<string, string>;
type ActionDictionary = Record<string, LocalizedActionValue>;

const dictionaries: Record<Editor, ActionDictionary> = {
  vscode: vscodeActions as ActionDictionary,
  jetbrains: jetbrainsActions as ActionDictionary,
  vim: vimActions as ActionDictionary,
  neovim: vimActions as ActionDictionary,
  zed: zedActions as ActionDictionary,
  emacs: emacsActions as ActionDictionary,
  krita: kritaActions as ActionDictionary,
  illustrator: illustratorActions as ActionDictionary,
  blender: blenderActions as ActionDictionary,
};

export function lookupActionName(
  editor: Editor,
  actionId: string,
  locale?: string
): string {
  const dict = dictionaries[editor];
  if (!dict) {
    return actionId;
  }

  const candidate = dict[actionId];
  if (!candidate) {
    return editor === 'blender' ? humanizeBlenderActionId(actionId) : actionId;
  }

  if (typeof candidate === 'string') {
    return candidate;
  }

  const normalizedLocale = locale?.trim().toLowerCase();
  if (normalizedLocale && candidate[normalizedLocale]) {
    return candidate[normalizedLocale];
  }

  const localePrefix = normalizedLocale?.split('-')[0] ?? '';
  if (localePrefix && candidate[localePrefix]) {
    return candidate[localePrefix];
  }

  return candidate.en ?? Object.values(candidate)[0] ?? actionId;
}

export function getSupportedEditors(): Editor[] {
  return ['vscode', 'jetbrains', 'vim', 'neovim', 'zed', 'emacs', 'krita', 'illustrator', 'blender'];
}

export function getEditorActions(editor: Editor): ActionDictionary {
  return dictionaries[editor] ?? {};
}

function humanizeBlenderActionId(actionId: string): string {
  const normalizedActionId = actionId.trim();
  if (!normalizedActionId) {
    return actionId;
  }

  const suffix = normalizedActionId.split('.').pop() ?? normalizedActionId;
  return suffix
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}
