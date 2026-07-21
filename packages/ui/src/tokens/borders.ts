import type { ColorTheme } from './colors';
import { lightColors } from './colors';

export const createBorders = (colors: ColorTheme = lightColors) =>
  ({
    width: {
      none: 0,
      hairline: 1,
      default: 1.5,
      thick: 2,
    },
    style: {
      solid: 'solid',
      dashed: 'dashed',
    },
    color: {
      default: colors.border.default,
      light: colors.border.light,
      divider: colors.border.divider,
      input: colors.border.input,
      focus: colors.border.focus,
      error: colors.border.error,
      disabled: colors.border.disabled,
    },
    radius: {
      default: 12,
      input: 12,
      card: 16,
    },
  }) as const;

export const borders = createBorders();

export type Borders = ReturnType<typeof createBorders>;
export type BorderToken = keyof Borders;
