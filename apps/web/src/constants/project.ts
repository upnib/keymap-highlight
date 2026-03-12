// apps/web/src/constants/project.ts
// Project-wide configuration constants

import packageMetadata from '../../package.json';

export const PROJECT_CONFIG = {
  APP_VERSION: packageMetadata.version,
  GITHUB_REPO_URL: 'https://github.com/upnib/keymap-highlight',
};
