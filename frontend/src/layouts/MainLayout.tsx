import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, IconButton, Button, useTheme } from "@mui/material";
import { KeyboardArrowLeft, KeyboardArrowRight } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import ChatList from "../components/ChatList";
import ChatView from "../components/ChatView";
import Welcome from "../components/Welcome";
import MessageInput, { type AttachmentFile } from "../components/MessageInput";
import AnimatedBackground from "../components/AnimatedBackground";
import {
  getChatMessages,
  createChat,
  postQuery,
  getUserChatsById,
  uploadFiles,
} from "../services/api";
import type {
  Message,
  Chat,
  AttachmentCreate,
  AttachmentGet,
} from "../services/api";
import type { ThemeName } from "../themes";

import DragAndDropOverlay from "../components/DragAndDropOverlay";


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

  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const [, _setThinkingChatIdInternal] = useState<number | null>(null);
  const thinkingChatIdRef = useRef<number | null>(null);

  const isFetchingRef = useRef(false);
  const isNewChatFlow = useRef(false);

  const [messageIdToAnimate, setMessageIdToAnimate] = useState<number | null>(
    null
  );

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

  const scrollContainerRef = useRef<HTMLElement>(null);
  const queryAbortControllerRef = useRef<AbortController | null>(null);

  const isWelcomeLayout = selectedChatId === null;

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      dragCounter.current = 0;

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const newAttachments: AttachmentFile[] = files.map((file) => ({
          id: `${file.name}-${file.lastModified}`,
          file: file,
          preview: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        }));
        setAttachments((prev) => [...prev, ...newAttachments]);
        e.dataTransfer.clearData();
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

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
    if (isNewChatFlow.current) {
      return;
    }

    const controller = new AbortController();
    const chatIdToLoad = selectedChatId;
    queryAbortControllerRef.current?.abort();

    setMessageIdToAnimate(null);

    if (chatIdToLoad !== null && !isFetchingRef.current) {
      setLoadingMessages(true);
      getChatMessages(chatIdToLoad, controller.signal)
        .then((fetchedMessages) => {
          if (!controller.signal.aborted) {
            setMessages(fetchedMessages);
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
    } else if (chatIdToLoad === null) {
      setMessages([]);
      setLoadingMessages(false);
    }
  }, [selectedChatId]);

  const handleChatDeleted = (deletedChatId: number) => {
    setUserChats((prevChats) =>
      prevChats.filter((chat) => chat.id !== deletedChatId)
    );
    if (selectedChatId === deletedChatId) {
      onSelectChat(null);
    }
  };

  const handleAnimationComplete = () => {
    setMessageIdToAnimate(null);
  };

  const handleSendMessage = async (text: string) => {
    queryAbortControllerRef.current?.abort();
    const controller = new AbortController();
    queryAbortControllerRef.current = controller;

    let currentChatId = selectedChatId;
    const isNewChat = currentChatId === null;

    const optimisticAttachments: AttachmentGet[] = attachments.map(
      (att, index) => ({
        id: Date.now() + index,
        url: att.preview || att.url || "#",
        file_name: att.file?.name || att.url?.split("/").pop() || "attachment",
        file_type: att.file?.type || "url",
        file_size: att.file?.size,
      })
    );

    const optimisticChatId = currentChatId ?? Date.now();

    const userMessage: Message = {
      id: Date.now(),
      chat_id: optimisticChatId,
      text,
      role: "user",
      attachments: optimisticAttachments,
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setAttachments([]); // Очищаем вложения после оптимистичного рендера

    setThinkingChatId(
      isNewChat ? -1 : currentChatId,
      `handleSendMessage start`
    );

    try {
      isFetchingRef.current = true;

      let attachmentPayload: AttachmentCreate[] | null = null;
      if (attachments.length > 0) {
        const filesToUpload = attachments
          .map((a) => a.file)
          .filter((f): f is File => f !== undefined);
        const urlAttachments = attachments
          .filter((a) => a.url)
          .map((a) => ({ url: a.url!, file_name: a.url!, file_type: "url" }));

        let uploadedFileData: AttachmentCreate[] = [];
        if (filesToUpload.length > 0) {
          uploadedFileData = await uploadFiles(
            filesToUpload,
            controller.signal
          );
        }
        attachmentPayload = [...uploadedFileData, ...urlAttachments];
      }

      if (isNewChat) {
        isNewChatFlow.current = true;
        const newChat = await createChat(
          currentUserId,
          text,
          controller.signal
        );
        if (controller.signal.aborted)
          throw new Error("Aborted after createChat");

        currentChatId = newChat.id;
        onSelectChat(newChat.id);
        setUserChats((prev) => [
          { ...newChat, summary: newChat.summary || text.substring(0, 30) },
          ...prev,
        ]);
        setThinkingChatId(newChat.id, `new chat created (${newChat.id})`);
      }

      if (currentChatId === null) {
        throw new Error(
          "Chat ID is null after attempting to create a new chat."
        );
      }

      const response = await postQuery(
        text,
        currentUserId,
        currentChatId,
        attachmentPayload,
        controller.signal
      );

      const sourceFileNames = response.context
        .map((item) => item.source)
        .filter(
          (source): source is string =>
            typeof source === "string" && source !== "unknown"
        );
      const assistantMessage: Message = {
        id: Date.now() + 1,
        chat_id: currentChatId,
        text: response.answer,
        role: "assistant",
        context: sourceFileNames.length > 0 ? sourceFileNames : undefined,
      };
      setMessageIdToAnimate(assistantMessage.id);
      setMessages((prevMessages) => [
        ...prevMessages.filter((m) => m.id !== userMessage.id),
        userMessage, // Можно обновить userMessage, если бэкенд возвращает его ID
        assistantMessage,
      ]);

      if (
        isNewChat ||
        (response.summary &&
          userChats.find((c) => c.id === currentChatId)?.summary !==
            response.summary)
      ) {
        setUserChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === currentChatId
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
      }
    } catch (err) {
      console.error("[handleSendMessage] Caught an error:", err);
      if (
        err instanceof Error &&
        err.name !== "CanceledError" &&
        !controller.signal.aborted
      ) {
        const errorMessage: Message = {
          id: Date.now() + 1,
          chat_id: currentChatId ?? -1,
          text: "Произошла ошибка при обработке вашего запроса. См. консоль для деталей.",
          role: "assistant",
        };
        setMessages((prev) => [...prev, errorMessage]);
        if (isNewChat) {
          onSelectChat(null);
          setMessages([]);
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setThinkingChatId(null, `handleSendMessage finally`);
        isFetchingRef.current = false;
        isNewChatFlow.current = false;
      }
    }
  };

  const isMessageInputDisabled = () => {
    return thinkingChatIdRef.current !== null;
  };

  const pageVariants: Variants = {
    initial: { opacity: 0, x: 50 },
    animate: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3, ease: "easeInOut" },
    },
    exit: {
      opacity: 0,
      x: -50,
      transition: { duration: 0.3, ease: "easeInOut" },
    },
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
      <AnimatePresence>
        {isDraggingOver && <DragAndDropOverlay />}
      </AnimatePresence>

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
        <ChatList
          chats={userChats}
          selectedChatId={selectedChatId}
          onSelectChat={onSelectChat}
          onNewChat={() => {
            queryAbortControllerRef.current?.abort();
            setThinkingChatId(null, "onNewChat");
            onSelectChat(null);
            setMessages([]);
            setMessageIdToAnimate(null);
            setAttachments([]); // Очищаем вложения при создании нового чата
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
          overflow: "hidden",
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

        <Box
          sx={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AnimatePresence mode="wait">
            {isWelcomeLayout ? (
              <motion.div
                key="welcome"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
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
                      onSendMessage={handleSendMessage}
                      disabled={isMessageInputDisabled()}
                      attachments={attachments}
                      onAttachmentsChange={setAttachments}
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
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
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
                      isBotThinking={thinkingChatIdRef.current !== null}
                      messageIdToAnimate={messageIdToAnimate}
                      onAnimationComplete={handleAnimationComplete}
                      isAnimationEnabled={isAnimatedBgEnabled}
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
                      onSendMessage={handleSendMessage}
                      disabled={isMessageInputDisabled()}
                      attachments={attachments}
                      onAttachmentsChange={setAttachments}
                    />
                  </Box>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
