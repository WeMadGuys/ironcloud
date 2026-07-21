import type { ColorTheme } from './colors';
import { lightColors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'
  | 'pendingPickup'
  | 'pickedUp'
  | 'ironing'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled';

export type BadgeVariantTokens = {
  readonly background: string;
  readonly text: string;
  readonly border: string;
};

export type BadgeTokens = {
  readonly variants: Record<BadgeVariant, BadgeVariantTokens>;
  readonly size: {
    readonly sm: {
      readonly paddingHorizontal: number;
      readonly paddingVertical: number;
      readonly radius: number;
      readonly fontSize: number;
    };
    readonly md: {
      readonly paddingHorizontal: number;
      readonly paddingVertical: number;
      readonly radius: number;
      readonly fontSize: number;
    };
  };
  readonly dot: {
    readonly size: number;
    readonly radius: number;
  };
};

export const createBadgeTokens = (colors: ColorTheme = lightColors): BadgeTokens => ({
  variants: {
    default: {
      background: colors.surface.section,
      text: colors.text.secondary,
      border: colors.border.light,
    },
    success: {
      background: colors.status.success.background,
      text: colors.status.success.text,
      border: colors.transparent,
    },
    warning: {
      background: colors.status.warning.background,
      text: colors.status.warning.text,
      border: colors.transparent,
    },
    error: {
      background: colors.status.error.background,
      text: colors.status.error.text,
      border: colors.transparent,
    },
    info: {
      background: colors.status.info.background,
      text: colors.status.info.text,
      border: colors.transparent,
    },
    purple: {
      background: colors.status.purple.background,
      text: colors.status.purple.foreground,
      border: colors.transparent,
    },
    pendingPickup: {
      background: colors.orderStatus.pendingPickup.background,
      text: colors.orderStatus.pendingPickup.foreground,
      border: colors.transparent,
    },
    pickedUp: {
      background: colors.orderStatus.pickedUp.background,
      text: colors.orderStatus.pickedUp.foreground,
      border: colors.transparent,
    },
    ironing: {
      background: colors.orderStatus.ironing.background,
      text: colors.orderStatus.ironing.foreground,
      border: colors.transparent,
    },
    outForDelivery: {
      background: colors.orderStatus.outForDelivery.background,
      text: colors.orderStatus.outForDelivery.foreground,
      border: colors.transparent,
    },
    delivered: {
      background: colors.orderStatus.delivered.background,
      text: colors.orderStatus.delivered.foreground,
      border: colors.transparent,
    },
    cancelled: {
      background: colors.orderStatus.cancelled.background,
      text: colors.orderStatus.cancelled.foreground,
      border: colors.transparent,
    },
  },
  size: {
    sm: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      radius: radius.pill,
      fontSize: 13,
    },
    md: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      radius: radius.pill,
      fontSize: 14,
    },
  },
  dot: {
    size: 8,
    radius: radius.full,
  },
});

export const badges = createBadgeTokens();

export type Badges = typeof badges;
