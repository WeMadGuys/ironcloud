/**
 * Iron Cloud — Semantic Color Tokens
 * Single source of truth across web, admin, and app builds.
 */

const palette = {
  brand: {
    navy900: '#0B1E3F',
    navy800: '#0E2A4A',
    navy700: '#14294D',
    navy600: '#1B335C',
    navy500: '#33455E',
    blueAccent: '#5B9BD5',
    blueMid: '#3B6FD9',
    blueLight: '#BBD3EC',
    bluePale: '#E4EEF9',
  },
  neutral: {
    gray900: '#151B2E',
    gray700: '#2B3245',
    gray500: '#7A8699',
    gray400: '#8A94A6',
    gray300: '#9AA5B1',
    gray200: '#E3ECF6',
    gray100: '#F4F8FC',
    gray50: '#F7F9FC',
    white: '#FFFFFF',
  },
  status: {
    success: '#16A34A',
    successBg: '#DCFCE7',
    successText: '#15803D',
    warning: '#F97316',
    warningBg: '#FEF3C7',
    warningText: '#C2740A',
    info: '#2563EB',
    infoBg: '#DBEAFE',
    infoText: '#0284C7',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    dangerText: '#B91C1C',
    purple: '#7C3AED',
    purpleBg: '#EDE9FE',
    rating: '#D97706',
  },
  chart: {
    c1: '#6366F1',
    c2: '#8B5CF6',
    c3: '#F97316',
    c4: '#3B82F6',
    c5: '#14B8A6',
    c6: '#84CC16',
    fill: '#E4E7FB',
  },
  overlay: {
    scrim: 'rgba(11, 37, 69, 0.48)',
    scrimLight: 'rgba(11, 37, 69, 0.24)',
  },
  transparent: 'transparent',
} as const;

const darkPalette = {
  brand: {
    navy900: '#E4EEF9',
    navy800: '#BBD3EC',
    navy700: '#5B9BD5',
    navy600: '#3B6FD9',
    navy500: '#7A8699',
    blueAccent: '#5B9BD5',
    blueMid: '#3B6FD9',
    blueLight: '#1B335C',
    bluePale: '#14294D',
  },
  neutral: {
    gray900: '#F7F9FC',
    gray700: '#E3ECF6',
    gray500: '#9AA5B1',
    gray400: '#8A94A6',
    gray300: '#7A8699',
    gray200: '#2B3245',
    gray100: '#151B2E',
    gray50: '#0B1E3F',
    white: '#0E2A4A',
  },
  status: {
    success: '#22C55E',
    successBg: '#0F2A1A',
    successText: '#22C55E',
    warning: '#FB923C',
    warningBg: '#2A2008',
    warningText: '#FB923C',
    info: '#60A5FA',
    infoBg: '#0F1F3D',
    infoText: '#60A5FA',
    danger: '#EF4444',
    dangerBg: '#2A1212',
    dangerText: '#EF4444',
    purple: '#A78BFA',
    purpleBg: '#1E1533',
    rating: '#FBBF24',
  },
  chart: {
    c1: '#818CF8',
    c2: '#A78BFA',
    c3: '#FB923C',
    c4: '#60A5FA',
    c5: '#2DD4BF',
    c6: '#A3E635',
    fill: '#1E1B4B',
  },
  overlay: {
    scrim: 'rgba(0, 0, 0, 0.64)',
    scrimLight: 'rgba(0, 0, 0, 0.40)',
  },
  transparent: 'transparent',
} as const;

interface PaletteShape {
  brand: {
    navy900: string;
    navy800: string;
    navy700: string;
    navy600: string;
    navy500: string;
    blueAccent: string;
    blueMid: string;
    blueLight: string;
    bluePale: string;
  };
  neutral: {
    gray900: string;
    gray700: string;
    gray500: string;
    gray400: string;
    gray300: string;
    gray200: string;
    gray100: string;
    gray50: string;
    white: string;
  };
  status: {
    success: string;
    successBg: string;
    successText: string;
    warning: string;
    warningBg: string;
    warningText: string;
    info: string;
    infoBg: string;
    infoText: string;
    danger: string;
    dangerBg: string;
    dangerText: string;
    purple: string;
    purpleBg: string;
    rating: string;
  };
  chart: {
    c1: string;
    c2: string;
    c3: string;
    c4: string;
    c5: string;
    c6: string;
    fill: string;
  };
  overlay: {
    scrim: string;
    scrimLight: string;
  };
  transparent: string;
}

const createSemanticColors = (p: PaletteShape) =>
  ({
    brand: {
      primary: p.brand.navy800,
      primaryPressed: '#0A2039',
      accent: p.brand.blueAccent,
      accentPressed: p.brand.blueMid,
      accentSoft: p.brand.blueLight,
      accentMuted: p.brand.bluePale,
      link: p.brand.blueMid,
      onPrimary: p.neutral.white,
      onAccent: p.neutral.white,
    },
    surface: {
      background: p.neutral.gray50,
      section: p.neutral.gray100,
      elevated: p.neutral.white,
      card: p.neutral.white,
      input: p.neutral.white,
      disabled: p.neutral.gray100,
      overlay: p.overlay.scrim,
      overlayLight: p.overlay.scrimLight,
    },
    text: {
      heading: p.brand.navy700,
      primary: p.brand.navy500,
      secondary: p.neutral.gray500,
      muted: p.neutral.gray400,
      placeholder: p.neutral.gray300,
      disabled: p.neutral.gray300,
      inverse: p.neutral.white,
      link: p.brand.blueMid,
      linkPressed: p.brand.blueAccent,
    },
    border: {
      default: p.neutral.gray200,
      light: p.neutral.gray200,
      divider: p.neutral.gray200,
      input: p.brand.blueLight,
      focus: p.brand.blueAccent,
      error: p.status.danger,
      disabled: p.neutral.gray200,
    },
    status: {
      success: {
        foreground: p.status.success,
        background: p.status.successBg,
        text: p.status.successText,
      },
      warning: {
        foreground: p.status.warning,
        background: p.status.warningBg,
        text: p.status.warningText,
      },
      error: {
        foreground: p.status.danger,
        background: p.status.dangerBg,
        text: p.status.dangerText,
      },
      info: {
        foreground: p.status.info,
        background: p.status.infoBg,
        text: p.status.infoText,
      },
      purple: {
        foreground: p.status.purple,
        background: p.status.purpleBg,
      },
      rating: p.status.rating,
    },
    orderStatus: {
      pendingPickup: {
        foreground: p.status.info,
        background: p.status.infoBg,
      },
      pickedUp: {
        foreground: p.status.info,
        background: p.status.infoBg,
      },
      ironing: {
        foreground: p.status.warning,
        background: p.status.warningBg,
      },
      outForDelivery: {
        foreground: p.status.purple,
        background: p.status.purpleBg,
      },
      delivered: {
        foreground: p.status.success,
        background: p.status.successBg,
      },
      cancelled: {
        foreground: p.status.danger,
        background: p.status.dangerBg,
      },
    },
    chart: {
      primary: p.chart.c1,
      secondary: p.chart.c2,
      tertiary: p.chart.c3,
      quaternary: p.chart.c4,
      quinary: p.chart.c5,
      senary: p.chart.c6,
      fill: p.chart.fill,
      palette: [p.chart.c1, p.chart.c2, p.chart.c3, p.chart.c4, p.chart.c5, p.chart.c6],
    },
    sidebar: {
      background: p.brand.navy900,
      backgroundDark: '#081528',
      itemActive: p.brand.blueAccent,
      itemActiveBackground: p.brand.navy600,
      itemHover: 'rgba(255, 255, 255, 0.08)',
      text: p.neutral.white,
      textMuted: p.neutral.gray400,
      border: p.brand.navy600,
    },
    calendar: {
      today: p.brand.blueAccent,
      todayBackground: p.brand.bluePale,
      selected: p.brand.navy800,
      selectedText: p.neutral.white,
      dayText: p.brand.navy500,
      dayTextMuted: p.neutral.gray400,
      weekendText: p.neutral.gray500,
    },
    avatar: {
      background: p.brand.bluePale,
      border: p.neutral.gray200,
      placeholder: p.neutral.gray400,
      online: p.status.success,
      offline: p.neutral.gray400,
    },
    trend: {
      positive: {
        foreground: p.status.success,
        background: p.status.successBg,
      },
      negative: {
        foreground: p.status.danger,
        background: p.status.dangerBg,
      },
      neutral: {
        foreground: p.neutral.gray500,
        background: p.neutral.gray100,
      },
    },
    slot: {
      morning: {
        foreground: p.brand.blueMid,
        background: p.brand.bluePale,
      },
      afternoon: {
        foreground: p.status.warning,
        background: p.status.warningBg,
      },
      evening: {
        foreground: p.status.purple,
        background: p.status.purpleBg,
      },
    },
    wallet: {
      foreground: p.brand.blueMid,
      background: p.status.infoBg,
    },
    icon: {
      primary: p.brand.navy800,
      secondary: p.neutral.gray500,
      muted: p.neutral.gray400,
      inactive: p.neutral.gray300,
      inverse: p.neutral.white,
    },
    interactive: {
      focusRing: p.brand.blueAccent,
      selection: p.brand.bluePale,
      cursor: p.brand.blueMid,
    },
    transparent: p.transparent,
  }) as const;

export const lightColors = createSemanticColors(palette);
export const darkColors = createSemanticColors(darkPalette);

export const colors = lightColors;

export type ColorTheme = typeof lightColors;
export type ColorToken = ColorTheme;
