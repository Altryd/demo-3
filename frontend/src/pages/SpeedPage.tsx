import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { Link } from "react-router-dom";
import { ArrowBack, CheckCircleOutline } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";
import type { AxiosError } from "axios";

import SettingsForm from "./speed/SettingsForm";
import ResultsDisplay from "./speed/ResultsDisplay";
import SpeedChart from "./speed/SpeedChart";
import PastResults from "../components/speed/PastResults";
import { useKeyPress } from "./speed/hooks/useKeyPress";
import {
  getUsers,
  saveSpeedTestResult,
  getSpeedTestResults,
} from "../services/api";
import type {
  User,
  SpeedTestResult,
  SpeedTestPayload,
  SpeedTestChartData,
} from "../services/api";

import tapSoundSrc from "../assets/MenuHit.wav";

type TestState = "idle" | "ready" | "running" | "finished";

interface SpeedPageProps {
  isAnimatedBgEnabled: boolean;
}

const SpeedPage: React.FC<SpeedPageProps> = ({ isAnimatedBgEnabled }) => {
  const theme = useTheme();

  const [settings, setSettings] = useState({
    testMode: "clicks" as "clicks" | "time",
    clickLimit: 50,
    timeLimit: 10,
    key1: "z",
    key2: "x",
  });
  const [testState, setTestState] = useState<TestState>("idle");

  const testStateRef = useRef(testState);
  useEffect(() => {
    testStateRef.current = testState;
  }, [testState]);

  const [statusMessage, setStatusMessage] = useState(
    'Select a user, configure your test, and click "Begin Test".'
  );
  const [results, setResults] = useState({
    tapSpeed: "0 taps / 0s",
    bpm: 0,
    unstableRate: 0,
  });
  const [chartData, setChartData] = useState<SpeedTestChartData[]>([]);
  const [resultsKey, setResultsKey] = useState<number | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [pastResults, setPastResults] = useState<SpeedTestResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const [latestResultPayload, setLatestResultPayload] =
    useState<SpeedTestPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clickTimes = useRef<number[]>([]);
  const timediffs = useRef<number[]>([]);
  const beginTime = useRef<number>(0);
  const testTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const apiControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getUsers()
      .then((data: User[]) => setUsers(data))
      .catch((err: AxiosError) =>
        console.error("Failed to fetch users:", err.message)
      );
  }, []);

  useEffect(() => {
    if (typeof selectedUserId !== "number") {
      setPastResults([]);
      return;
    }
    apiControllerRef.current?.abort();
    const controller = new AbortController();
    apiControllerRef.current = controller;

    setLoadingResults(true);
    getSpeedTestResults(selectedUserId, controller.signal)
      .then((data: SpeedTestResult[]) => {
        if (!controller.signal.aborted) setPastResults(data);
      })
      .catch((err: AxiosError) => {
        if (err.name !== "CanceledError")
          console.error("Failed to fetch past results:", err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingResults(false);
      });

    return () => controller.abort();
  }, [selectedUserId]);

  useEffect(() => {
    const audio = new Audio(tapSoundSrc);
    audio.volume = 0.15;
    audioRef.current = audio;
  }, []);

  const handleSettingsChange = (newSettings: Partial<typeof settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const resetTest = () => {
    clickTimes.current = [];
    timediffs.current = [];
    beginTime.current = 0;
    setChartData([]);
    setResults({ tapSpeed: "0 taps / 0s", bpm: 0, unstableRate: 0 });
    setResultsKey(null);
    setLatestResultPayload(null);
    if (testTimerRef.current) clearTimeout(testTimerRef.current);
  };

  const beginTest = () => {
    if (selectedUserId === "") {
      setStatusMessage("Please select a user first!");
      return;
    }
    resetTest();
    setTestState("ready");
    setStatusMessage("Test is ready. Press your selected keys to start.");
  };

  const endTest = useCallback(() => {
    if (testStateRef.current === "finished") return;

    setTestState("finished");
    if (testTimerRef.current) clearTimeout(testTimerRef.current);

    const finalTaps = clickTimes.current.length;
    if (finalTaps < 2) {
      setStatusMessage("Test finished! Not enough data to save.");
      return;
    }

    const finalTime = (Date.now() - beginTime.current) / 1000;
    const finalBpm = ((finalTaps / finalTime) * 60) / 4;
    let finalUnstableRate = 0;
    if (timediffs.current.length > 1) {
      const sum = timediffs.current.reduce((a, b) => a + b, 0);
      const avg = sum / timediffs.current.length;
      const variance = timediffs.current.reduce(
        (acc, val) => acc + (val - avg) ** 2,
        0
      );
      const stdDev = Math.sqrt(variance / timediffs.current.length);
      finalUnstableRate = stdDev * 10;
    }

    const finalChartPoint = { time: finalTime, bpm: finalBpm };
    // обновляем UI и данные для графика ОДНОВРЕМЕННО
    setResults({
      tapSpeed: `${finalTaps} taps / ${finalTime.toFixed(2)}s`,
      bpm: finalBpm,
      unstableRate: finalUnstableRate,
    });
    setChartData((currentChartData) => [...currentChartData, finalChartPoint]);
    setResultsKey(Date.now());
    setStatusMessage("Test finished! Submit your result or try again.");

    if (typeof selectedUserId === "number") {
      const payload: SpeedTestPayload = {
        user_id: selectedUserId,
        taps: finalTaps,
        time: finalTime,
        bpm: finalBpm,
        unstable_rate: finalUnstableRate,
        chart_data: [...chartData, finalChartPoint],
      };
      setLatestResultPayload(payload);
    }
  }, [selectedUserId, chartData]); // зависимость от chartData нужна для создания payload

  const handleSubmitResult = () => {
    if (!latestResultPayload) return;

    setIsSubmitting(true);
    const controller = new AbortController();
    saveSpeedTestResult(latestResultPayload, controller.signal)
      .then((savedResult: SpeedTestResult) => {
        console.log("Result saved:", savedResult);
        setPastResults((prev) => [savedResult, ...prev]);
        setLatestResultPayload(null);
        setStatusMessage("Result saved successfully!");
      })
      .catch((err: AxiosError) => {
        if (err.name !== "CanceledError")
          console.error("Failed to save result:", err.message);
        setStatusMessage("Error saving result. Please try again.");
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleTap = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }

    const currentState = testStateRef.current;

    if (currentState === "ready") {
      setTestState("running");
      beginTime.current = Date.now();
      setStatusMessage("Test in progress...");
      if (settings.testMode === "time") {
        testTimerRef.current = window.setTimeout(
          endTest,
          settings.timeLimit * 1000
        );
      }
    }

    if (currentState !== "ready" && currentState !== "running") return;

    const now = Date.now();
    if (clickTimes.current.length > 0) {
      const lastTapTime = clickTimes.current[clickTimes.current.length - 1];
      timediffs.current.push(now - lastTapTime);
    }
    clickTimes.current.push(now);

    const streamTime = (now - beginTime.current) / 1000;
    if (streamTime > 0) {
      const bpm = ((clickTimes.current.length / streamTime) * 60) / 4;
      setChartData((prev) => [...prev, { time: streamTime, bpm }]);
    }

    if (
      settings.testMode === "clicks" &&
      clickTimes.current.length >= settings.clickLimit
    ) {
      endTest();
    }
  }, [settings, endTest]); // убраны лишние зависимости

  useKeyPress(
    [settings.key1, settings.key2],
    handleTap,
    testState !== "ready" && testState !== "running"
  );

  const handleUserChange = (event: SelectChangeEvent<number | "">) => {
    setSelectedUserId(event.target.value as number | "");
  };

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100vh",
        backgroundColor: isAnimatedBgEnabled
          ? "transparent"
          : theme.palette.background.default,
        color: theme.palette.text.primary,
        py: 4,
        px: 2,
        boxSizing: "border-box",
      }}
    >
      <Container maxWidth="lg">
        <Button
          component={Link}
          to="/"
          startIcon={<ArrowBack />}
          sx={{ mb: 2 }}
        >
          Back to Assistant
        </Button>
        <Paper
          elevation={3}
          sx={{ p: { xs: 2, sm: 4 }, bgcolor: "background.paper" }}
        >
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            osu! Stream Speed Benchmark
          </Typography>

          <Box sx={{ maxWidth: "400px", mx: "auto", mb: 2 }}>
            <FormControl fullWidth disabled={testState === "running"}>
              <InputLabel id="user-select-label">User</InputLabel>
              <Select
                labelId="user-select-label"
                id="user-select"
                value={selectedUserId}
                label="User"
                onChange={handleUserChange}
              >
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Typography
            variant="subtitle1"
            align="center"
            color="text.secondary"
            sx={{ mb: 4, minHeight: "24px" }}
          >
            {statusMessage}
          </Typography>
          <Divider sx={{ mb: 4 }} />
          <SettingsForm
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onBeginTest={beginTest}
            isTestRunning={testState === "running"}
          />
        </Paper>

        {(testState === "running" || testState === "finished") &&
          chartData.length > 1 && <SpeedChart data={chartData} />}

        <AnimatePresence>
          {testState === "finished" && (
            <motion.div
              key={resultsKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <ResultsDisplay results={results} />
              {latestResultPayload && (
                <Box
                  sx={{
                    maxWidth: "900px",
                    mx: "auto",
                    mt: 2,
                    textAlign: "center",
                  }}
                >
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<CheckCircleOutline />}
                    onClick={handleSubmitResult}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit Result"}
                  </Button>
                </Box>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {typeof selectedUserId === "number" && (
          <PastResults results={pastResults} loading={loadingResults} />
        )}
      </Container>
    </Box>
  );
};

export default SpeedPage;
