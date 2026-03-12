// detect-user-os.ts - Browser platform detection scoped to app runtime code only.
// Keeps navigator/globalThis OS probing in app src instead of shared parser packages.
export type DetectedUserOs = 'mac' | 'win' | 'linux' | 'unknown';

type NavigatorLike = {
  platform?: string;
  userAgentData?: {
    platform?: string;
  };
};

export function detectUserOs(): DetectedUserOs {
  const runtimeNavigator = (globalThis as { navigator?: NavigatorLike }).navigator;
  if (!runtimeNavigator) {
    return 'unknown';
  }

  const detectedFromUaData = detectPlatformOs(runtimeNavigator.userAgentData?.platform);
  if (detectedFromUaData) {
    return detectedFromUaData;
  }

  const detectedFromPlatform = detectPlatformOs(runtimeNavigator.platform);
  if (detectedFromPlatform) {
    return detectedFromPlatform;
  }

  return 'unknown';
}

function detectPlatformOs(platformValue: string | undefined): Exclude<DetectedUserOs, 'unknown'> | null {
  const normalizedPlatform = (platformValue ?? '').toLowerCase();
  if (!normalizedPlatform) {
    return null;
  }

  if (normalizedPlatform.includes('mac')) {
    return 'mac';
  }

  if (normalizedPlatform.includes('win')) {
    return 'win';
  }

  if (normalizedPlatform.includes('linux')) {
    return 'linux';
  }

  return null;
}
