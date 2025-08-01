import React, { useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { CssBaseline } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition } from "framer-motion";
import { GoogleAuthProvider } from "./contexts/GoogleAuthContext";
import MainLayout from "./layouts/MainLayout";
import SpeedPage from "./pages/SpeedPage";
import { themes } from "./themes";
import type { ThemeName } from "./themes";
import GlobalScrollbar from "./themes/GlobalScrollbar";
import AnimatedBackground from "./components/AnimatedBackground";
import Callback from "./components/google/Callback";

const AppRoutes = ({
  themeName,
  onThemeChange,
  isAnimatedBgEnabled,
  onToggleAnimatedBg,
  selectedChatId,
  onSelectChat,
  currentUserId,
  onSelectUser,
}: {
  themeName: ThemeName;
  onThemeChange: (name: ThemeName) => void;
  isAnimatedBgEnabled: boolean;
  onToggleAnimatedBg: (enabled: boolean) => void;
  selectedChatId: number | null;
  onSelectChat: (id: number | null) => void;
  currentUserId: number;
  onSelectUser: (id: number) => void;
}) => {
  const location = useLocation();

  const pageVariants = {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  };

  const pageTransition: Transition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.3,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
      >
        <Routes location={location}>
          <Route
            path="/"
            element={
              <MainLayout
                selectedChatId={selectedChatId}
                onSelectChat={onSelectChat}
                currentUserId={currentUserId}
                onSelectUser={onSelectUser}
                isAnimatedBgEnabled={isAnimatedBgEnabled}
                onToggleAnimatedBg={onToggleAnimatedBg}
                themeName={themeName}
                onThemeChange={onThemeChange}
              />
            }
          />
          <Route
            path="/speed"
            element={<SpeedPage isAnimatedBgEnabled={isAnimatedBgEnabled} />}
          />
          <Route path="/callback" element={<Callback />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

function App() {
  const [themeName, setThemeName] = useState<ThemeName>("default-dark");
  const [isAnimatedBgEnabled, setAnimatedBgEnabled] = useState<boolean>(true);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number>(1);

  const handleSelectUser = (userId: number) => {
    setCurrentUserId(userId);
    setSelectedChatId(null);
  };

  const handleThemeChange = (name: ThemeName) => {
    setThemeName(name);
  };

  return (
    <ThemeProvider theme={themes[themeName]}>
      <GoogleAuthProvider currentUserId={currentUserId}>
        <CssBaseline />
        <GlobalScrollbar />
        {isAnimatedBgEnabled && <AnimatedBackground />}
        {}
        <HashRouter>
          <AppRoutes
            themeName={themeName}
            onThemeChange={handleThemeChange}
            isAnimatedBgEnabled={isAnimatedBgEnabled}
            onToggleAnimatedBg={setAnimatedBgEnabled}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
            currentUserId={currentUserId}
            onSelectUser={handleSelectUser}
          />
        </HashRouter>
      </GoogleAuthProvider>
    </ThemeProvider>
  );
}

export default App;
