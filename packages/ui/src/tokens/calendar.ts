import type { ColorTheme } from './colors';
import { lightColors } from './colors';
import { radius } from './radius';
import { spacing } from './spacing';

export type CalendarTokens = {
  readonly day: {
    readonly size: number;
    readonly radius: number;
    readonly gap: number;
  };
  readonly colors: {
    readonly default: {
      readonly background: string;
      readonly text: string;
    };
    readonly today: {
      readonly background: string;
      readonly text: string;
      readonly border: string;
    };
    readonly selected: {
      readonly background: string;
      readonly text: string;
    };
    readonly disabled: {
      readonly background: string;
      readonly text: string;
    };
    readonly weekend: {
      readonly text: string;
    };
    readonly outsideMonth: {
      readonly text: string;
    };
  };
  readonly header: {
    readonly text: string;
    readonly icon: string;
    readonly paddingVertical: number;
  };
  readonly weekday: {
    readonly text: string;
    readonly paddingVertical: number;
  };
};

export const createCalendarTokens = (
  colors: ColorTheme = lightColors,
): CalendarTokens => ({
  day: {
    size: 40,
    radius: radius.full,
    gap: spacing.xs,
  },
  colors: {
    default: {
      background: colors.transparent,
      text: colors.calendar.dayText,
    },
    today: {
      background: colors.calendar.todayBackground,
      text: colors.calendar.today,
      border: colors.calendar.today,
    },
    selected: {
      background: colors.calendar.selected,
      text: colors.calendar.selectedText,
    },
    disabled: {
      background: colors.transparent,
      text: colors.text.disabled,
    },
    weekend: {
      text: colors.calendar.weekendText,
    },
    outsideMonth: {
      text: colors.calendar.dayTextMuted,
    },
  },
  header: {
    text: colors.text.heading,
    icon: colors.icon.primary,
    paddingVertical: spacing.md,
  },
  weekday: {
    text: colors.text.muted,
    paddingVertical: spacing.sm,
  },
});

export const calendar = createCalendarTokens();

export type Calendar = typeof calendar;
