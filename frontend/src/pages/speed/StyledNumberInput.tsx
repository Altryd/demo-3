import React from "react";
import { Box, IconButton, TextField, useTheme } from "@mui/material";
import { ArrowDropUp, ArrowDropDown } from "@mui/icons-material";

interface StyledNumberInputProps {
  label: string;
  value: number;
  onChange: (newValue: number) => void;
  min?: number;
  disabled?: boolean;
}

const StyledNumberInput: React.FC<StyledNumberInputProps> = ({
  label,
  value,
  onChange,
  min = 0,
  disabled = false,
}) => {
  const theme = useTheme();

  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <TextField
        label={label}
        type="number"
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);

          onChange(isNaN(val) ? min : val);
        }}
        inputProps={{ min }}
        disabled={disabled}
        fullWidth
        sx={{
          "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
            {
              "-webkit-appearance": "none",
              margin: 0,
            },
          "& input[type=number]": {
            "-moz-appearance": "textfield",
          },
        }}
      />
      <Box sx={{ display: "flex", flexDirection: "column", ml: -5 }}>
        <IconButton
          onClick={handleIncrement}
          disabled={disabled}
          size="small"
          sx={{ height: "20px", color: theme.palette.primary.main }}
        >
          <ArrowDropUp />
        </IconButton>
        <IconButton
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          size="small"
          sx={{ height: "20px", color: theme.palette.primary.main }}
        >
          <ArrowDropDown />
        </IconButton>
      </Box>
    </Box>
  );
};

export default StyledNumberInput;
