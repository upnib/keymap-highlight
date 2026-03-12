// layout-pipeline/src/format-detection.ts - Shared runtime OS label mapping for worker parser dispatch.
import type { SupportedOs } from './types';

export const mapStoreOsToWorkerOs = (os: SupportedOs): string => {
  switch (os) {
    case 'mac':
      return 'macos';
    case 'win':
      return 'windows';
    case 'linux':
      return 'linux';
  }
};
