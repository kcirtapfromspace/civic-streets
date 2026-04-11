export interface ClientMeta {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  formDurationMs: number;
}

export function collectClientMeta(formOpenedAt: number): ClientMeta {
  return {
    userAgent: navigator.userAgent.slice(0, 500),
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform:
      (navigator as Navigator & { userAgentData?: { platform: string } })
        .userAgentData?.platform ?? navigator.platform,
    formDurationMs: Date.now() - formOpenedAt,
  };
}
