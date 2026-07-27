import type { UIPreferences } from '@/main/store/schema';

export function applyTheme(theme: UIPreferences['theme']) {
  const isDark =
    theme === 'dark' ||
    (theme === 'auto' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}
