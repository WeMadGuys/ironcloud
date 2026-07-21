import type { ShadowDefinition } from './types';

const SHADOW_TINT = 'rgb(11, 37, 69)';

const createShadow = (
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ShadowDefinition => ({
  native: {
    shadowColor: SHADOW_TINT,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation,
  },
  web: `0 ${offsetY}px ${blur}px rgba(11, 37, 69, ${opacity})`,
});

export const shadows = {
  none: {
    native: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    web: 'none',
  },
  sm: createShadow(2, 8, 0.06, 2),
  md: createShadow(8, 20, 0.12, 4),
  lg: createShadow(20, 48, 0.18, 8),
  button: createShadow(8, 20, 0.25, 4),
} as const;

export const createShadows = () => shadows;

export type Shadows = typeof shadows;
export type ShadowToken = keyof Shadows;
