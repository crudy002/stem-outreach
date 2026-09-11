import { createContext, useContext, useEffect, useState } from 'react';

// Every screen in this app pulls its colors from one of these token sets
// instead of hardcoding hex values, so the whole app can be re-skinned from
// one place. `light` is the default because this runs on a TV in shade with
// possible glare — a bright ground holds contrast under ambient light far
// better than a dark one does (a panel can push whites brighter than the
// glare, but it can't push blacks any darker than it).
export const THEMES = {
  light: {
    label: 'High-Visibility Light',
    description: 'Bright ground, dark text. Best resistance to outdoor glare.',
    bg: '#eef2f7',
    bgDeep: '#f4f6f9',
    bgDeepest: '#dbe3ec',
    panel: '#ffffff',
    panel2: '#e7ecf2',
    border: '#c9d3de',
    borderStrong: '#0e2a47',
    muted: '#3c5170',
    dim: '#8496ab',
    text: '#0b1f33',
    text2: '#26405c',
    accent: '#0b6fd1',
    onAccent: '#ffffff',
    success: '#0f7a42',
    warning: '#8a5200',
    danger: '#b91c1c',
    successGlow: 'rgba(15, 122, 66, 0.3)',
    overlay: 'rgba(11, 22, 35, 0.5)',
    warnPanelBg: '#fff6dd',
    warnPanelBorder: '#c99a2e',
    warnPanelText: '#6b4a05',
    hackedStart: '#fbdcdc',
  },
  brightDark: {
    label: 'Brightened Dark',
    description: 'Same navy identity as before, spread further apart so it survives glare.',
    bg: '#0a0e16',
    bgDeep: '#060911',
    bgDeepest: '#04060a',
    panel: '#172336',
    panel2: '#1f2f47',
    border: '#3a5578',
    borderStrong: '#4f739e',
    muted: '#a9bdd6',
    dim: '#6b8099',
    text: '#f2f6fb',
    text2: '#cddaeb',
    accent: '#4fc8ff',
    onAccent: '#0a0e16',
    success: '#34e883',
    warning: '#ffd23f',
    danger: '#ff5a5a',
    successGlow: 'rgba(52, 232, 131, 0.45)',
    overlay: 'rgba(6, 9, 15, 0.75)',
    warnPanelBg: '#241c0a',
    warnPanelBorder: '#9c7a1c',
    warnPanelText: '#e8d29a',
    hackedStart: '#240a0a',
  },
  phosphor: {
    label: 'Phosphor Terminal',
    description: 'True black plus one saturated hue, like a bright-room CRT terminal.',
    bg: '#050705',
    bgDeep: '#020302',
    bgDeepest: '#000000',
    panel: '#0c0f0c',
    panel2: '#121712',
    border: '#1e2b1e',
    borderStrong: '#2c4a2c',
    muted: '#5fae6e',
    dim: '#355035',
    text: '#baffc9',
    text2: '#8fe0a4',
    accent: '#39ff88',
    onAccent: '#020302',
    success: '#39ff88',
    warning: '#ffb000',
    danger: '#ff3b30',
    successGlow: 'rgba(57, 255, 136, 0.4)',
    overlay: 'rgba(2, 4, 2, 0.8)',
    warnPanelBg: '#1a1608',
    warnPanelBorder: '#6b5510',
    warnPanelText: '#d9c070',
    hackedStart: '#160505',
  },
  navy: {
    label: 'Classic Navy',
    description: 'The original dark theme. Reads great on a monitor indoors.',
    bg: '#0a1628',
    bgDeep: '#081320',
    bgDeepest: '#04070d',
    panel: '#0f1f33',
    panel2: '#152942',
    border: '#1f3354',
    borderStrong: '#2a4870',
    muted: '#5a7090',
    dim: '#3a4a66',
    text: '#c8d4e3',
    text2: '#8da3c0',
    accent: '#5b9bd5',
    onAccent: '#0a1628',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#ef4444',
    successGlow: 'rgba(74, 222, 128, 0.4)',
    overlay: 'rgba(4, 9, 18, 0.75)',
    warnPanelBg: '#1a1408',
    warnPanelBorder: '#7a5a10',
    warnPanelText: '#c8b088',
    hackedStart: '#1a0408',
  },
};

export const DEFAULT_THEME_ID = 'light';
const STORAGE_KEY = 'cyber-ctf-theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && THEMES[stored] ? stored : DEFAULT_THEME_ID;
    } catch {
      return DEFAULT_THEME_ID;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, themeId); } catch { /* private browsing, etc. */ }
  }, [themeId]);

  const value = { theme: THEMES[themeId], themeId, setThemeId };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
