import React, { useState, useEffect, useRef } from "react";
import { Box, IconButton, Button, useTheme } from "@mui/material";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ChatList from "../components/ChatList";
import GoogleAuthButton from "../components/google/GoogleAuthButton";
import ChatView from "../components/ChatView";
import Welcome from "../components/Welcome";
import MessageInput from "../components/MessageInput";
import AnimatedBackground from "../components/AnimatedBackground";
import {
  getChatMessages,
  createChat,
  postQuery,
  getUserChatsById,
} from "../services/api";
import type {
  Message,
  NewChatResponse,
  QueryResponse,
  Chat,
} from "../services/api";
import type { ThemeName } from "../themes";

const logThinking = (
  action: "SET" | "RESET",
  currentThinkingIdInState: number | null,
  newThinkingId: number | null | string,
  reason: string
) => {
  console.log(
    `%c[THINKING ${action}]%c CurrInState: ${currentThinkingIdInState}, New: ${newThinkingId}, Reason: ${reason}`,
    action === "SET"
      ? "color: orange; font-weight: bold;"
      : "color: lightblue; font-weight: bold;",
    "color: default;"
  );
};

interface MainLayoutProps {
  selectedChatId: number | null;
  onSelectChat: (chatId: number | null) => void;
  currentUserId: number;
  onSelectUser: (userId: number) => void;
  isAnimatedBgEnabled: boolean;
  onToggleAnimatedBg: (enabled: boolean) => void;
  themeName: ThemeName;
  onThemeChange: (themeName: ThemeName) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  selectedChatId,
  onSelectChat,
  currentUserId,
  onSelectUser,
  isAnimatedBgEnabled,
  onToggleAnimatedBg,
  themeName,
  onThemeChange,
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userChats, setUserChats] = useState<Chat[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [_, _setThinkingChatIdInternal] = useState<number | null>(null);
  const thinkingChatIdRef = useRef<number | null>(null);

  const setThinkingChatId = (newId: number | null, reason: string) => {
    logThinking(
      newId !== null ? "SET" : "RESET",
      thinkingChatIdRef.current,
      newId,
      reason
    );
    thinkingChatIdRef.current = newId;
    _setThinkingChatIdInternal(newId);
  };

  const [optimisticUserMessageForNewChat, setOptimisticUserMessageForNewChat] =
    useState<Message | null>(null);

  const scrollContainerRef = useRef<HTMLElement>(null);
  const queryAbortControllerRef = useRef<AbortController | null>(null);
  const currentSelectedChatIdRef = useRef<number | null>(selectedChatId);

  const isWelcomeLayout =
    selectedChatId === null && optimisticUserMessageForNewChat === null;

  useEffect(() => {
    currentSelectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    if (currentUserId) {
      getUserChatsById(currentUserId)
        .then(setUserChats)
        .catch((err) => {
          console.error(
            `Failed to fetch chats for user ${currentUserId}:`,
            err
          );
          setUserChats([]);
        });
    } else {
      setUserChats([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    const controller = new AbortController();
    const chatIdToLoad = selectedChatId;

    if (chatIdToLoad !== null) {
      setLoadingMessages(true);
      getChatMessages(chatIdToLoad, controller.signal)
        .then((fetchedMessages) => {
          if (!controller.signal.aborted) {
            setMessages(fetchedMessages);
            if (
              optimisticUserMessageForNewChat &&
              optimisticUserMessageForNewChat.chat_id === chatIdToLoad
            ) {
              setOptimisticUserMessageForNewChat(null);
            }
          }
        })
        .catch((err: Error) => {
          if (err.name !== "CanceledError" && !controller.signal.aborted) {
            console.error(
              `[useEffect selectedChatId] Failed to fetch messages for chat ${chatIdToLoad}:`,
              err
            );
            setMessages([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoadingMessages(false);
          }
        });
    } else {
      if (optimisticUserMessageForNewChat && thinkingChatIdRef.current === -1) {
        setMessages([optimisticUserMessageForNewChat]);
      } else {
        setMessages([]);
        if (optimisticUserMessageForNewChat) {
          setOptimisticUserMessageForNewChat(null);
        }
      }
      setLoadingMessages(false);
      if (
        thinkingChatIdRef.current === -1 &&
        !optimisticUserMessageForNewChat
      ) {
        setThinkingChatId(
          null,
          "useEffect selectedChatId, welcome & no optimistic"
        );
      }
    }
    return () => {
      controller.abort();
    };
  }, [selectedChatId, optimisticUserMessageForNewChat]);

  const handleChatDeleted = (deletedChatId: number) => {
    setUserChats((prevChats) =>
      prevChats.filter((chat) => chat.id !== deletedChatId)
    );
    if (selectedChatId === deletedChatId) {
      onSelectChat(null);
    }
  };

  const handleSendMessage = (text: string) => {
    queryAbortControllerRef.current?.abort();
    const controller = new AbortController();
    queryAbortControllerRef.current = controller;

    const chatIdForThisRequest = selectedChatId;

    if (chatIdForThisRequest !== null) {
      const userMessage: Message = {
        id: Date.now(),
        chat_id: chatIdForThisRequest,
        text,
        role: "user",
      };
      setMessages((prevMessages) => [...prevMessages, userMessage]);
      setThinkingChatId(
        chatIdForThisRequest,
        `handleSendMessage existing chat (${chatIdForThisRequest})`
      );

      postQuery(text, currentUserId, chatIdForThisRequest, controller.signal)
        .then((response: QueryResponse) => {
          if (controller.signal.aborted) return;
          const sourceFileNames = response.context
            .map((item) => item.source)
            .filter(
              (source): source is string =>
                typeof source === "string" && source !== "unknown"
            );
          const assistantMessage: Message = {
            id: Date.now() + 1,
            chat_id: chatIdForThisRequest,
            text: response.answer,
            role: "assistant",
            context: sourceFileNames.length > 0 ? sourceFileNames : undefined,
          };
          setMessages((prevMessages) => [...prevMessages, assistantMessage]);
          setUserChats((prevChats) =>
            prevChats
              .map((chat) =>
                chat.id === chatIdForThisRequest
                  ? {
                      ...chat,
                      summary:
                        response.summary ||
                        response.answer.substring(0, 40) ||
                        text.substring(0, 40),
                    }
                  : chat
              )
              .sort(
                (a, b) =>
                  (b.id === chatIdForThisRequest ? 1 : 0) -
                    (a.id === chatIdForThisRequest ? 1 : 0) || 0
              )
          );
        })
        .catch((err: Error) => {
          if (err.name !== "CanceledError" && !controller.signal.aborted) {
            console.error(
              `[handleSendMessage existing] Error postQuery for chat ${chatIdForThisRequest}:`,
              err
            );
            const errorMessage: Message = {
              id: Date.now() + 1,
              chat_id: chatIdForThisRequest,
              text: "Произошла ошибка при обработке вашего запроса.",
              role: "assistant",
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            thinkingChatIdRef.current === chatIdForThisRequest
          ) {
            setThinkingChatId(
              null,
              `handleSendMessage existing chat finally (${chatIdForThisRequest})`
            );
          }
        });
    } else {
      const userMessage: Message = {
        id: Date.now(),
        chat_id: -1,
        text,
        role: "user",
      };
      setOptimisticUserMessageForNewChat(userMessage);
      setMessages([userMessage]);
      setThinkingChatId(-1, "handleSendMessage new chat initial");
      let tempCreatedChatId: number | null = null;

      createChat(currentUserId, text, controller.signal)
        .then((newChat: NewChatResponse) => {
          if (controller.signal.aborted) {
            if (thinkingChatIdRef.current === -1) {
              setThinkingChatId(
                null,
                "handleSendMessage new chat, createChat aborted early"
              );
            }
            return Promise.reject(new Error("Aborted createChat"));
          }
          tempCreatedChatId = newChat.id;
          onSelectChat(newChat.id);
          setUserChats((prev) => [
            { ...newChat, summary: newChat.summary || text.substring(0, 30) },
            ...prev,
          ]);
          setMessages([{ ...userMessage, chat_id: newChat.id }]);
          setOptimisticUserMessageForNewChat(null);
          setThinkingChatId(
            newChat.id,
            `handleSendMessage new chat, after createChat (${newChat.id})`
          );

          return postQuery(
            text,
            currentUserId,
            newChat.id,
            controller.signal
          ).then((response: QueryResponse) => {
            if (controller.signal.aborted) return;
            const sourceFileNames = response.context
              .map((item) => item.source)
              .filter(
                (source): source is string =>
                  typeof source === "string" && source !== "unknown"
              );
            const assistantMessage: Message = {
              id: Date.now() + 1,
              chat_id: newChat.id,
              text: response.answer,
              role: "assistant",
              context: sourceFileNames.length > 0 ? sourceFileNames : undefined,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            onSelectChat(newChat.id);
            setUserChats((prevChats) =>
              prevChats.map((chat) =>
                chat.id === newChat.id
                  ? {
                      ...chat,
                      summary:
                        response.summary ||
                        response.answer.substring(0, 40) ||
                        text.substring(0, 40),
                    }
                  : chat
              )
            );
          });
        })
        .catch((err: Error) => {
          if (err.message === "Aborted createChat") return;
          if (err.name !== "CanceledError" && !controller.signal.aborted) {
            console.error(
              `[handleSendMessage new] Error in createChat/postQuery chain:`,
              err
            );
            onSelectChat(null);
            setOptimisticUserMessageForNewChat(null);
            setMessages([]);
          }
        })
        .finally(() => {
          const idBeingThoughtAbout =
            tempCreatedChatId !== null ? tempCreatedChatId : -1;
          if (
            !controller.signal.aborted &&
            thinkingChatIdRef.current === idBeingThoughtAbout
          ) {
            setThinkingChatId(
              null,
              `handleSendMessage new chat finally (${idBeingThoughtAbout})`
            );
          }
        });
    }
  };

  const isMessageInputDisabled = () => {
    if (thinkingChatIdRef.current !== null) return true;
    return false;
  };

  const pageVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        position: "relative",
        backgroundColor: isAnimatedBgEnabled
          ? "transparent"
          : "background.default",
      }}
    >
      {isAnimatedBgEnabled && <AnimatedBackground />}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 280 : 0,
          marginLeft: isSidebarOpen ? 0 : -1,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          flexShrink: 0,
          backgroundColor: theme.palette.background.paper.toString(),
          borderRight: `1px solid ${theme.palette.divider.toString()}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      >
        <GoogleAuthButton
         currentUserId={currentUserId}/>
        <ChatList
          chats={userChats}
          selectedChatId={selectedChatId}
          onSelectChat={onSelectChat}
          onNewChat={() => {
            queryAbortControllerRef.current?.abort();
            setThinkingChatId(null, "onNewChat");
            setOptimisticUserMessageForNewChat(null);
            onSelectChat(null);
            setMessages([]);
          }}
          currentUserId={currentUserId}
          onSelectUser={onSelectUser}
          isAnimatedBgEnabled={isAnimatedBgEnabled}
          onToggleAnimatedBg={onToggleAnimatedBg}
          themeName={themeName}
          onThemeChange={onThemeChange}
          onChatDeleted={handleChatDeleted}
        />
      </motion.aside>
      <Box
        component="main"
        sx={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          zIndex: 1,
          position: "relative",
        }}
      >
        <IconButton
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            width: "fit-content",
            bgcolor: "rgba(0,0,0,0.2)",
            "&:hover": { bgcolor: "rgba(0,0,0,0.4)" },
          }}
        >
          {isSidebarOpen ? <KeyboardArrowLeft /> : <KeyboardArrowRight />}
        </IconButton>

        <AnimatePresence mode="wait">
          {isWelcomeLayout ? (
            <motion.div
              key="welcome"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                gap: "35px",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0,
                  width: "100%",
                  maxWidth: "900px",
                  px: 2,
                }}
              >
                <Welcome />
                <Box sx={{ width: "100%" }}>
                  <MessageInput
                    chatId={selectedChatId}
                    onSendMessage={handleSendMessage}
                    disabled={isMessageInputDisabled()}
                  />
                </Box>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Button
                  component={Link}
                  to="/speed"
                  variant="contained"
                  sx={{
                    borderRadius: "16px",
                    textTransform: "none",
                    fontWeight: "bold",
                    backgroundColor: "rgba(126, 87, 194, 0.2)",
                    color: "primary.main",
                    "&:hover": {
                      backgroundColor: "rgba(126, 87, 194, 0.3)",
                    },
                  }}
                >
                  osu!speed
                </Button>
              </Box>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <Box
                ref={scrollContainerRef}
                sx={{ flexGrow: 1, overflowY: "auto" }}
              >
                <Box sx={{ maxWidth: "900px", width: "100%", mx: "auto" }}>
                  <ChatView
                    messages={messages}
                    loading={loadingMessages}
                    scrollContainerRef={scrollContainerRef}
                    isBotThinking={
                      thinkingChatIdRef.current === selectedChatId ||
                      (optimisticUserMessageForNewChat !== null &&
                        thinkingChatIdRef.current === -1)
                    }
                  />
                </Box>
              </Box>
              <Box
                sx={{
                  flexShrink: 0,
                  px: 2,
                  pt: 1,
                  pb: 4,
                  bgcolor: isAnimatedBgEnabled
                    ? theme.palette.mode === "dark"
                      ? "rgba(30, 30, 30, 0.7)"
                      : "rgba(255, 255, 255, 0.7)"
                    : "background.default",
                  backdropFilter: isAnimatedBgEnabled ? "blur(8px)" : "none",
                  transition: theme.transitions.create([
                    "background-color",
                    "backdrop-filter",
                  ]),
                }}
              >
                <Box sx={{ maxWidth: "900px", mx: "auto" }}>
                  <MessageInput
                    chatId={selectedChatId}
                    onSendMessage={handleSendMessage}
                    disabled={isMessageInputDisabled()}
                  />
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default MainLayout;
