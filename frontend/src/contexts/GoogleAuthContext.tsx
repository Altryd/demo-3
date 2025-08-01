import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import {
  listUserCalendars,
  selectUserCalendar,
  type GoogleCalendar,
} from "../services/api";

interface GoogleUser {
  id: number;
  name: string;
  google_display_name: string | null;
  google_email: string | null;
  google_picture_url: string | null;
}

interface AuthContextType {
  googleUser: GoogleUser | null;
  isGoogledIn: boolean;
  loading: boolean;
  login: (userId: number) => Promise<void>;
  logout: () => void;
  calendars: GoogleCalendar[];
  selectedCalendarId: string | null;
  loadingCalendars: boolean;
  selectCalendar: (calendarId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface GoogleAuthProviderProps {
  children: React.ReactNode;
  currentUserId: number;
}

export const GoogleAuthProvider: React.FC<GoogleAuthProviderProps> = ({
  children,
  currentUserId, // Получаем ID текущего пользователя
}) => {
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [loading, setLoading] = useState(true);

  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    null
  );
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  const clearGoogleSessionView = useCallback(() => {
    setGoogleUser(null);
    setCalendars([]);
    setSelectedCalendarId(null);
  }, []);

  const logout = useCallback(() => {
    const storedUserId = localStorage.getItem("google_authed_user_id");
    if (storedUserId) {
      localStorage.removeItem(`selected_calendar_${storedUserId}`);
    }
    localStorage.removeItem("google_authed_user_id");
    clearGoogleSessionView();
  }, [clearGoogleSessionView]);

  const selectCalendar = useCallback(
    async (calendarId: string) => {
      if (!googleUser) {
        console.error("Нельзя выбрать календарь, пользователь не авторизован.");
        return;
      }
      try {
        const payload = { user_id: googleUser.id, calendar_id: calendarId };
        const controller = new AbortController();
        await selectUserCalendar(payload, controller.signal);
        setSelectedCalendarId(calendarId);
        localStorage.setItem(`selected_calendar_${googleUser.id}`, calendarId);
      } catch (error) {
        console.error("Ошибка при выборе календаря:", error);
        alert("Не удалось сохранить выбор календаря. Попробуйте снова.");
      }
    },
    [googleUser]
  );

  const login = useCallback(
    async (userId: number) => {
      setLoading(true);
      try {
        const response = await axios.get<GoogleUser>(
          `http://localhost:8000/user/${userId}`
        );

        if (response.data && response.data.google_email) {
          setGoogleUser(response.data);
          localStorage.setItem("google_authed_user_id", String(userId));

          setLoadingCalendars(true);
          const controller = new AbortController();
          listUserCalendars(userId, controller.signal)
            .then((calendarData) => {
              setCalendars(calendarData.calendars);
              const storedCalId = localStorage.getItem(
                `selected_calendar_${userId}`
              );
              if (
                storedCalId &&
                calendarData.calendars.some((c) => c.id === storedCalId)
              ) {
                setSelectedCalendarId(storedCalId);
              } else {
                setSelectedCalendarId(null);
              }
            })
            .catch((err) => {
              console.error("Не удалось загрузить календари", err);
              setCalendars([]);
            })
            .finally(() => {
              setLoadingCalendars(false);
            });
        } else {
          console.warn(
            "Пользователь вошел, но данные Google не найдены. Выполняется выход."
          );
          logout();
        }
      } catch (error) {
        console.error("Ошибка при получении данных пользователя", error);
        logout();
      } finally {
        setLoading(false);
      }
    },
    [logout]
  );

  useEffect(() => {
    const storedUserId = localStorage.getItem("google_authed_user_id");
    if (storedUserId) {
      login(parseInt(storedUserId, 10));
    } else {
      setLoading(false);
    }
  }, [login]);

  useEffect(() => {
    const googledInUserIdStr = localStorage.getItem("google_authed_user_id");

    if (googledInUserIdStr) {
      const googledInUserId = parseInt(googledInUserIdStr, 10);
      if (currentUserId !== googledInUserId) {
        clearGoogleSessionView();
      } else {
        if (!googleUser) {
          login(currentUserId);
        }
      }
    } else {
      clearGoogleSessionView();
    }
  }, [currentUserId, googleUser, login, clearGoogleSessionView]);

  const isGoogledIn = !!googleUser;

  return (
    <AuthContext.Provider
      value={{
        googleUser,
        isGoogledIn,
        loading,
        login,
        logout,
        calendars,
        selectedCalendarId,
        loadingCalendars,
        selectCalendar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useGoogleAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
  }
  return context;
};
