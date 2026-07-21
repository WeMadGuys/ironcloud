/**
 * Shared primitive types for the Iron Cloud design system.
 * Platform-agnostic — safe for React Native, Next.js, and web.
 */

export type FontWeightToken = '400' | '500' | '600' | '700' | '800';

export type TypographyStyle = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly fontWeight: FontWeightToken;
};

export type NativeShadowStyle = {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
};

export type ShadowDefinition = {
  readonly native: NativeShadowStyle;
  readonly web: string;
};

export type InteractiveState<T> = {
  readonly default: T;
  readonly pressed: T;
  readonly disabled: T;
  readonly loading: T;
};

export type ColorScheme = 'light' | 'dark';

export type SpringConfig = {
  readonly damping: number;
  readonly stiffness: number;
  readonly mass: number;
};
