import { createTheme } from "@mui/material/styles";

export const lutoTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#FFB5CC",
      dark: "#862D3E",
    },
    background: {
      default: "#241E21",
      paper: "#3D1D29",
    },
    text: {
      primary: "#F5E9EC",
      secondary: "#A99DA1",
    },
  },
  typography: {
    fontFamily:
      '"Inter", "system-ui", "Avenir", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 300 },
    body1: { fontWeight: 400 },
    body2: { fontWeight: 400 },
    button: { fontWeight: 500 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          "&::-webkit-scrollbar": { width: "8px" },
          "&::-webkit-scrollbar-track": { backgroundColor: "#3D1D29" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#862D3E",
            borderRadius: "4px",
            border: "2px solid #3D1D29",
          },
          "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#6C273E" },
        },
      },
    },
  },
});
