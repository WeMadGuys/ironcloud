import type { ColorTheme } from './colors';
import { lightColors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';

export type NavigationTokens = {
  readonly bottomNavigation: {
    readonly background: string;
    readonly border: string;
    readonly height: number;
    readonly paddingTop: number;
    readonly paddingBottom: number;
    readonly icon: {
      readonly active: string;
      readonly inactive: string;
    };
    readonly label: {
      readonly active: string;
      readonly inactive: string;
    };
  };
  readonly topNavigation: {
    readonly background: string;
    readonly border: string;
    readonly height: number;
    readonly title: string;
    readonly subtitle: string;
    readonly icon: string;
  };
  readonly appBar: {
    readonly background: string;
    readonly border: string;
    readonly height: number;
    readonly title: string;
    readonly icon: string;
    readonly action: string;
  };
  readonly sidebar: {
    readonly width: number;
    readonly widthCollapsed: number;
    readonly background: string;
    readonly backgroundDark: string;
    readonly border: string;
    readonly logo: {
      readonly text: string;
      readonly accent: string;
    };
    readonly item: {
      readonly height: number;
      readonly paddingHorizontal: number;
      readonly radius: number;
      readonly gap: number;
      readonly icon: string;
      readonly iconActive: string;
      readonly text: string;
      readonly textActive: string;
      readonly background: string;
      readonly backgroundActive: string;
      readonly backgroundHover: string;
    };
    readonly section: {
      readonly title: string;
      readonly divider: string;
    };
    readonly user: {
      readonly background: string;
      readonly text: string;
      readonly textMuted: string;
    };
  };
  readonly statusBar: {
    readonly background: string;
    readonly content: 'dark-content' | 'light-content';
  };
  readonly tab: {
    readonly indicator: string;
    readonly indicatorHeight: number;
    readonly labelActive: string;
    readonly labelInactive: string;
  };
  readonly badge: {
    readonly background: string;
    readonly text: string;
    readonly border: string;
    readonly radius: number;
    readonly minSize: number;
  };
};

export const createNavigationTokens = (
  colors: ColorTheme = lightColors,
): NavigationTokens => ({
  bottomNavigation: {
    background: colors.surface.elevated,
    border: colors.border.divider,
    height: 64,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    icon: {
      active: colors.brand.accent,
      inactive: colors.icon.inactive,
    },
    label: {
      active: colors.brand.primary,
      inactive: colors.text.muted,
    },
  },
  topNavigation: {
    background: colors.surface.background,
    border: colors.border.divider,
    height: 56,
    title: colors.text.heading,
    subtitle: colors.text.secondary,
    icon: colors.icon.primary,
  },
  appBar: {
    background: colors.surface.background,
    border: colors.transparent,
    height: 56,
    title: colors.text.heading,
    icon: colors.icon.primary,
    action: colors.brand.accent,
  },
  sidebar: {
    width: 260,
    widthCollapsed: 72,
    background: colors.sidebar.background,
    backgroundDark: colors.sidebar.backgroundDark,
    border: colors.sidebar.border,
    logo: {
      text: colors.sidebar.text,
      accent: colors.brand.accent,
    },
    item: {
      height: 44,
      paddingHorizontal: spacing.md,
      radius: radius.sm,
      gap: spacing.md,
      icon: colors.sidebar.textMuted,
      iconActive: colors.sidebar.itemActive,
      text: colors.sidebar.textMuted,
      textActive: colors.sidebar.text,
      background: colors.transparent,
      backgroundActive: colors.sidebar.itemActiveBackground,
      backgroundHover: colors.sidebar.itemHover,
    },
    section: {
      title: colors.sidebar.textMuted,
      divider: colors.sidebar.border,
    },
    user: {
      background: colors.sidebar.itemHover,
      text: colors.sidebar.text,
      textMuted: colors.sidebar.textMuted,
    },
  },
  statusBar: {
    background: colors.surface.background,
    content: 'dark-content',
  },
  tab: {
    indicator: colors.brand.accent,
    indicatorHeight: 2,
    labelActive: colors.brand.primary,
    labelInactive: colors.text.muted,
  },
  badge: {
    background: colors.status.error.foreground,
    text: colors.text.inverse,
    border: colors.surface.elevated,
    radius: radius.badge,
    minSize: 18,
  },
});

export const navigation = createNavigationTokens();

export type Navigation = typeof navigation;
