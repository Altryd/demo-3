import React from "react";
import { Paper, Typography, Box, useTheme } from "@mui/material";

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, unit }) => {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",

        backgroundColor: "rgba(45, 45, 45, 0.6)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: `0 0 20px rgba(0,0,0,0.2), 0 0 10px ${theme.palette.primary.dark} inset`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          color: theme.palette.text.secondary,
        }}
      >
        {icon}
        <Typography variant="body2" sx={{ ml: 1 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", mt: 2 }}>
        <Typography
          variant="h3"
          component="span"
          sx={{
            fontWeight: "bold",
            color: theme.palette.primary.main,
            lineHeight: 1,
          }}
        >
          {value}
        </Typography>
        {unit && (
          <Typography
            variant="h6"
            component="span"
            sx={{ ml: 1, color: theme.palette.text.secondary }}
          >
            {unit}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default StatCard;
