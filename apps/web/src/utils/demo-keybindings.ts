// demo-keybindings.ts - OS-aware remote and local demo keybinding loaders for VS Code defaults.
import type { SupportedOs } from '../store/useKeymapStore';

const DEMO_BASE_URL = 'https://raw.githubusercontent.com/codebling/vs-code-default-keybindings/master';

const OS_REMOTE_FILE_MAP: Record<SupportedOs, string> = {
  win: 'windows.keybindings.json',
  mac: 'osx.keybindings.json',
  linux: 'linux.keybindings.json',
};

export const buildVsCodeDefaultKeybindingsUrl = (os: SupportedOs): string =>
  `${DEMO_BASE_URL}/${OS_REMOTE_FILE_MAP[os]}`;

export const fetchVsCodeDefaultKeybindings = async (os: SupportedOs): Promise<string> => {
  const url = buildVsCodeDefaultKeybindingsUrl(os);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch default keybindings: ${response.status}`);
  }
  return response.text();
};
