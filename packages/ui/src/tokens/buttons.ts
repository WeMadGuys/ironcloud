import type { ColorTheme } from './colors';
import { lightColors } from './colors';

export type ButtonVariantTokens = {
  readonly background: string;
  readonly text: string;
  readonly border: string;
  readonly pressed: {
    readonly background: string;
    readonly text: string;
    readonly border: string;
  };
  readonly disabled: {
    readonly background: string;
    readonly text: string;
    readonly border: string;
  };
};

export type ButtonTokens = {
  readonly primary: ButtonVariantTokens;
  readonly secondary: ButtonVariantTokens;
  readonly ghost: ButtonVariantTokens;
  readonly outline: ButtonVariantTokens;
  readonly danger: ButtonVariantTokens;
};

export const createButtonTokens = (colors: ColorTheme = lightColors): ButtonTokens => ({
  primary: {
    background: colors.brand.primary,
    text: colors.brand.onPrimary,
    border: colors.transparent,
    pressed: {
      background: colors.brand.primaryPressed,
      text: colors.brand.onPrimary,
      border: colors.transparent,
    },
    disabled: {
      background: colors.surface.disabled,
      text: colors.text.disabled,
      border: colors.transparent,
    },
  },
  secondary: {
    background: colors.surface.elevated,
    text: colors.brand.primary,
    border: colors.border.default,
    pressed: {
      background: colors.surface.section,
      text: colors.brand.primary,
      border: colors.border.default,
    },
    disabled: {
      background: colors.surface.disabled,
      text: colors.text.disabled,
      border: colors.border.disabled,
    },
  },
  ghost: {
    background: colors.transparent,
    text: colors.brand.link,
    border: colors.transparent,
    pressed: {
      background: colors.brand.accentMuted,
      text: colors.brand.accentPressed,
      border: colors.transparent,
    },
    disabled: {
      background: colors.transparent,
      text: colors.text.disabled,
      border: colors.transparent,
    },
  },
  outline: {
    background: colors.transparent,
    text: colors.brand.primary,
    border: colors.border.default,
    pressed: {
      background: colors.brand.accentMuted,
      text: colors.brand.primaryPressed,
      border: colors.border.focus,
    },
    disabled: {
      background: colors.transparent,
      text: colors.text.disabled,
      border: colors.border.disabled,
    },
  },
  danger: {
    background: colors.status.error.foreground,
    text: colors.text.inverse,
    border: colors.transparent,
    pressed: {
      background: colors.status.error.text,
      text: colors.text.inverse,
      border: colors.transparent,
    },
    disabled: {
      background: colors.surface.disabled,
      text: colors.text.disabled,
      border: colors.transparent,
    },
  },
});

export const buttons = createButtonTokens();
