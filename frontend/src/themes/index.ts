import { defaultDarkTheme } from "./default-dark";
import { lightTheme } from "./light";
import { lutoTheme } from "./luto";

export const themes = {
  "default-dark": defaultDarkTheme,
  light: lightTheme,
  luto: lutoTheme,
};

export type ThemeName = keyof typeof themes;
