import type { SpringConfig } from './types';

export const animations = {
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
  transition: {
    fast: '150ms ease',
    base: '250ms ease',
    slow: '400ms ease',
  },
  spring: {
    gentle: {
      damping: 22,
      stiffness: 280,
      mass: 1,
    } satisfies SpringConfig,
    default: {
      damping: 20,
      stiffness: 300,
      mass: 1,
    } satisfies SpringConfig,
    snappy: {
      damping: 18,
      stiffness: 360,
      mass: 0.9,
    } satisfies SpringConfig,
  },
} as const;

export type Animations = typeof animations;
export type AnimationToken = keyof Animations;
