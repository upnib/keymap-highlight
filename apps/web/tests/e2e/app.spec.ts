// E2E tests for the Keymap Highlight web app — landing page core flows.
// Covers title/controls visibility, paste panel toggle, parse button state, and demo/GitHub controls.
import { test, expect } from '@playwright/test';

test.describe('Keymap Highlight E2E | Landing', () => {
  test('landing title and core controls are visible @e2e @landing', async ({ page }) => {
    await page.goto('/index');

    await expect(page).toHaveTitle(/Keymap/i);

    await expect(page.getByRole('heading', { name: 'Keymap Highlight' })).toBeVisible();

    await expect(page.getByRole('button', { name: /Load Config File/i })).toBeVisible();

    await expect(page.getByRole('button', { name: /Paste raw config instead/i })).toBeVisible();

    await expect(page.getByText(/Load Demo/i)).toBeVisible();
  });

  test('paste panel toggles open, parse button disabled when empty and enabled after input @e2e @landing', async ({ page }) => {
    await page.goto('/index');

    const toggleButton = page.getByRole('button', { name: /Paste raw config instead/i });
    await expect(toggleButton).toBeVisible();

    const parseButton = page.getByRole('button', { name: /Parse content/i });
    await expect(parseButton).not.toBeVisible();

    await toggleButton.click();

    await expect(page.getByRole('button', { name: /Hide paste input/i })).toBeVisible();
    await expect(parseButton).toBeVisible();
    await expect(parseButton).toBeDisabled();

    const textarea = page.getByPlaceholder(/Paste your keymap configuration here/i);
    await expect(textarea).toBeVisible();
    await textarea.fill('{ "key": "ctrl+c", "command": "copy" }');

    await expect(parseButton).toBeEnabled();
  });

  test('demo controls are visible and GitHub link points to upnib/keymap-highlight @e2e @landing', async ({ page }) => {
    await page.goto('/index');

    await expect(page.getByRole('button', { name: /VS Code/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /JetBrains/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Vim/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Zed/i })).toBeVisible();

    const githubLink = page.getByRole('link', { name: /GitHub/i });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/upnib/keymap-highlight');
  });
});
