import type { ColorTheme } from './colors';
import { lightColors } from './colors';

export type InputStateTokens = {
  readonly background: string;
  readonly text: string;
  readonly border: string;
  readonly placeholder: string;
};

export type InputTokens = {
  readonly default: InputStateTokens;
  readonly focused: InputStateTokens;
  readonly filled: InputStateTokens;
  readonly error: InputStateTokens;
  readonly disabled: InputStateTokens;
  readonly placeholder: {
    readonly color: string;
  };
  readonly cursor: {
    readonly color: string;
  };
  readonly selection: {
    readonly background: string;
    readonly text: string;
  };
};

export const createInputTokens = (colors: ColorTheme = lightColors): InputTokens => ({
  default: {
    background: colors.surface.input,
    text: colors.text.heading,
    border: colors.border.input,
    placeholder: colors.text.placeholder,
  },
  focused: {
    background: colors.surface.input,
    text: colors.text.heading,
    border: colors.border.focus,
    placeholder: colors.text.placeholder,
  },
  filled: {
    background: colors.surface.input,
    text: colors.text.heading,
    border: colors.border.input,
    placeholder: colors.text.placeholder,
  },
  error: {
    background: colors.status.error.background,
    text: colors.text.heading,
    border: colors.border.error,
    placeholder: colors.text.placeholder,
  },
  disabled: {
    background: colors.surface.disabled,
    text: colors.text.disabled,
    border: colors.border.disabled,
    placeholder: colors.text.disabled,
  },
  placeholder: {
    color: colors.text.placeholder,
  },
  cursor: {
    color: colors.interactive.cursor,
  },
  selection: {
    background: colors.interactive.selection,
    text: colors.text.primary,
  },
});

export const inputs = createInputTokens();
