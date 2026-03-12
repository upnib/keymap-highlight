// Tests for commonActions helpers: verifies TIER1_ACTIONS, TIER2_ACTIONS, COMMON_ACTIONS structure,
// getActionTier classification (tier1/tier2/null), and isCommonAction boolean results
// across all supported editors including vim/neovim symmetry.
import { test, expect } from '@playwright/test';
import {
  TIER1_ACTIONS,
  TIER2_ACTIONS,
  COMMON_ACTIONS,
  getActionTier,
  isCommonAction,
} from '@keymap-highlight/file-parsers';
import type { Editor } from '@keymap-highlight/file-parsers';

const ALL_EDITORS: Editor[] = [
  'vscode',
  'jetbrains',
  'vim',
  'neovim',
  'zed',
  'emacs',
  'krita',
  'illustrator',
];

test.describe('TIER1_ACTIONS', () => {
  test('TIER1_ACTIONS contains entries for all 8 editors', () => {
    for (const editor of ALL_EDITORS) {
      expect(TIER1_ACTIONS[editor]).toBeDefined();
    }
  });

  test('TIER1_ACTIONS for each editor is non-empty', () => {
    for (const editor of ALL_EDITORS) {
      expect(TIER1_ACTIONS[editor].size).toBeGreaterThan(0);
    }
  });

  test('vscode TIER1 contains undo', () => {
    expect(TIER1_ACTIONS.vscode.has('undo')).toBe(true);
  });

  test('vscode TIER1 contains workbench.action.showCommands', () => {
    expect(TIER1_ACTIONS.vscode.has('workbench.action.showCommands')).toBe(true);
  });

  test('vscode TIER1 contains workbench.action.files.save', () => {
    expect(TIER1_ACTIONS.vscode.has('workbench.action.files.save')).toBe(true);
  });

  test('jetbrains TIER1 contains SaveAll', () => {
    expect(TIER1_ACTIONS.jetbrains.has('SaveAll')).toBe(true);
  });

  test('jetbrains TIER1 contains GotoDeclaration', () => {
    expect(TIER1_ACTIONS.jetbrains.has('GotoDeclaration')).toBe(true);
  });

  test('jetbrains TIER1 contains RenameElement', () => {
    expect(TIER1_ACTIONS.jetbrains.has('RenameElement')).toBe(true);
  });

  test('vim TIER1 contains i (insert mode)', () => {
    expect(TIER1_ACTIONS.vim.has('i')).toBe(true);
  });

  test('vim TIER1 contains dd (delete line)', () => {
    expect(TIER1_ACTIONS.vim.has('dd')).toBe(true);
  });

  test('vim TIER1 contains :wq', () => {
    expect(TIER1_ACTIONS.vim.has(':wq')).toBe(true);
  });

  test('neovim TIER1 contains same actions as vim TIER1', () => {
    for (const action of TIER1_ACTIONS.vim) {
      expect(TIER1_ACTIONS.neovim.has(action)).toBe(true);
    }
  });

  test('zed TIER1 contains editor::Undo', () => {
    expect(TIER1_ACTIONS.zed.has('editor::Undo')).toBe(true);
  });

  test('zed TIER1 contains workspace::Save', () => {
    expect(TIER1_ACTIONS.zed.has('workspace::Save')).toBe(true);
  });

  test('emacs TIER1 contains save-buffer', () => {
    expect(TIER1_ACTIONS.emacs.has('save-buffer')).toBe(true);
  });

  test('emacs TIER1 contains execute-extended-command', () => {
    expect(TIER1_ACTIONS.emacs.has('execute-extended-command')).toBe(true);
  });

  test('krita TIER1 contains edit_undo', () => {
    expect(TIER1_ACTIONS.krita.has('edit_undo')).toBe(true);
  });

  test('krita TIER1 contains file_save', () => {
    expect(TIER1_ACTIONS.krita.has('file_save')).toBe(true);
  });

  test('krita TIER1 contains KritaShape/KisToolBrush', () => {
    expect(TIER1_ACTIONS.krita.has('KritaShape/KisToolBrush')).toBe(true);
  });

  test('illustrator TIER1 contains Selection', () => {
    expect(TIER1_ACTIONS.illustrator.has('Selection')).toBe(true);
  });

  test('illustrator TIER1 contains Undo', () => {
    expect(TIER1_ACTIONS.illustrator.has('Undo')).toBe(true);
  });

  test('illustrator TIER1 contains Save', () => {
    expect(TIER1_ACTIONS.illustrator.has('Save')).toBe(true);
  });
});

test.describe('TIER2_ACTIONS', () => {
  test('TIER2_ACTIONS contains entries for all 8 editors', () => {
    for (const editor of ALL_EDITORS) {
      expect(TIER2_ACTIONS[editor]).toBeDefined();
    }
  });

  test('TIER2_ACTIONS for each editor is non-empty', () => {
    for (const editor of ALL_EDITORS) {
      expect(TIER2_ACTIONS[editor].size).toBeGreaterThan(0);
    }
  });

  test('vscode TIER2 contains editor.action.blockComment', () => {
    expect(TIER2_ACTIONS.vscode.has('editor.action.blockComment')).toBe(true);
  });

  test('vscode TIER2 contains git.commit', () => {
    expect(TIER2_ACTIONS.vscode.has('git.commit')).toBe(true);
  });

  test('vscode TIER2 does not contain undo (undo is TIER1)', () => {
    expect(TIER2_ACTIONS.vscode.has('undo')).toBe(false);
  });

  test('jetbrains TIER2 contains ToggleBlockComment', () => {
    expect(TIER2_ACTIONS.jetbrains.has('ToggleBlockComment')).toBe(true);
  });

  test('jetbrains TIER2 contains CheckinProject', () => {
    expect(TIER2_ACTIONS.jetbrains.has('CheckinProject')).toBe(true);
  });

  test('jetbrains TIER2 does not contain SaveAll (SaveAll is TIER1)', () => {
    expect(TIER2_ACTIONS.jetbrains.has('SaveAll')).toBe(false);
  });

  test('vim TIER2 contains ciw', () => {
    expect(TIER2_ACTIONS.vim.has('ciw')).toBe(true);
  });

  test('vim TIER2 contains Ctrl+w h', () => {
    expect(TIER2_ACTIONS.vim.has('Ctrl+w h')).toBe(true);
  });

  test('vim TIER2 does not contain dd (dd is TIER1)', () => {
    expect(TIER2_ACTIONS.vim.has('dd')).toBe(false);
  });

  test('neovim TIER2 contains same actions as vim TIER2', () => {
    for (const action of TIER2_ACTIONS.vim) {
      expect(TIER2_ACTIONS.neovim.has(action)).toBe(true);
    }
  });

  test('zed TIER2 contains editor::SelectLine', () => {
    expect(TIER2_ACTIONS.zed.has('editor::SelectLine')).toBe(true);
  });

  test('zed TIER2 contains assistant::InlineAssist', () => {
    expect(TIER2_ACTIONS.zed.has('assistant::InlineAssist')).toBe(true);
  });

  test('emacs TIER2 contains magit-status', () => {
    expect(TIER2_ACTIONS.emacs.has('magit-status')).toBe(true);
  });

  test('emacs TIER2 contains forward-word', () => {
    expect(TIER2_ACTIONS.emacs.has('forward-word')).toBe(true);
  });

  test('krita TIER2 contains rotate_canvas_left', () => {
    expect(TIER2_ACTIONS.krita.has('rotate_canvas_left')).toBe(true);
  });

  test('krita TIER2 contains show_brush_editor', () => {
    expect(TIER2_ACTIONS.krita.has('show_brush_editor')).toBe(true);
  });

  test('illustrator TIER2 contains Align', () => {
    expect(TIER2_ACTIONS.illustrator.has('Align')).toBe(true);
  });

  test('illustrator TIER2 contains Layers', () => {
    expect(TIER2_ACTIONS.illustrator.has('Layers')).toBe(true);
  });

  test('TIER1 and TIER2 sets are disjoint for vscode', () => {
    const intersection = [...TIER1_ACTIONS.vscode].filter((a) =>
      TIER2_ACTIONS.vscode.has(a)
    );
    expect(intersection.length).toBe(0);
  });

  test('TIER1 and TIER2 sets are disjoint for jetbrains', () => {
    const intersection = [...TIER1_ACTIONS.jetbrains].filter((a) =>
      TIER2_ACTIONS.jetbrains.has(a)
    );
    expect(intersection.length).toBe(0);
  });

  test('TIER1 and TIER2 sets are disjoint for vim', () => {
    const intersection = [...TIER1_ACTIONS.vim].filter((a) =>
      TIER2_ACTIONS.vim.has(a)
    );
    expect(intersection.length).toBe(0);
  });
});

test.describe('COMMON_ACTIONS', () => {
  test('COMMON_ACTIONS contains entries for all 8 editors', () => {
    for (const editor of ALL_EDITORS) {
      expect(COMMON_ACTIONS[editor]).toBeDefined();
    }
  });

  test('COMMON_ACTIONS for vscode is union of TIER1 and TIER2', () => {
    const expected = new Set([...TIER1_ACTIONS.vscode, ...TIER2_ACTIONS.vscode]);
    expect(COMMON_ACTIONS.vscode.size).toBe(expected.size);
  });

  test('COMMON_ACTIONS for jetbrains is union of TIER1 and TIER2', () => {
    const expected = new Set([...TIER1_ACTIONS.jetbrains, ...TIER2_ACTIONS.jetbrains]);
    expect(COMMON_ACTIONS.jetbrains.size).toBe(expected.size);
  });

  test('COMMON_ACTIONS vscode size is greater than TIER1 size alone', () => {
    expect(COMMON_ACTIONS.vscode.size).toBeGreaterThan(TIER1_ACTIONS.vscode.size);
  });

  test('COMMON_ACTIONS vscode contains all TIER1 vscode actions', () => {
    for (const action of TIER1_ACTIONS.vscode) {
      expect(COMMON_ACTIONS.vscode.has(action)).toBe(true);
    }
  });

  test('COMMON_ACTIONS vscode contains all TIER2 vscode actions', () => {
    for (const action of TIER2_ACTIONS.vscode) {
      expect(COMMON_ACTIONS.vscode.has(action)).toBe(true);
    }
  });
});

test.describe('getActionTier', () => {
  test('returns 1 for vscode undo (TIER1 action)', () => {
    expect(getActionTier('vscode', 'undo')).toBe(1);
  });

  test('returns 1 for vscode workbench.action.showCommands (TIER1 action)', () => {
    expect(getActionTier('vscode', 'workbench.action.showCommands')).toBe(1);
  });

  test('returns 1 for vscode editor.action.find (TIER1 action)', () => {
    expect(getActionTier('vscode', 'editor.action.find')).toBe(1);
  });

  test('returns 2 for vscode editor.action.blockComment (TIER2 action)', () => {
    expect(getActionTier('vscode', 'editor.action.blockComment')).toBe(2);
  });

  test('returns 2 for vscode git.commit (TIER2 action)', () => {
    expect(getActionTier('vscode', 'git.commit')).toBe(2);
  });

  test('returns null for vscode action not in any tier', () => {
    expect(getActionTier('vscode', 'some.nonexistent.action')).toBeNull();
  });

  test('returns 1 for jetbrains SaveAll (TIER1 action)', () => {
    expect(getActionTier('jetbrains', 'SaveAll')).toBe(1);
  });

  test('returns 1 for jetbrains GotoDeclaration (TIER1 action)', () => {
    expect(getActionTier('jetbrains', 'GotoDeclaration')).toBe(1);
  });

  test('returns 2 for jetbrains ToggleBlockComment (TIER2 action)', () => {
    expect(getActionTier('jetbrains', 'ToggleBlockComment')).toBe(2);
  });

  test('returns null for jetbrains action not in any tier', () => {
    expect(getActionTier('jetbrains', 'NonExistentJetbrainsAction')).toBeNull();
  });

  test('returns 1 for vim dd (TIER1 action)', () => {
    expect(getActionTier('vim', 'dd')).toBe(1);
  });

  test('returns 1 for vim :wq (TIER1 action)', () => {
    expect(getActionTier('vim', ':wq')).toBe(1);
  });

  test('returns 2 for vim ciw (TIER2 action)', () => {
    expect(getActionTier('vim', 'ciw')).toBe(2);
  });

  test('returns null for vim action not in any tier', () => {
    expect(getActionTier('vim', 'nonexistent-vim-command')).toBeNull();
  });

  test('returns 1 for neovim dd (same as vim TIER1)', () => {
    expect(getActionTier('neovim', 'dd')).toBe(1);
  });

  test('returns 2 for neovim ciw (same as vim TIER2)', () => {
    expect(getActionTier('neovim', 'ciw')).toBe(2);
  });

  test('returns 1 for zed editor::Undo (TIER1 action)', () => {
    expect(getActionTier('zed', 'editor::Undo')).toBe(1);
  });

  test('returns 2 for zed editor::SelectLine (TIER2 action)', () => {
    expect(getActionTier('zed', 'editor::SelectLine')).toBe(2);
  });

  test('returns null for zed action not in any tier', () => {
    expect(getActionTier('zed', 'zed::NonExistentAction')).toBeNull();
  });

  test('returns 1 for emacs save-buffer (TIER1 action)', () => {
    expect(getActionTier('emacs', 'save-buffer')).toBe(1);
  });

  test('returns 2 for emacs magit-status (TIER2 action)', () => {
    expect(getActionTier('emacs', 'magit-status')).toBe(2);
  });

  test('returns null for emacs action not in any tier', () => {
    expect(getActionTier('emacs', 'nonexistent-emacs-command')).toBeNull();
  });

  test('returns 1 for krita edit_undo (TIER1 action)', () => {
    expect(getActionTier('krita', 'edit_undo')).toBe(1);
  });

  test('returns 1 for krita file_save (TIER1 action)', () => {
    expect(getActionTier('krita', 'file_save')).toBe(1);
  });

  test('returns 2 for krita rotate_canvas_left (TIER2 action)', () => {
    expect(getActionTier('krita', 'rotate_canvas_left')).toBe(2);
  });

  test('returns null for krita action not in any tier', () => {
    expect(getActionTier('krita', 'nonexistent_krita_action')).toBeNull();
  });

  test('returns 1 for illustrator Selection (TIER1 action)', () => {
    expect(getActionTier('illustrator', 'Selection')).toBe(1);
  });

  test('returns 1 for illustrator Undo (TIER1 action)', () => {
    expect(getActionTier('illustrator', 'Undo')).toBe(1);
  });

  test('returns 2 for illustrator Align (TIER2 action)', () => {
    expect(getActionTier('illustrator', 'Align')).toBe(2);
  });

  test('returns null for illustrator action not in any tier', () => {
    expect(getActionTier('illustrator', 'Nonexistent Illustrator Action')).toBeNull();
  });
});

test.describe('isCommonAction', () => {
  test('returns true for vscode TIER1 action undo', () => {
    expect(isCommonAction('vscode', 'undo')).toBe(true);
  });

  test('returns true for vscode TIER2 action editor.action.blockComment', () => {
    expect(isCommonAction('vscode', 'editor.action.blockComment')).toBe(true);
  });

  test('returns false for vscode action not in any tier', () => {
    expect(isCommonAction('vscode', 'some.nonexistent.action')).toBe(false);
  });

  test('returns true for jetbrains TIER1 action SaveAll', () => {
    expect(isCommonAction('jetbrains', 'SaveAll')).toBe(true);
  });

  test('returns true for jetbrains TIER2 action ToggleBlockComment', () => {
    expect(isCommonAction('jetbrains', 'ToggleBlockComment')).toBe(true);
  });

  test('returns false for jetbrains action not in any tier', () => {
    expect(isCommonAction('jetbrains', 'NonExistentAction')).toBe(false);
  });

  test('returns true for vim TIER1 action dd', () => {
    expect(isCommonAction('vim', 'dd')).toBe(true);
  });

  test('returns true for vim TIER2 action ciw', () => {
    expect(isCommonAction('vim', 'ciw')).toBe(true);
  });

  test('returns false for vim action not in any tier', () => {
    expect(isCommonAction('vim', 'nonexistent-cmd')).toBe(false);
  });

  test('returns true for neovim TIER1 action dd', () => {
    expect(isCommonAction('neovim', 'dd')).toBe(true);
  });

  test('returns true for neovim TIER2 action ciw', () => {
    expect(isCommonAction('neovim', 'ciw')).toBe(true);
  });

  test('returns true for zed TIER1 action editor::Undo', () => {
    expect(isCommonAction('zed', 'editor::Undo')).toBe(true);
  });

  test('returns true for zed TIER2 action editor::SelectLine', () => {
    expect(isCommonAction('zed', 'editor::SelectLine')).toBe(true);
  });

  test('returns false for zed action not in any tier', () => {
    expect(isCommonAction('zed', 'zed::NonExistentAction')).toBe(false);
  });

  test('returns true for emacs TIER1 action save-buffer', () => {
    expect(isCommonAction('emacs', 'save-buffer')).toBe(true);
  });

  test('returns true for emacs TIER2 action magit-status', () => {
    expect(isCommonAction('emacs', 'magit-status')).toBe(true);
  });

  test('returns false for emacs action not in any tier', () => {
    expect(isCommonAction('emacs', 'not-a-real-command')).toBe(false);
  });

  test('returns true for krita TIER1 action edit_undo', () => {
    expect(isCommonAction('krita', 'edit_undo')).toBe(true);
  });

  test('returns true for krita TIER2 action rotate_canvas_left', () => {
    expect(isCommonAction('krita', 'rotate_canvas_left')).toBe(true);
  });

  test('returns false for krita action not in any tier', () => {
    expect(isCommonAction('krita', 'nonexistent_krita_action')).toBe(false);
  });

  test('returns true for illustrator TIER1 action Undo', () => {
    expect(isCommonAction('illustrator', 'Undo')).toBe(true);
  });

  test('returns true for illustrator TIER2 action Align', () => {
    expect(isCommonAction('illustrator', 'Align')).toBe(true);
  });

  test('returns false for illustrator action not in any tier', () => {
    expect(isCommonAction('illustrator', 'Nonexistent Action XYZ')).toBe(false);
  });

  test('isCommonAction result is consistent with getActionTier not null', () => {
    const tier = getActionTier('vscode', 'undo');
    const common = isCommonAction('vscode', 'undo');
    expect(common).toBe(tier !== null);
  });

  test('isCommonAction result is consistent with getActionTier for missing action', () => {
    const tier = getActionTier('vscode', 'totally.unknown.action');
    const common = isCommonAction('vscode', 'totally.unknown.action');
    expect(common).toBe(tier !== null);
  });
});
