import React from "react";
import { Box } from "@mui/material";
import { keyframes } from "@emotion/react";
import { alpha } from "@mui/material/styles";

const movePrimary = keyframes`
  0% { transform: translate(0%, 0%) scale(1); }
  33% { transform: translate(-5%, 7%) scale(1.1); }
  66% { transform: translate(4%, -6%) scale(0.95); }
  100% { transform: translate(0%, 0%) scale(1); }
`;

const moveSecondary = keyframes`
  0% { transform: translate(0%, 0%) scale(1); }
  33% { transform: translate(8%, -8%) scale(1.15); }
  66% { transform: translate(-7%, 5%) scale(0.9); }
  100% { transform: translate(0%, 0%) scale(1); }
`;

const AnimatedBackground: React.FC = () => {
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        overflow: "hidden",
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      {}
      <Box
        sx={(theme) => ({
          position: "absolute",
          top: "-40%",
          left: "-40%",
          width: "180%",
          height: "180%",
          background: `radial-gradient(
            circle at center,
            ${alpha(theme.palette.primary.main, 0.25)} 0%,
            transparent 60%
          )`,
          animation: `${movePrimary} 80s ease infinite`,
          filter: "blur(40px)",
          willChange: "transform",
          opacity: 0.8,
        })}
      />

      {}
      <Box
        sx={(theme) => ({
          position: "absolute",
          top: "-30%",
          left: "-30%",
          width: "160%",
          height: "160%",
          background: `radial-gradient(
            circle at 70% 30%,
            ${alpha(theme.palette.secondary.main, 0.2)} 0%,
            transparent 50%
          )`,
          animation: `${moveSecondary} 100s ease infinite`,
          filter: "blur(50px)",
          willChange: "transform",
          opacity: 0.7,
          mixBlendMode: "screen",
        })}
      />

      {}
      <Box
        sx={(theme) => ({
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle, ${alpha(
              theme.palette.text.primary,
              0.02
            )} 1px, transparent 1px),
            radial-gradient(circle, ${alpha(
              theme.palette.text.primary,
              0.03
            )} 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px, 70px 70px",
          backgroundPosition: "0 0, 25px 25px",
          opacity: 0.15,
        })}
      />
    </Box>
  );
};

export default AnimatedBackground;
