import { animations } from './animations';
import { avatars, createAvatarTokens } from './avatars';
import { badges, createBadgeTokens } from './badges';
import { borders, createBorders } from './borders';
import { buttons, createButtonTokens } from './buttons';
import { calendar, createCalendarTokens } from './calendar';
import { cards, createCardTokens } from './cards';
import {
  colors,
  darkColors,
  lightColors,
  type ColorTheme,
} from './colors';
import { createIconTokens, icons } from './icons';
import { createInputTokens, inputs } from './inputs';
import { createNavigationTokens, navigation } from './navigation';
import { radius } from './radius';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { createTableTokens, tables } from './tables';
import { fontFamily, typography, typographyScale } from './typography';
import type { ColorScheme } from './types';

export { animations } from './animations';
export type { Animations, AnimationToken } from './animations';

export { avatars, createAvatarTokens } from './avatars';
export type { Avatars, AvatarTokens } from './avatars';

export { badges, createBadgeTokens } from './badges';
export type { Badges, BadgeTokens, BadgeVariant, BadgeVariantTokens } from './badges';

export { borders, createBorders } from './borders';
export type { Borders, BorderToken } from './borders';

export { buttons, createButtonTokens } from './buttons';
export type { ButtonTokens, ButtonVariantTokens } from './buttons';

export { calendar, createCalendarTokens } from './calendar';
export type { Calendar, CalendarTokens } from './calendar';

export { cards, createCardTokens } from './cards';
export type { CardTokens, CardVariantTokens } from './cards';

export {
  colors,
  darkColors,
  lightColors,
  type ColorTheme,
  type ColorToken,
} from './colors';

export { icons, createIconTokens } from './icons';
export type { Icons, IconTokens } from './icons';

export { inputs, createInputTokens } from './inputs';
export type { InputTokens, InputStateTokens } from './inputs';

export { navigation, createNavigationTokens } from './navigation';
export type { Navigation, NavigationTokens } from './navigation';

export { radius } from './radius';
export type { Radius, RadiusToken } from './radius';

export { shadows } from './shadows';
export type { Shadows, ShadowToken } from './shadows';

export { spacing } from './spacing';
export type { Spacing, SpacingToken } from './spacing';

export { tables, createTableTokens } from './tables';
export type { Tables, TableTokens } from './tables';

export { fontFamily, typography, typographyScale } from './typography';
export type { Typography, TypographyToken } from './typography';

export type {
  ColorScheme,
  FontWeightToken,
  InteractiveState,
  NativeShadowStyle,
  ShadowDefinition,
  SpringConfig,
  TypographyStyle,
} from './types';

export type Theme = {
  readonly colors: ColorTheme;
  readonly typography: typeof typography;
  readonly typographyScale: typeof typographyScale;
  readonly fontFamily: typeof fontFamily;
  readonly spacing: typeof spacing;
  readonly radius: typeof radius;
  readonly shadows: typeof shadows;
  readonly borders: ReturnType<typeof createBorders>;
  readonly buttons: ReturnType<typeof createButtonTokens>;
  readonly inputs: ReturnType<typeof createInputTokens>;
  readonly cards: ReturnType<typeof createCardTokens>;
  readonly navigation: ReturnType<typeof createNavigationTokens>;
  readonly icons: ReturnType<typeof createIconTokens>;
  readonly avatars: ReturnType<typeof createAvatarTokens>;
  readonly badges: ReturnType<typeof createBadgeTokens>;
  readonly calendar: ReturnType<typeof createCalendarTokens>;
  readonly tables: ReturnType<typeof createTableTokens>;
  readonly animations: typeof animations;
};

export const createTheme = (scheme: ColorScheme = 'light'): Theme => {
  const themeColors = scheme === 'dark' ? darkColors : lightColors;

  return {
    colors: themeColors,
    typography,
    typographyScale,
    fontFamily,
    spacing,
    radius,
    shadows,
    borders: createBorders(themeColors),
    buttons: createButtonTokens(themeColors),
    inputs: createInputTokens(themeColors),
    cards: createCardTokens(themeColors),
    navigation: createNavigationTokens(themeColors),
    icons: createIconTokens(themeColors),
    avatars: createAvatarTokens(themeColors),
    badges: createBadgeTokens(themeColors),
    calendar: createCalendarTokens(themeColors),
    tables: createTableTokens(themeColors),
    animations,
  };
};

export const lightTheme = createTheme('light');
export const darkTheme = createTheme('dark');
export const theme = lightTheme;
