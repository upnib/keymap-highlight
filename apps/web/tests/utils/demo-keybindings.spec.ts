// Tests for demo-keybindings — buildVsCodeDefaultKeybindingsUrl URL generation and fetchVsCodeDefaultKeybindings fetch behavior.
import { test, expect } from '@playwright/test';
import { buildVsCodeDefaultKeybindingsUrl, fetchVsCodeDefaultKeybindings } from '../../src/utils/demo-keybindings';

test.describe('buildVsCodeDefaultKeybindingsUrl', () => {
  test('builds correct URL for windows', () => {
    const url = buildVsCodeDefaultKeybindingsUrl('win');
    expect(url).toContain('windows.keybindings.json');
    expect(new URL(url).protocol).toMatch(/^https?:$/);
  });

  test('builds correct URL for mac', () => {
    const url = buildVsCodeDefaultKeybindingsUrl('mac');
    expect(url).toContain('osx.keybindings.json');
    expect(new URL(url).protocol).toMatch(/^https?:$/);
  });

  test('builds correct URL for linux', () => {
    const url = buildVsCodeDefaultKeybindingsUrl('linux');
    expect(url).toContain('linux.keybindings.json');
    expect(new URL(url).protocol).toMatch(/^https?:$/);
  });

  test('all OS URLs share the same base URL', () => {
    const winUrl = buildVsCodeDefaultKeybindingsUrl('win');
    const macUrl = buildVsCodeDefaultKeybindingsUrl('mac');
    const linuxUrl = buildVsCodeDefaultKeybindingsUrl('linux');

    const winBase = winUrl.substring(0, winUrl.lastIndexOf('/'));
    const macBase = macUrl.substring(0, macUrl.lastIndexOf('/'));
    const linuxBase = linuxUrl.substring(0, linuxUrl.lastIndexOf('/'));

    expect(winBase).toBe(macBase);
    expect(macBase).toBe(linuxBase);
  });

  test('URLs for different OSes are distinct', () => {
    const winUrl = buildVsCodeDefaultKeybindingsUrl('win');
    const macUrl = buildVsCodeDefaultKeybindingsUrl('mac');
    const linuxUrl = buildVsCodeDefaultKeybindingsUrl('linux');

    expect(winUrl).not.toBe(macUrl);
    expect(macUrl).not.toBe(linuxUrl);
    expect(winUrl).not.toBe(linuxUrl);
  });
});

test.describe('fetchVsCodeDefaultKeybindings — mocked fetch', () => {
  test('returns response text on successful fetch', async () => {
    const fakeContent = '[{"key":"ctrl+c","command":"copy"}]';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => fakeContent,
    } as Response);

    const result = await fetchVsCodeDefaultKeybindings('win');
    expect(result).toBe(fakeContent);

    globalThis.fetch = originalFetch;
  });

  test('throws on non-ok response with status in message', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      text: async () => '',
    } as Response);

    await expect(fetchVsCodeDefaultKeybindings('mac')).rejects.toThrow('404');

    globalThis.fetch = originalFetch;
  });

  test('throws on network failure', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    await expect(fetchVsCodeDefaultKeybindings('linux')).rejects.toThrow('Network error');

    globalThis.fetch = originalFetch;
  });

  test('fetches using the URL built by buildVsCodeDefaultKeybindingsUrl', async () => {
    let capturedUrl = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      capturedUrl = url as string;
      return { ok: true, text: async () => '[]' } as Response;
    };

    await fetchVsCodeDefaultKeybindings('mac');
    expect(capturedUrl).toBe(buildVsCodeDefaultKeybindingsUrl('mac'));

    globalThis.fetch = originalFetch;
  });

  test('error message includes the HTTP status code', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => '',
    } as Response);

    await expect(fetchVsCodeDefaultKeybindings('win')).rejects.toThrow('503');

    globalThis.fetch = originalFetch;
  });
});
