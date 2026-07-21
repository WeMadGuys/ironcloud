import type { ColorTheme } from './colors';
import { lightColors } from './colors';

export type IconTokens = {
  readonly primary: string;
  readonly secondary: string;
  readonly inactive: string;
  readonly inverse: string;
  readonly accent: string;
  readonly success: string;
  readonly warning: string;
  readonly error: string;
  readonly info: string;
  readonly onPrimary: string;
  readonly onAccent: string;
  readonly size: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
  };
};

export const createIconTokens = (colors: ColorTheme = lightColors): IconTokens => ({
  primary: colors.icon.primary,
  secondary: colors.icon.secondary,
  inactive: colors.icon.inactive,
  inverse: colors.icon.inverse,
  accent: colors.brand.accent,
  success: colors.status.success.foreground,
  warning: colors.status.warning.foreground,
  error: colors.status.error.foreground,
  info: colors.status.info.foreground,
  onPrimary: colors.brand.onPrimary,
  onAccent: colors.brand.onAccent,
  size: {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 28,
    xl: 36,
  },
});

export const icons = createIconTokens();

export type Icons = typeof icons;
