import React from "react";
import { Box, Paper, Typography, Divider } from "@mui/material";

interface Results {
  tapSpeed: string;
  bpm: number;
  unstableRate: number;
}

interface ResultsDisplayProps {
  results: Results;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mt: 4,
        maxWidth: "900px",
        mx: "auto",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="h5" gutterBottom>
        Your Results
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="body1">Tap Speed: {results.tapSpeed}</Typography>
      <Typography variant="body1">
        {}
        Stream Speed: <strong>{Math.round(results.bpm)} BPM</strong>
      </Typography>
      <Typography variant="body1">
        Unstable Rate: <strong>{results.unstableRate.toFixed(3)}</strong>
      </Typography>
    </Paper>
  );
};

export default ResultsDisplay;
