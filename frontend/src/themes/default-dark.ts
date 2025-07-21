import { createTheme } from "@mui/material/styles";

export const defaultDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7e57c2",
      dark: "#5e35b1",
    },
    background: {
      default: "#1e1e1e",
      paper: "#272727ff",
    },
    text: {
      primary: "#ffffffd7",
      secondary: "#9b9dbeff",
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
          "&::-webkit-scrollbar-track": { backgroundColor: "#2d2d2d" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#7e57c2",
            borderRadius: "4px",
            border: "2px solid #2d2d2d",
          },
          "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#5e35b1" },
        },
      },
    },
  },
});
