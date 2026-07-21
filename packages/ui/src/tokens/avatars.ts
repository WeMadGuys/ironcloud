import type { ColorTheme } from './colors';
import { lightColors } from './colors';
import { radius } from './radius';

export type AvatarTokens = {
  readonly size: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
  };
  readonly radius: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
    readonly full: number;
  };
  readonly colors: {
    readonly background: string;
    readonly border: string;
    readonly placeholder: string;
    readonly text: string;
  };
  readonly status: {
    readonly online: string;
    readonly offline: string;
    readonly busy: string;
    readonly away: string;
    readonly size: number;
    readonly border: string;
  };
  readonly badge: {
    readonly background: string;
    readonly text: string;
    readonly border: string;
    readonly minSize: number;
  };
};

export const createAvatarTokens = (colors: ColorTheme = lightColors): AvatarTokens => ({
  size: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  },
  radius: {
    xs: radius.sm,
    sm: radius.md,
    md: radius.lg,
    lg: radius.xl,
    xl: radius.xl,
    full: radius.full,
  },
  colors: {
    background: colors.avatar.background,
    border: colors.avatar.border,
    placeholder: colors.avatar.placeholder,
    text: colors.brand.primary,
  },
  status: {
    online: colors.avatar.online,
    offline: colors.avatar.offline,
    busy: colors.status.error.foreground,
    away: colors.status.warning.foreground,
    size: 12,
    border: colors.surface.elevated,
  },
  badge: {
    background: colors.status.error.foreground,
    text: colors.text.inverse,
    border: colors.surface.elevated,
    minSize: 18,
  },
});

export const avatars = createAvatarTokens();

export type Avatars = typeof avatars;
