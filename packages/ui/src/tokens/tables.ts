import type { ColorTheme } from './colors';
import { lightColors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';

export type TableTokens = {
  readonly container: {
    readonly background: string;
    readonly border: string;
    readonly radius: number;
  };
  readonly header: {
    readonly background: string;
    readonly text: string;
    readonly border: string;
    readonly paddingVertical: number;
    readonly paddingHorizontal: number;
  };
  readonly row: {
    readonly background: string;
    readonly backgroundAlt: string;
    readonly backgroundHover: string;
    readonly backgroundSelected: string;
    readonly border: string;
    readonly paddingVertical: number;
    readonly paddingHorizontal: number;
  };
  readonly cell: {
    readonly text: string;
    readonly textMuted: string;
    readonly link: string;
  };
};

export const createTableTokens = (colors: ColorTheme = lightColors): TableTokens => ({
  container: {
    background: colors.surface.card,
    border: colors.border.light,
    radius: radius.card,
  },
  header: {
    background: colors.surface.section,
    text: colors.text.secondary,
    border: colors.border.divider,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  row: {
    background: colors.surface.card,
    backgroundAlt: colors.surface.section,
    backgroundHover: colors.brand.accentMuted,
    backgroundSelected: colors.brand.accentMuted,
    border: colors.border.divider,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cell: {
    text: colors.text.primary,
    textMuted: colors.text.secondary,
    link: colors.text.link,
  },
});

export const tables = createTableTokens();

export type Tables = typeof tables;
