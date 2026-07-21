const scale = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  none: 0,
  ...scale,
  full: 999,
  pill: scale.sm,
  button: scale.md,
  input: scale.md,
  card: scale.lg,
  modal: scale.xl,
  bottomSheet: scale.xl,
  badge: scale.sm,
  avatar: scale.lg,
} as const;

export type Radius = typeof radius;
export type RadiusToken = keyof Radius;
