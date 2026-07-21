import type { FontWeightToken, TypographyStyle } from './types';

const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const satisfies Record<string, FontWeightToken>;

const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15.5,
  lg: 16,
  xl: 22,
  '2xl': 24,
  '3xl': 29,
  '4xl': 28,
} as const;

const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  loose: 1.6,
} as const;

const letterSpacing = {
  wide: 2.5,
  normal: 0,
} as const;

export const fontFamily = {
  display: 'Poppins',
  body: 'Inter',
  displayWeb: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
  bodyWeb: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  native: {
    poppins: {
      regular: 'Poppins-Regular',
      medium: 'Poppins-Medium',
      semibold: 'Poppins-SemiBold',
      bold: 'Poppins-Bold',
      extrabold: 'Poppins-ExtraBold',
    },
    inter: {
      regular: 'Inter-Regular',
      medium: 'Inter-Medium',
      semibold: 'Inter-SemiBold',
      bold: 'Inter-Bold',
    },
  },
} as const;

const createDisplayStyle = (
  size: keyof typeof fontSize,
  weight: FontWeightToken,
  tracking: number = letterSpacing.normal,
): TypographyStyle => ({
  fontFamily: fontFamily.display,
  fontSize: fontSize[size],
  lineHeight: fontSize[size] * lineHeight.tight,
  letterSpacing: tracking,
  fontWeight: weight,
});

const createBodyStyle = (
  size: keyof typeof fontSize,
  weight: FontWeightToken,
  leading: keyof typeof lineHeight = 'normal',
): TypographyStyle => ({
  fontFamily: fontFamily.body,
  fontSize: fontSize[size],
  lineHeight: fontSize[size] * lineHeight[leading],
  letterSpacing: letterSpacing.normal,
  fontWeight: weight,
});

export const typography = {
  display: createDisplayStyle('3xl', fontWeight.bold),
  headline: createDisplayStyle('2xl', fontWeight.bold),
  title: createDisplayStyle('xl', fontWeight.bold, letterSpacing.wide),
  subtitle: createBodyStyle('md', fontWeight.regular),
  body: createBodyStyle('base', fontWeight.regular),
  bodySmall: createBodyStyle('sm', fontWeight.regular),
  caption: createBodyStyle('xs', fontWeight.regular),
  button: createDisplayStyle('lg', fontWeight.semibold),
  label: createBodyStyle('base', fontWeight.medium),
  tiny: createBodyStyle('xs', fontWeight.medium),
  stat: createDisplayStyle('4xl', fontWeight.bold),
} as const;

export const typographyScale = {
  fontFamily,
  fontWeight,
  fontSize,
  lineHeight,
  letterSpacing,
} as const;

export type Typography = typeof typography;
export type TypographyToken = keyof Typography;
