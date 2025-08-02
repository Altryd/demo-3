import React from "react";
import { Box, Typography } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";

const Welcome: React.FC = () => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      textAlign="center"
      p={3}
      position="relative"
    >
      {}
      <ChatIcon sx={{ fontSize: 60, color: "primary.main", mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        Добро пожаловать!
      </Typography>
      <Typography variant="subtitle1" color="text.secondary">
        Выберите чат или начните новый, чтобы начать общение.
      </Typography>
    </Box>
  );
};

export default Welcome;
