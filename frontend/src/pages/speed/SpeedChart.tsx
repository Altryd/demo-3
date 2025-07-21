import React, { useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Box, Paper, Typography, useTheme } from "@mui/material";
import { animate } from "animejs";

interface ChartData {
  time: number;
  bpm: number;
}

interface SpeedChartProps {
  data: ChartData[];
}

const SpeedChart: React.FC<SpeedChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (chartRef.current && data.length > 0) {
      animate(chartRef.current, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        easing: "easeOutQuad",
      });
    }
  }, []);

  return (
    <Box ref={chartRef} sx={{ opacity: data.length > 0 ? 1 : 0, mt: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 1, sm: 2 },
          bgcolor: "background.paper",
          height: "400px",
          maxWidth: "900px",
          mx: "auto",
        }}
      >
        <Typography
          variant="h6"
          sx={{ ml: 2, color: theme.palette.text.primary }}
        >
          BPM Over Time
        </Typography>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 30, bottom: 30 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme.palette.divider}
            />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(time) => `${time.toFixed(1)}s`}
              stroke={theme.palette.text.secondary}
              label={{
                value: "Time (s)",
                position: "bottom",
                offset: 10,
                fill: theme.palette.text.secondary,
              }}
            />
            <YAxis
              domain={["dataMin - 20", "dataMax + 20"]}
              allowDataOverflow
              stroke={theme.palette.text.secondary}
              tickFormatter={(bpm) => `${Math.round(bpm)}`}
              label={{
                value: "BPM",
                angle: -90,
                position: "left",
                offset: 0,
                fill: theme.palette.text.secondary,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
              labelStyle={{ color: theme.palette.text.secondary }}
              formatter={(value: number) => [`${Math.round(value)} BPM`, null]}
              labelFormatter={(label) => `Time: ${label.toFixed(2)}s`}
            />
            {/* FIX: The <Legend /> component has been removed */}
            <Line
              type="monotone"
              dataKey="bpm"
              name="BPM"
              stroke={theme.palette.primary.main}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>
    </Box>
  );
};

export default SpeedChart;
