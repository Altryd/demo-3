import React from "react";
import { GlobalStyles, useTheme } from "@mui/material";

const GlobalScrollbar: React.FC = () => {
  const theme = useTheme();

  const scrollbarStyles = {
    "*": {
      scrollbarWidth: "thin",
      scrollbarColor: `${theme.palette.primary.dark} ${theme.palette.background.paper}`,
    },
    "*::-webkit-scrollbar": {
      width: "8px",
    },
    "*::-webkit-scrollbar-track": {
      backgroundColor: theme.palette.background.paper,
    },
    "*::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.primary.main,
      borderRadius: "4px",
      border: `2px solid ${theme.palette.background.paper}`,
    },
    "*::-webkit-scrollbar-thumb:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  };

  return <GlobalStyles styles={scrollbarStyles} />;
};

export default GlobalScrollbar;
