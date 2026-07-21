import type { ColorTheme } from './colors';
import { lightColors } from './colors';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';

export type CardVariantTokens = {
  readonly background: string;
  readonly radius: number;
  readonly border: string;
  readonly shadow: (typeof shadows)[keyof typeof shadows];
  readonly padding: number;
};

export type CardTokens = {
  readonly booking: CardVariantTokens;
  readonly wallet: CardVariantTokens;
  readonly information: CardVariantTokens;
  readonly stat: CardVariantTokens;
  readonly order: CardVariantTokens;
  readonly settings: CardVariantTokens;
};

export const createCardTokens = (colors: ColorTheme = lightColors): CardTokens => ({
  booking: {
    background: colors.surface.card,
    radius: radius.card,
    border: colors.border.light,
    shadow: shadows.sm,
    padding: spacing.cardPadding,
  },
  wallet: {
    background: colors.wallet.background,
    radius: radius.card,
    border: colors.transparent,
    shadow: shadows.sm,
    padding: spacing.cardPadding,
  },
  information: {
    background: colors.surface.section,
    radius: radius.card,
    border: colors.border.divider,
    shadow: shadows.none,
    padding: spacing.cardPadding,
  },
  stat: {
    background: colors.surface.elevated,
    radius: radius.card,
    border: colors.border.light,
    shadow: shadows.sm,
    padding: spacing.cardPadding,
  },
  order: {
    background: colors.surface.card,
    radius: radius.card,
    border: colors.border.default,
    shadow: shadows.sm,
    padding: spacing.cardPadding,
  },
  settings: {
    background: colors.surface.elevated,
    radius: radius.card,
    border: colors.border.divider,
    shadow: shadows.none,
    padding: spacing.lg,
  },
});

export const cards = createCardTokens();
