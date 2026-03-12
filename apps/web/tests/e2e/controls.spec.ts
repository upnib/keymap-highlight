// E2E tests for workspace controls: canvas overlays, zoom toolbar, cheatsheet modal, and settings controls.
// Covers canvas/zoom UI, cheatsheet modal export gating, and settings (layout, input layout, language, OS toggle).
// Uses a small valid VS Code keybindings.json pasted via the landing page to reach the workspace before each group.
import { test, expect, type Page } from '@playwright/test';

const VSCODE_SAMPLE = JSON.stringify([
  { key: 'ctrl+n', command: 'workbench.action.files.newUntitledFile' },
  { key: 'ctrl+s', command: 'workbench.action.files.save' },
  { key: 'ctrl+z', command: 'undo' },
  { key: 'ctrl+shift+z', command: 'redo' },
  { key: 'ctrl+p', command: 'workbench.action.quickOpen' },
]);

async function loadViaLandingPaste(page: Page) {
  await page.goto('/index');
  await expect(page.locator('h1')).toContainText('Keymap Highlight');

  const pasteToggle = page.getByRole('button', { name: /paste raw config/i });
  await expect(pasteToggle).toBeVisible();
  await pasteToggle.click();

  const formatSelect = page.locator('select').first();
  await expect(formatSelect).toBeVisible();
  await formatSelect.selectOption('vscode');

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill(VSCODE_SAMPLE);

  const parseButton = page.getByRole('button', { name: /parse content/i });
  await expect(parseButton).toBeEnabled();
  await parseButton.click();

  await expect(page.locator('[data-testid="keyboard-canvas"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Keymap Highlight E2E | Controls', () => {
  test('keyboard canvas and zoom toolbar are visible with key count and shortcut legend @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    await expect(page.locator('[data-testid="keyboard-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="zoom-toolbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="canvas-key-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="shortcut-legend"]')).toBeVisible();
  });

  test('zoom in button increases zoom percentage text @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const zoomToolbar = page.locator('[data-testid="zoom-toolbar"]');
    await expect(zoomToolbar).toBeVisible();

    const getZoomPercent = async () => {
      const text = await zoomToolbar.locator('p, span, div').filter({ hasText: /%/ }).last().innerText();
      return parseInt(text.replace('%', '').trim(), 10);
    };

    const zoomInBtn = zoomToolbar.getByRole('button', { name: /zoom in/i });
    await expect(zoomInBtn).toBeVisible();

    const beforeZoom = await getZoomPercent();
    await zoomInBtn.click();
    const afterZoom = await getZoomPercent();

    expect(afterZoom).toBeGreaterThan(beforeZoom);
  });

  test('zoom out button decreases zoom percentage text @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const zoomToolbar = page.locator('[data-testid="zoom-toolbar"]');
    await expect(zoomToolbar).toBeVisible();

    const getZoomPercent = async () => {
      const text = await zoomToolbar.locator('p, span, div').filter({ hasText: /%/ }).last().innerText();
      return parseInt(text.replace('%', '').trim(), 10);
    };

    const zoomOutBtn = zoomToolbar.getByRole('button', { name: /zoom out/i });
    await expect(zoomOutBtn).toBeVisible();

    const beforeZoom = await getZoomPercent();
    await zoomOutBtn.click();
    const afterZoom = await getZoomPercent();

    expect(afterZoom).toBeLessThan(beforeZoom);
  });

  test('cheatsheet modal opens from generate-cheatsheet button @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const cheatsheetBtn = page.getByRole('button', { name: /generate cheatsheet/i });
    await expect(cheatsheetBtn).toBeVisible();
    await cheatsheetBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/generate cheatsheet/i)).toBeVisible();
  });

  test('cheatsheet modal: None selection disables export buttons @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const cheatsheetBtn = page.getByRole('button', { name: /generate cheatsheet/i });
    await cheatsheetBtn.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const noneBtn = modal.getByRole('button', { name: /^none$/i });
    await expect(noneBtn).toBeVisible();
    await noneBtn.click();

    const exportPdfBtn = modal.getByRole('button', { name: /export pdf/i });
    const exportMdBtn = modal.getByRole('button', { name: /export markdown/i });

    await expect(exportPdfBtn).toBeDisabled();
    await expect(exportMdBtn).toBeDisabled();
  });

  test('cheatsheet modal: All selection enables export buttons @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const cheatsheetBtn = page.getByRole('button', { name: /generate cheatsheet/i });
    await cheatsheetBtn.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const noneBtn = modal.getByRole('button', { name: /^none$/i });
    await noneBtn.click();

    const allBtn = modal.getByRole('button', { name: /^all$/i });
    await expect(allBtn).toBeVisible();
    await allBtn.click();

    const exportPdfBtn = modal.getByRole('button', { name: /export pdf/i });
    const exportMdBtn = modal.getByRole('button', { name: /export markdown/i });

    await expect(exportPdfBtn).toBeEnabled();
    await expect(exportMdBtn).toBeEnabled();
  });

  test('layout selector changes value in workspace settings @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const layoutSelector = page.locator('[data-testid="layout-selector"]');
    await expect(layoutSelector).toBeVisible();

    const initialValue = await layoutSelector.inputValue();
    const targetValue = initialValue === 'ansi-tkl' ? 'ansi-full' : 'ansi-tkl';
    await layoutSelector.selectOption(targetValue);

    await expect(layoutSelector).toHaveValue(targetValue);
  });

  test('input layout selector switches to custom and shows file upload button @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const inputLayoutSelector = page.locator('[data-testid="input-layout-selector"]');
    await expect(inputLayoutSelector).toBeVisible();

    await inputLayoutSelector.selectOption('custom');
    await expect(inputLayoutSelector).toHaveValue('custom');

    const uploadButton = page.locator('[data-testid="custom-input-layout-upload-button"]');
    await expect(uploadButton).toBeVisible();

    const fileInput = page.locator('[data-testid="custom-input-layout-file-input"]');
    await expect(fileInput).toBeAttached();
  });

  test('input layout file upload shows uploaded filename @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const inputLayoutSelector = page.locator('[data-testid="input-layout-selector"]');
    await inputLayoutSelector.selectOption('custom');

    const fileInput = page.locator('[data-testid="custom-input-layout-file-input"]');
    await expect(fileInput).toBeAttached();

    const customMapping = JSON.stringify({ a: 'b', s: 'r' });
    await fileInput.setInputFiles({
      name: 'my-layout.json',
      mimeType: 'application/json',
      buffer: Buffer.from(customMapping),
    });

    await expect(page.getByText('my-layout.json')).toBeVisible();
  });

  test('language switcher select can change to zh-CN @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const langSwitchers = page.getByRole('combobox', { name: /language/i });
    const langSwitcher = langSwitchers.first();
    await expect(langSwitcher).toBeVisible();

    await langSwitcher.selectOption('zh-CN');
    await expect(langSwitcher).toHaveValue('zh-CN');
  });

  test('OS toggle buttons Windows, macOS, and Linux are visible and clickable @e2e @controls', async ({ page }) => {
    await loadViaLandingPaste(page);

    const winBtn = page.getByRole('button', { name: /windows/i });
    const macBtn = page.getByRole('button', { name: /macos/i });
    const linuxBtn = page.getByRole('button', { name: /linux/i });

    await expect(winBtn).toBeVisible();
    await expect(macBtn).toBeVisible();
    await expect(linuxBtn).toBeVisible();

    await macBtn.click();
    await expect(macBtn).toBeVisible();

    await linuxBtn.click();
    await expect(linuxBtn).toBeVisible();

    await winBtn.click();
    await expect(winBtn).toBeVisible();
  });
});
