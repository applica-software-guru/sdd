export interface SddUiConfig {
  componentPath: string;
  componentName: string;
  screenshotPaths: string[];
}

export function getConfig(): SddUiConfig {
  const raw = import.meta.env.VITE_SCREENSHOT_PATHS ?? '';
  const screenshotPaths = raw ? raw.split('|').filter(Boolean) : [];

  return {
    componentPath: import.meta.env.VITE_COMPONENT_PATH ?? '',
    componentName: import.meta.env.VITE_COMPONENT_NAME ?? 'Component',
    screenshotPaths,
  };
}
