const scale = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
} as const;

export const spacing = {
  none: 0,
  ...scale,
  xs: scale['1'],
  sm: scale['2'],
  md: scale['3'],
  lg: scale['4'],
  xl: scale['6'],
  '2xl': scale['8'],
  '3xl': scale['10'],
  '4xl': scale['12'],
  screenHorizontal: scale['6'],
  screenVertical: scale['4'],
  section: scale['8'],
  cardPadding: scale['5'],
  inputPaddingHorizontal: scale['4'],
  inputPaddingVertical: scale['3'],
  buttonPaddingHorizontal: scale['5'],
  buttonPaddingVertical: scale['4'],
  listItemGap: scale['3'],
  iconGap: scale['2'],
} as const;

export type Spacing = typeof spacing;
export type SpacingToken = keyof Spacing;
