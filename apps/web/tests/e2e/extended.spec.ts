// E2E tests for workspace flows after parsing keymaps from the landing page.
// Covers parse-to-workspace navigation, warning surface, back-to-index, and runtime stability checks.
import { test, expect, type Page } from '@playwright/test';

const VSCODE_SAMPLE = JSON.stringify([
  { key: 'ctrl+c', command: 'editor.action.clipboardCopyAction', when: 'textInputFocus' },
  { key: 'ctrl+v', command: 'editor.action.clipboardPasteAction', when: 'textInputFocus' },
  { key: 'ctrl+z', command: 'undo', when: '' },
  { key: 'ctrl+s', command: 'workbench.action.files.save', when: '' },
  { key: 'ctrl+shift+p', command: 'workbench.action.showCommands', when: '' },
]);

const VIM_PARTIAL_INVALID_SAMPLE = [
  'nnoremap <C-s> :w<CR>',
  'nnoremap <C-q> :q<CR>',
  'this is not a valid mapping line !!!',
  'also_invalid_garbage',
  'inoremap <A-j> <Down>',
].join('\n');

async function pasteAndParse(page: Page, format: string, content: string) {
  await page.goto('/index');
  await page.getByRole('button', { name: /paste raw config/i }).click();
  await page.locator('select').first().selectOption(format);
  await page.locator('textarea').fill(content);
  await page.getByRole('button', { name: /parse content/i }).click();
}

test.describe('Keymap Highlight E2E | Workspace', () => {
  test('parsing valid VS Code sample routes to workspace and shows all main panels and binding rows @e2e @workspace', async ({ page }) => {
    await pasteAndParse(page, 'vscode', VSCODE_SAMPLE);

    await expect(page).toHaveURL('/');

    await expect(page.locator('[data-testid="keyboard-canvas"]')).toBeVisible();

    await expect(page.locator('[data-testid="bottom-panel"]')).toBeVisible();

    await expect(page.locator('[data-testid="info-panel"]')).toBeVisible();

    const bindingRows = page.locator('[data-testid="binding-row"]');
    await expect(bindingRows.first()).toBeVisible();
    await expect(bindingRows.nth(1)).toBeVisible();
  });

  test('parsing partially invalid Vim sample still enters workspace and shows warning banner @e2e @workspace', async ({ page }) => {
    await pasteAndParse(page, 'vim', VIM_PARTIAL_INVALID_SAMPLE);

    await expect(page).toHaveURL('/');

    await expect(page.locator('[data-testid="warning-banner"]')).toBeVisible();
  });

  test('clicking Back to Index returns to /index and shows landing controls @e2e @workspace', async ({ page }) => {
    await pasteAndParse(page, 'vscode', VSCODE_SAMPLE);
    await expect(page).toHaveURL('/');

    await page.locator('[data-testid="bottom-panel"]').getByRole('button', { name: /back to index/i }).click();

    await expect(page).toHaveURL('/index');

    await expect(page.getByRole('button', { name: /load config file/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /paste raw config/i })).toBeVisible();
  });
  test('workspace root renders without uncaught page errors @e2e @workspace', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await pasteAndParse(page, 'vscode', VSCODE_SAMPLE);

    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('[data-testid="keyboard-canvas"]')).toBeVisible();

    await page.waitForLoadState('networkidle');
    expect(errors.length).toBe(0);
  });
});
