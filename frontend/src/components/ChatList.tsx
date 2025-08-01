import React, { useState, useEffect } from "react";
import {
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Divider,
  ListItemIcon,
  IconButton,
  Collapse,
  Paper,
  CircularProgress,
  Switch,
  ListItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  ChatBubbleOutline,
  Settings,
  Person,
  CheckCircle,
  Wallpaper,
  Palette,
  DeleteOutline,
  CalendarMonth,
} from "@mui/icons-material";
import { getUsers, deleteChat } from "../services/api";
import type { Chat, User } from "../services/api";
import type { ThemeName } from "../themes";
import GoogleAuthButton from "./google/GoogleAuthButton";
// Импортируем хук для доступа к данным Google-авторизации
import { useGoogleAuth } from "../contexts/GoogleAuthContext";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
  currentUserId: number;
  onSelectUser: (userId: number) => void;
  isAnimatedBgEnabled: boolean;
  onToggleAnimatedBg: (enabled: boolean) => void;
  themeName: ThemeName;
  onThemeChange: (themeName: ThemeName) => void;
  onChatDeleted: (chatId: number) => void;
}

const themeDisplayNames: Record<ThemeName, string> = {
  "default-dark": "Стандартная темная",
  light: "Светлая",
  luto: "Luto",
};

const listItemTextStyles = {
  style: {
    whiteSpace: "nowrap", // Запретить перенос текста
    overflow: "hidden", // Скрыть то, что не помещается
    textOverflow: "ellipsis", // Добавить многоточие в конце
  },
};

const groupChatsByDate = (chats: Chat[]): Record<string, Chat[]> => {
  const groups: Record<string, Chat[]> = {};
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const dayBefore = new Date();
  dayBefore.setDate(today.getDate() - 2);

  // Хелпер для сравнения "календарного дня" в локальном часовом поясе
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  chats.forEach((chat) => {
    if (!chat.created_at) {
      if (!groups["Чаты без даты"]) groups["Чаты без даты"] = [];
      groups["Чаты без даты"].push(chat);
      return;
    }

    const chatDate = new Date(chat.created_at);
    let category: string;

    if (isSameDay(chatDate, today)) {
      category = "Сегодня";
    } else if (isSameDay(chatDate, yesterday)) {
      category = "Вчера";
    } else if (isSameDay(chatDate, dayBefore)) {
      category = "Позавчера";
    } else {
      category = "Ранее";
    }

    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(chat);
  });
  return groups;
};

const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onNewChat,
  currentUserId,
  onSelectUser,
  isAnimatedBgEnabled,
  onToggleAnimatedBg,
  themeName,
  onThemeChange,
  onChatDeleted,
}) => {
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [isUserListOpen, setUserListOpen] = useState(false);
  const [isThemeListOpen, setThemeListOpen] = useState(false);

  const [hoveredChatId, setHoveredChatId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);

  const {
    isGoogledIn,
    calendars,
    selectedCalendarId,
    loadingCalendars,
    selectCalendar,
  } = useGoogleAuth();
  const [isCalendarListOpen, setCalendarListOpen] = useState(false);

  // Фильтруем календари, оставляя только те, куда можно писать
  const writableCalendars = calendars.filter(
    (cal) => cal.accessRole === "writer" || cal.accessRole === "owner"
  );

  const sortedChats = [...chats].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
  const groupedChats = groupChatsByDate(sortedChats);

  const groupOrder = [
    "Сегодня",
    "Вчера",
    "Позавчера",
    "Ранее",
    "Чаты без даты",
  ];

  useEffect(() => {
    setLoadingUsers(true);
    getUsers()
      .then(setUsers)
      .catch((err) => console.error("Failed to fetch users:", err))
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleUserSelect = (userId: number) => {
    onSelectUser(userId);
    setSettingsOpen(false);
  };

  const handleThemeSelect = (name: ThemeName) => {
    onThemeChange(name);
    setSettingsOpen(false);
  };

  const handleCalendarSelect = (calendarId: string) => {
    selectCalendar(calendarId);
  };

  const handleOpenDeleteDialog = (event: React.MouseEvent, chat: Chat) => {
    event.stopPropagation();
    setChatToDelete(chat);
    setDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDialogOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!chatToDelete) return;

    deleteChat(chatToDelete.id)
      .then(() => {
        console.log(`Chat ${chatToDelete.id} deleted successfully.`);
        onChatDeleted(chatToDelete.id);
      })
      .catch((err) => {
        console.error(`Failed to delete chat ${chatToDelete.id}:`, err);
      })
      .finally(() => {
        handleCloseDeleteDialog();
      });
  };

  return (
    <Box
      sx={{
        width: 280,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            variant="h6"
            component="div"
            sx={{ whiteSpace: "nowrap" }}
          >
            <span style={{ color: "#ff66aa" }}>osu!</span>
            <span style={{ color: "text.primary" }}>assistant</span>
          </Typography>
          <IconButton onClick={() => setSettingsOpen(!settingsOpen)}>
            <Settings />
          </IconButton>
        </Box>
      </Box>
      <Collapse
        in={settingsOpen}
        timeout="auto"
        unmountOnExit
        sx={{ flexShrink: 0 }}
      >
        <Paper
          elevation={0}
          sx={{
            mx: 2,
            mb: 1,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: "12px",
          }}
        >
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 40 }}>
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
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Palette />
              </ListItemIcon>
              <ListItemText primary="Сменить тему" />
            </ListItemButton>
            <Collapse in={isThemeListOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding dense>
                {Object.keys(themeDisplayNames).map((key) => (
                  <ListItemButton
                    key={key}
                    sx={{ pl: 4 }}
                    onClick={() => handleThemeSelect(key as ThemeName)}
                  >
                    <ListItemText
                      primary={themeDisplayNames[key as ThemeName]}
                      primaryTypographyProps={listItemTextStyles} // добавление пропса для лимитов текста + норм иконки
                    />
                    {themeName === key && (
                      <ListItemIcon>
                        <CheckCircle fontSize="small" color="success" />
                      </ListItemIcon>
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Collapse>
            <Divider />
            <ListItemButton onClick={() => setUserListOpen(!isUserListOpen)}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Person />
              </ListItemIcon>
              <ListItemText primary="Сменить пользователя" />
            </ListItemButton>
            <Collapse in={isUserListOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding dense>
                {loadingUsers ? (
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
                      <ListItemText
                        primary={user.name}
                        primaryTypographyProps={listItemTextStyles} // добавление пропса для ников и норм иконки
                      />
                      {currentUserId === user.id && (
                        <ListItemIcon>
                          <CheckCircle fontSize="small" color="success" />
                        </ListItemIcon>
                      )}
                    </ListItemButton>
                  ))
                )}
              </List>
            </Collapse>
            {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
            {isGoogledIn && (
              <>
                <Divider />
                <ListItemButton
                  onClick={() => setCalendarListOpen(!isCalendarListOpen)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <CalendarMonth />
                  </ListItemIcon>
                  <ListItemText primary="Календари" />
                </ListItemButton>
                <Collapse in={isCalendarListOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding dense>
                    {loadingCalendars ? (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          p: 2,
                        }}
                      >
                        <CircularProgress size={24} />
                      </Box>
                    ) : writableCalendars.length > 0 ? (
                      writableCalendars.map((calendar) => (
                        <ListItemButton
                          key={calendar.id}
                          sx={{ pl: 4 }}
                          onClick={() => handleCalendarSelect(calendar.id)}
                        >
                          <ListItemText
                            primary={calendar.summary}
                            primaryTypographyProps={listItemTextStyles}
                          />
                          {selectedCalendarId === calendar.id && (
                            <ListItemIcon>
                              <CheckCircle fontSize="small" color="success" />
                            </ListItemIcon>
                          )}
                        </ListItemButton>
                      ))
                    ) : (
                      <ListItem sx={{ pl: 4 }}>
                        <ListItemText
                          primary="Нет календарей для записи"
                          primaryTypographyProps={{
                            color: "text.secondary",
                            fontStyle: "italic",
                          }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Collapse>
              </>
            )}
          </List>
        </Paper>
      </Collapse>
      <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
        <ListItemButton
          onClick={onNewChat}
          sx={{
            borderRadius: "16px",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.25),
            },
          }}
        >
          <ListItemIcon>
            <ChatBubbleOutline />
          </ListItemIcon>
          <ListItemText
            primary="New Chat"
            primaryTypographyProps={{ style: { whiteSpace: "nowrap" } }}
          />
        </ListItemButton>
        <Box sx={{ mt: 1 }}>
          <GoogleAuthButton currentUserId={currentUserId} />
        </Box>
        <Divider sx={{ mt: 2 }} />
      </Box>
      <Box sx={{ flexGrow: 1, overflowY: "auto", px: 2 }}>
        <List>
          {groupOrder.map(
            (groupName) =>
              groupedChats[groupName] && (
                <Box key={groupName} sx={{ mb: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      px: 2,
                      py: 0.5,
                      color: "text.secondary",
                      fontWeight: "bold",
                      display: "block",
                    }}
                  >
                    {groupName}
                  </Typography>
                  {groupedChats[groupName].map((chat) => (
                    <ListItemButton
                      key={chat.id}
                      selected={selectedChatId === chat.id}
                      onClick={() => onSelectChat(chat.id)}
                      onMouseEnter={() => setHoveredChatId(chat.id)}
                      onMouseLeave={() => setHoveredChatId(null)}
                      sx={{
                        borderRadius: "12px",
                        py: 0.5,
                        mb: "2px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        "&.Mui-selected": {
                          backgroundColor: "primary.main",
                          color: "primary.contrastText",
                          "&:hover": { backgroundColor: "primary.dark" },
                        },
                      }}
                    >
                      <ListItemText
                        primary={chat.summary}
                        sx={{ minWidth: 0, mr: 1 }}
                        primaryTypographyProps={{
                          fontSize: "0.875rem",
                          style: {
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenDeleteDialog(e, chat)}
                        sx={{
                          visibility:
                            hoveredChatId === chat.id ? "visible" : "hidden",
                          color: "text.secondary",
                          "&:hover": {
                            color: "error.main",
                            backgroundColor: "rgba(255, 0, 0, 0.1)",
                          },
                        }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </ListItemButton>
                  ))}
                </Box>
              )
          )}
        </List>
      </Box>
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDeleteDialog}
        TransitionProps={{ onExited: () => setChatToDelete(null) }}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{
          style: {
            backgroundColor: theme.palette.background.paper,
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle id="alert-dialog-title">
          {"Подтвердите удаление"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Вы действительно хотите удалить чат "
            <strong>{chatToDelete?.summary}</strong>"? Это действие нельзя будет
            отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Нет</Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Да, удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatList;
