// Tests for lookupActionName, getSupportedEditors, getEditorActions helpers:
// verifies dictionary lookup, locale fallback chain (exact → prefix → en → first value),
// string-type entries, unknown-editor/action fallbacks, and editor list completeness.
import { test, expect } from '@playwright/test';
import {
  lookupActionName,
  getSupportedEditors,
  getEditorActions,
} from '@keymap-highlight/file-parsers';

test.describe('lookupActionName', () => {
  test.describe('unknown action fallback', () => {
    test('returns raw action id when action is not in vscode dictionary', () => {
      const rawId = 'some.very.obscure.action.id';
      const result = lookupActionName('vscode', rawId);
      expect(result).toBe(rawId);
    });

    test('returns raw action id when action is not in jetbrains dictionary', () => {
      const rawId = 'NonExistentJetBrainsAction';
      const result = lookupActionName('jetbrains', rawId);
      expect(result).toBe(rawId);
    });

    test('returns raw action id when action is not in vim dictionary', () => {
      const rawId = 'nonexistent-vim-action';
      const result = lookupActionName('vim', rawId);
      expect(result).toBe(rawId);
    });

    test('returns raw action id for unknown action in zed dictionary', () => {
      const rawId = 'zed::NonExistentAction';
      const result = lookupActionName('zed', rawId);
      expect(result).toBe(rawId);
    });
  });

  test.describe('string-type dictionary entries', () => {
    test('returns string value directly for krita file_save', () => {
      const result = lookupActionName('krita', 'file_save');
      expect(result).toBe('Save');
    });

    test('returns string value directly for krita edit_undo', () => {
      const result = lookupActionName('krita', 'edit_undo');
      expect(result).toBe('Undo');
    });

    test('returns string value directly for illustrator Selection action', () => {
      const result = lookupActionName('illustrator', 'Selection');
      expect(result).toBe('Selection');
    });

    test('returns string value directly for illustrator New action', () => {
      const result = lookupActionName('illustrator', 'New');
      expect(result).toBe('New');
    });

    test('returns string value directly for illustrator Undo action', () => {
      const result = lookupActionName('illustrator', 'Undo');
      expect(result).toBe('Undo');
    });
  });

  test.describe('locale fallback: exact locale match', () => {
    test('returns en value for vscode editor.action.find with locale en', () => {
      const result = lookupActionName('vscode', 'editor.action.find', 'en');
      expect(result).toBe('Find');
    });

    test('returns es value for vscode workbench.action.showCommands with locale es', () => {
      const result = lookupActionName('vscode', 'workbench.action.showCommands', 'es');
      expect(result).toBe('Mostrar Todos los Comandos');
    });

    test('returns fr value for jetbrains SaveAll with locale fr', () => {
      const result = lookupActionName('jetbrains', 'SaveAll', 'fr');
      expect(result).toBe('Tout Enregistrer');
    });

    test('returns en value for vim h action with locale en', () => {
      const result = lookupActionName('vim', 'h', 'en');
      expect(result).toBe('Move Left');
    });

    test('returns es value for vim h action with locale es', () => {
      const result = lookupActionName('vim', 'h', 'es');
      expect(result).toBe('Mover a la Izquierda');
    });

    test('returns en value for emacs save-buffer with locale en', () => {
      const result = lookupActionName('emacs', 'save-buffer', 'en');
      expect(result).toBe('Save Buffer');
    });

    test('returns fr value for emacs save-buffer with locale fr', () => {
      const result = lookupActionName('emacs', 'save-buffer', 'fr');
      expect(result).toBe('Enregistrer le Tampon');
    });
  });

  test.describe('locale fallback: locale prefix match', () => {
    test('falls back to zh prefix when zh-hk (no exact match) requested for vscode undo', () => {
      const result = lookupActionName('vscode', 'undo', 'zh-hk');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe('undo');
    });

    test('falls back to es prefix when es-MX requested for vscode editor.action.find', () => {
      const result = lookupActionName('vscode', 'editor.action.find', 'es-MX');
      expect(result).toBe('Buscar');
    });

    test('falls back to fr prefix when fr-CA requested for jetbrains FindUsages', () => {
      const result = lookupActionName('jetbrains', 'FindUsages', 'fr-CA');
      expect(result).toBe('Trouver les Utilisations');
    });

    test('falls back to en prefix when en-US (no exact match) requested for zed zed::OpenFile', () => {
      const result = lookupActionName('zed', 'zed::OpenFile', 'en-US');
      expect(result).toBe('Open File');
    });
  });

  test.describe('locale fallback: default en fallback', () => {
    test('returns en value when locale is undefined for vscode editor.action.find', () => {
      const result = lookupActionName('vscode', 'editor.action.find');
      expect(result).toBe('Find');
    });

    test('returns en value when locale is undefined for jetbrains SaveAll', () => {
      const result = lookupActionName('jetbrains', 'SaveAll');
      expect(result).toBe('Save All');
    });

    test('returns en value when locale is undefined for vim h', () => {
      const result = lookupActionName('vim', 'h');
      expect(result).toBe('Move Left');
    });

    test('returns en value when locale is undefined for emacs save-buffer', () => {
      const result = lookupActionName('emacs', 'save-buffer');
      expect(result).toBe('Save Buffer');
    });

    test('returns en value when unknown locale provided for zed zed::NewFile', () => {
      const result = lookupActionName('zed', 'zed::NewFile', 'xx-unknown');
      expect(result).toBe('New File');
    });

    test('returns en value when locale with whitespace provided for vscode undo', () => {
      const result = lookupActionName('vscode', 'undo', '  ');
      expect(result).toBe('Undo');
    });
  });

  test.describe('neovim shares vim dictionary', () => {
    test('neovim and vim return the same result for shared action h', () => {
      const vim = lookupActionName('vim', 'h');
      const neovim = lookupActionName('neovim', 'h');
      expect(neovim).toBe(vim);
    });

    test('neovim returns same localized result as vim for es locale', () => {
      const vim = lookupActionName('vim', 'h', 'es');
      const neovim = lookupActionName('neovim', 'h', 'es');
      expect(neovim).toBe(vim);
    });
  });
});

test.describe('getSupportedEditors', () => {
  test('returns an array of all 8 supported editors', () => {
    const editors = getSupportedEditors();
    expect(editors.length).toBe(8);
  });

  test('includes vscode in supported editors', () => {
    expect(getSupportedEditors()).toContain('vscode');
  });

  test('includes jetbrains in supported editors', () => {
    expect(getSupportedEditors()).toContain('jetbrains');
  });

  test('includes vim in supported editors', () => {
    expect(getSupportedEditors()).toContain('vim');
  });

  test('includes neovim in supported editors', () => {
    expect(getSupportedEditors()).toContain('neovim');
  });

  test('includes zed in supported editors', () => {
    expect(getSupportedEditors()).toContain('zed');
  });

  test('includes emacs in supported editors', () => {
    expect(getSupportedEditors()).toContain('emacs');
  });

  test('includes krita in supported editors', () => {
    expect(getSupportedEditors()).toContain('krita');
  });

  test('includes illustrator in supported editors', () => {
    expect(getSupportedEditors()).toContain('illustrator');
  });
});

test.describe('getEditorActions', () => {
  test('returns non-empty dictionary for vscode', () => {
    const actions = getEditorActions('vscode');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  test('returns dictionary containing editor.action.find for vscode', () => {
    const actions = getEditorActions('vscode');
    expect('editor.action.find' in actions).toBe(true);
  });

  test('returns non-empty dictionary for jetbrains', () => {
    const actions = getEditorActions('jetbrains');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  test('returns dictionary containing SaveAll for jetbrains', () => {
    const actions = getEditorActions('jetbrains');
    expect('SaveAll' in actions).toBe(true);
  });

  test('returns non-empty dictionary for vim', () => {
    const actions = getEditorActions('vim');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  test('returns same dictionary for neovim and vim', () => {
    const vim = getEditorActions('vim');
    const neovim = getEditorActions('neovim');
    expect(Object.keys(neovim).length).toBe(Object.keys(vim).length);
  });

  test('returns non-empty dictionary for zed', () => {
    const actions = getEditorActions('zed');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  test('returns non-empty dictionary for emacs', () => {
    const actions = getEditorActions('emacs');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  test('returns non-empty dictionary for krita', () => {
    const actions = getEditorActions('krita');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  test('returns non-empty dictionary for illustrator', () => {
    const actions = getEditorActions('illustrator');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });
});
