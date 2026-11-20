declare global {
  interface Window {
    __EARTH_OFFLINE_ASSETS__?: Record<string, string>;
    __EARTH_DESKTOP__?: boolean;
  }
}

export function resourceUrl(path: string): string {
  const key = path.replace(/^\.\//, "");
  return window.__EARTH_OFFLINE_ASSETS__?.[key] ?? path;
}

export function isStandaloneBuild(): boolean {
  return Boolean(window.__EARTH_OFFLINE_ASSETS__ || window.__EARTH_DESKTOP__);
}
