import React from "react";
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";
import StyledNumberInput from "./StyledNumberInput"; 

interface Settings {
  testMode: "clicks" | "time";
  clickLimit: number;
  timeLimit: number;
  key1: string;
  key2: string;
}

interface SettingsFormProps {
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
  onBeginTest: () => void;
  isTestRunning: boolean;
}

const SettingsForm: React.FC<SettingsFormProps> = ({
  settings,
  onSettingsChange,
  onBeginTest,
  isTestRunning,
}) => {
  return (
    <Box
      component="form"
      noValidate
      autoComplete="off"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 3, 
        maxWidth: "400px",
        mx: "auto",
      }}
    >
      <FormControl component="fieldset" disabled={isTestRunning}>
        <FormLabel component="legend">Test Mode</FormLabel>
        <RadioGroup
          row
          name="testMode"
          value={settings.testMode}
          onChange={(e) =>
            onSettingsChange({ testMode: e.target.value as "clicks" | "time" })
          }
        >
          <FormControlLabel value="clicks" control={<Radio />} label="Clicks" />
          <FormControlLabel value="time" control={<Radio />} label="Time" />
        </RadioGroup>
      </FormControl>

      {}
      {settings.testMode === "clicks" ? (
        <StyledNumberInput
          label="Number of Clicks"
          value={settings.clickLimit}
          onChange={(val) => onSettingsChange({ clickLimit: val })}
          min={3}
          disabled={isTestRunning}
        />
      ) : (
        <StyledNumberInput
          label="Time (seconds)"
          value={settings.timeLimit}
          onChange={(val) => onSettingsChange({ timeLimit: val })}
          min={2}
          disabled={isTestRunning}
        />
      )}

      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField
          label="Key 1"
          value={settings.key1}
          onChange={(e) =>
            onSettingsChange({ key1: e.target.value.slice(-1).toLowerCase() })
          }
          inputProps={{ maxLength: 1 }}
          disabled={isTestRunning}
          fullWidth
        />
        <TextField
          label="Key 2"
          value={settings.key2}
          onChange={(e) =>
            onSettingsChange({ key2: e.target.value.slice(-1).toLowerCase() })
          }
          inputProps={{ maxLength: 1 }}
          disabled={isTestRunning}
          fullWidth
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        size="large"
        startIcon={<PlayArrow />}
        onClick={onBeginTest}
        disabled={isTestRunning}
      >
        {isTestRunning ? "Test in Progress..." : "Begin Test"}
      </Button>
    </Box>
  );
};

export default SettingsForm;
