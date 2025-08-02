import React, { useState, useEffect } from "react";
import {
  Box,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Collapse,
  Divider,
  CircularProgress,
  Switch,
} from "@mui/material";
import {
  Settings,
  Person,
  CheckCircle,
  Wallpaper,
  Palette,
} from "@mui/icons-material";
import { getUsers } from "../services/api";
import type { User } from "../services/api";
import type { ThemeName } from "../themes";

interface SettingsPanelProps {
  currentUserId: number;
  onSelectUser: (userId: number) => void;
  isAnimatedBgEnabled: boolean;
  onToggleAnimatedBg: (enabled: boolean) => void;
  themeName: ThemeName;
  onThemeChange: (themeName: ThemeName) => void;
}

const themeDisplayNames: Record<ThemeName, string> = {
  "default-dark": "Стандартная темная",
  light: "Светлая",
  luto: "Luto",
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  currentUserId,
  onSelectUser,
  isAnimatedBgEnabled,
  onToggleAnimatedBg,
  themeName,
  onThemeChange,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUserListOpen, setUserListOpen] = useState(false);
  const [isThemeListOpen, setThemeListOpen] = useState(false);
  const open = Boolean(anchorEl);

  useEffect(() => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((err) => console.error("Failed to fetch users:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(open ? null : event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setUserListOpen(false);
    setThemeListOpen(false);
  };

  const handleUserSelect = (userId: number) => {
    onSelectUser(userId);
    handleClose();
  };

  const handleThemeSelect = (name: ThemeName) => {
    onThemeChange(name);
    handleClose();
  };

  return (
    <Box sx={{ position: "absolute", top: 16, right: 35, zIndex: 1300 }}>
      <IconButton onClick={handleClick}>
        <Settings />
      </IconButton>
      <Paper
        sx={{
          display: open ? "block" : "none",
          position: "absolute",
          top: 48,
          right: 0,
          width: 250,
          bgcolor: "background.paper",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "12px",
        }}
      >
        <List>
          <ListItem>
            <ListItemIcon>
              <Wallpaper />
            </ListItemIcon>
            <ListItemText primary="Эффект фона" />
            <Switch
              edge="end"
              onChange={(e) => onToggleAnimatedBg(e.target.checked)}
              checked={isAnimatedBgEnabled}
            />
          </ListItem>
          <Divider />
          <ListItemButton onClick={() => setThemeListOpen(!isThemeListOpen)}>
            <ListItemIcon>
              <Palette />
            </ListItemIcon>
            <ListItemText primary="Сменить тему" />
          </ListItemButton>
          <Collapse in={isThemeListOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {Object.keys(themeDisplayNames).map((key) => (
                <ListItemButton
                  key={key}
                  sx={{ pl: 4 }}
                  onClick={() => handleThemeSelect(key as ThemeName)}
                >
                  <ListItemText primary={themeDisplayNames[key as ThemeName]} />
                  {themeName === key && (
                    <ListItemIcon>
                      <CheckCircle sx={{ color: "#4caf50" }} />
                    </ListItemIcon>
                  )}
                </ListItemButton>
              ))}
            </List>
          </Collapse>
          <Divider />
          <ListItemButton onClick={() => setUserListOpen(!isUserListOpen)}>
            <ListItemIcon>
              <Person />
            </ListItemIcon>
            <ListItemText primary="Сменить пользователя" />
          </ListItemButton>
          <Collapse in={isUserListOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                users.map((user) => (
                  <ListItemButton
                    key={user.id}
                    sx={{ pl: 4 }}
                    onClick={() => handleUserSelect(user.id)}
                  >
                    <ListItemText primary={user.name} />
                    {currentUserId === user.id && (
                      <ListItemIcon>
                        <CheckCircle sx={{ color: "#4caf50" }} />
                      </ListItemIcon>
                    )}
                  </ListItemButton>
                ))
              )}
            </List>
          </Collapse>
        </List>
      </Paper>
    </Box>
  );
};

export default SettingsPanel;
