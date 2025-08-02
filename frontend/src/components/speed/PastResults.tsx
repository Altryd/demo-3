// START OF FILE src/components/speed/PastResults.tsx

import React, { useState } from "react";
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Button,
  Collapse,
  Divider,
} from "@mui/material";
import type { SpeedTestResult } from "../../services/api";
import SpeedChart from "../../pages/speed/SpeedChart";

interface PastResultsProps {
  results: SpeedTestResult[];
  loading: boolean;
}

const PastResults: React.FC<PastResultsProps> = ({ results, loading }) => {
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  const handleToggle = (id: number) => {
    setSelectedResultId(selectedResultId === id ? null : id);
  };

  const selectedResult = results.find((r) => r.id === selectedResultId);

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 2, sm: 3 },
        mt: 4,
        maxWidth: "900px",
        mx: "auto",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="h5" gutterBottom>
        Past Results
      </Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : results.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
          No past results found for this user.
        </Typography>
      ) : (
        <Box>
          {results.map((result) => (
            <Box key={result.id} sx={{ mb: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleToggle(result.id)}
                sx={{
                  justifyContent: "space-between",
                  p: 2,
                  textAlign: "left",
                  borderColor:
                    selectedResultId === result.id ? "primary.main" : "divider",
                }}
              >
                <Box>
                  <Typography variant="h6" component="span">
                    {Math.round(result.stream_speed)} BPM
                  </Typography>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{ ml: 2, color: "text.secondary" }}
                  >
                    (UR: {result.unstable_rate.toFixed(3)})
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", textTransform: "none" }}
                >
                  {new Date(result.timestamp).toLocaleString()}
                </Typography>
              </Button>
              <Collapse in={selectedResultId === result.id}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mt: 1,
                    borderColor: "primary.dark",
                    borderWidth: "1px",
                  }}
                >
                  {selectedResult && (
                    <>
                      {/* ИСПРАВЛЕНО: Замена Grid на Box с flexbox */}
                      <Box
                        display="flex"
                        flexWrap="wrap"
                        sx={{ mx: -1 }} // Отрицательный отступ для компенсации padding у дочерних элементов
                      >
                        <Box sx={{ width: { xs: "50%", sm: "25%" }, px: 1 }}>
                          <Typography variant="overline" color="text.secondary">
                            Taps
                          </Typography>
                          <Typography variant="h6">
                            {selectedResult.taps}
                          </Typography>
                        </Box>
                        <Box sx={{ width: { xs: "50%", sm: "25%" }, px: 1 }}>
                          <Typography variant="overline" color="text.secondary">
                            Time
                          </Typography>
                          <Typography variant="h6">
                            {selectedResult.time.toFixed(2)}s
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: { xs: "50%", sm: "25%" },
                            px: 1,
                            mt: { xs: 2, sm: 0 },
                          }}
                        >
                          <Typography variant="overline" color="text.secondary">
                            BPM
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            {Math.round(selectedResult.stream_speed)}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            width: { xs: "50%", sm: "25%" },
                            px: 1,
                            mt: { xs: 2, sm: 0 },
                          }}
                        >
                          <Typography variant="overline" color="text.secondary">
                            Unstable Rate
                          </Typography>
                          <Typography variant="h6">
                            {selectedResult.unstable_rate.toFixed(3)}
                          </Typography>
                        </Box>
                      </Box>
                      {selectedResult.chart_data &&
                      selectedResult.chart_data.length > 1 ? (
                        <Box sx={{ mt: 2 }}>
                          <Divider sx={{ mb: 2 }} />
                          <SpeedChart data={selectedResult.chart_data} />
                        </Box>
                      ) : (
                        <Typography
                          color="text.secondary"
                          sx={{ mt: 2, textAlign: "center" }}
                        >
                          No chart data available for this result.
                        </Typography>
                      )}
                    </>
                  )}
                </Paper>
              </Collapse>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default PastResults;
