import React, { useState } from "react";
import axios from "axios";
import { Button, CircularProgress, Avatar } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import GoogleIcon from "./GoogleIcon";
import { useGoogleAuth } from "../../contexts/GoogleAuthContext";

const API_BASE = "http://localhost:8000";

interface GoogleAuthProps {
  currentUserId: number;
}

const GoogleAuthButton: React.FC<GoogleAuthProps> = ({ currentUserId }) => {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const { googleUser, isGoogledIn, logout } = useGoogleAuth();
  const [isHovered, setIsHovered] = useState(false);

  const handleGoogleAuth = async () => {
    if (!currentUserId) {
      alert("Пожалуйста, выберите пользователя");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE}/auth/google?user_id=${currentUserId}`
      );
      const { authorization_url } = response.data;
      window.location.href = authorization_url;
    } catch (error) {
      setLoading(false);
      const message =
        axios.isAxiosError(error) && error.response?.data?.detail
          ? error.response.data.detail
          : "Ошибка авторизации";
      alert(message);
    }
  };

  if (isGoogledIn && googleUser) {
    return (
      <Button
        fullWidth
        variant="contained"
        color={isHovered ? "error" : "success"}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={logout}
        startIcon={
          !isHovered && (
            // Преобразуем 'null' в 'undefined' с помощью оператора ||
            // Если google_picture_url - null, Avatar получит undefined, что его устраивает
            <Avatar
              src={googleUser.google_picture_url || undefined}
              sx={{ width: 24, height: 24 }}
            />
          )
        }
        sx={{
          borderRadius: "16px",
          textTransform: "none",
          fontWeight: "500",
          transition: "background-color 0.3s ease-in-out",
        }}
      >
        {isHovered
          ? "Выйти"
          : googleUser.google_display_name || googleUser.google_email}
      </Button>
    );
  }

  return (
    <Button
      fullWidth
      variant="outlined"
      onClick={handleGoogleAuth}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <GoogleIcon />
        )
      }
      sx={{
        borderRadius: "16px",
        textTransform: "none",
        fontWeight: "500",
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
        "&:hover": {
          borderColor: theme.palette.primary.main,
          backgroundColor: alpha(theme.palette.primary.main, 0.08),
        },
      }}
    >
      {loading ? "Перенаправление..." : "Зайти через Google"}
    </Button>
  );
};

export default GoogleAuthButton;
