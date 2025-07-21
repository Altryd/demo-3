import React, { useEffect, useRef, useState, memo } from "react";
import {
  List,
  ListItem,
  CircularProgress,
  Box,
  Paper,
  Avatar,
  Typography,
  Chip,
  Stack,
} from "@mui/material";
import { animate, stagger } from "animejs";
import ReactMarkdown from "react-markdown";
import type { Message } from "../services/api";

import userAvatar from "../assets/osu_asset_pfp.png";
import botAvatar from "../assets/osu_asset_logo.png";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";

const markdownStyles = {
  "& h1, & h2, & h3, & h4, & h5, & h6": {
    marginTop: "8px",
    marginBottom: "8px",
    fontWeight: 600,
  },
  "& p": { margin: 0, lineHeight: "1.5" },
  "& ul, & ol": { paddingLeft: "20px", margin: "8px 0" },
  "& li": { marginBottom: "4px" },
  "& a": { color: "primary.main", textDecoration: "underline" },
};

const ThinkingIndicator: React.FC = () => {
  const dotsRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (dotsRef.current) {
      animate(dotsRef.current.children, {
        opacity: [0.2, 1],
        translateY: [-2, 0],
        duration: 400,
        delay: stagger(150),
        loop: true,
        direction: "alternate",
        easing: "easeInOutQuad",
      });
    }
  }, []);
  return (
    <ListItem
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 1.5,
        mb: 1,
        justifyContent: "flex-start",
      }}
    >
      <Avatar src={botAvatar} sx={{ width: 40, height: 40 }} />
      <Paper
        elevation={3}
        sx={{
          p: "10px 15px",
          borderRadius: "20px 20px 20px 5px",
          backgroundColor: "background.paper",
          maxWidth: "75%",
        }}
      >
        <Box ref={dotsRef} sx={{ display: "flex", gap: "4px" }}>
          {[...Array(3)].map((_, i) => (
            <Box
              key={i}
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "text.secondary",
              }}
            />
          ))}
        </Box>
      </Paper>
      <Box sx={{ flexGrow: 1 }} />
    </ListItem>
  );
};

interface AssistantMessageProps {
  text: string;
  onCharacterTyped: () => void;
}
const AssistantMessage: React.FC<AssistantMessageProps> = ({
  text,
  onCharacterTyped,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  useEffect(() => {
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      onCharacterTyped();
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 5);
    return () => clearInterval(interval);
  }, [text, onCharacterTyped]);
  return <ReactMarkdown>{displayedText}</ReactMarkdown>;
};

interface ChatViewProps {
  messages: Message[];
  loading: boolean;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  isBotThinking: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({
  messages,
  loading,
  scrollContainerRef,
  isBotThinking,
}) => {
  const listRef = useRef<HTMLUListElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (loading) isInitialLoadRef.current = true;
  }, [loading]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleTypingScroll = () => {
    scrollToBottom("auto");
  };

  useEffect(() => {
    if (!loading && listRef.current) {
      const messageElements = listRef.current.querySelectorAll(".chat-message");
      const lastMessage = messageElements[messageElements.length - 1];
      if (lastMessage && !lastMessage.classList.contains("animated")) {
        lastMessage.classList.add("animated");
        animate(lastMessage, {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 400,
          easing: "easeOutQuad",
        });
      }
    }

    if (messages.length > 0) {
      scrollToBottom(isInitialLoadRef.current ? "auto" : "smooth");
    }

    if (!loading) isInitialLoadRef.current = false;
  }, [messages, loading]);

  useEffect(() => {
    if (isBotThinking) {
      scrollToBottom();
    }
  }, [isBotThinking]);

  if (loading && messages.length === 0 && !isBotThinking) {
    return <CircularProgress sx={{ m: 2, display: "block", margin: "auto" }} />;
  }
  if (messages.length === 0 && !isBotThinking) return null;

  const avatarWidth = 40;
  const gap = 1.5 * 8;

  return (
    <Box sx={{ p: 2 }}>
      <List ref={listRef}>
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const shouldAnimateTyping =
            msg.role === "assistant" &&
            index === messages.length - 1 &&
            !isInitialLoadRef.current &&
            !loading;

          const paperMaxWidth = isUser ? "none" : "75%";
          const uniqueContextFiles = msg.context
            ? Array.from(new Set(msg.context))
            : [];

          return (
            <ListItem
              key={`${msg.id}-${index}-${msg.role}`}
              className="chat-message"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                mb: 1,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: `${gap}px`,
                  width: "auto",
                }}
              >
                {!isUser && (
                  <Avatar
                    src={botAvatar}
                    sx={{ width: avatarWidth, height: avatarWidth }}
                  />
                )}
                {isUser && <Box sx={{ flexGrow: 1 }} />}

                <Paper
                  elevation={3}
                  sx={{
                    p: "10px 15px",
                    borderRadius: isUser
                      ? "20px 20px 5px 20px"
                      : "20px 20px 20px 5px",
                    backgroundColor: isUser
                      ? "primary.main"
                      : "background.paper",
                    color: isUser ? "primary.contrastText" : "text.primary",
                    maxWidth: paperMaxWidth,
                    wordBreak: "break-word",
                    ...markdownStyles,
                  }}
                >
                  {shouldAnimateTyping ? (
                    <AssistantMessage
                      text={msg.text}
                      onCharacterTyped={handleTypingScroll}
                    />
                  ) : (
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  )}
                </Paper>

                {!isUser && <Box sx={{ flexGrow: 1 }} />}
                {isUser && (
                  <Avatar
                    src={userAvatar}
                    sx={{ width: avatarWidth, height: avatarWidth }}
                  />
                )}
              </Box>

              {msg.role === "assistant" && uniqueContextFiles.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{
                    pl: !isUser ? `${avatarWidth + gap}px` : undefined,
                    pr: isUser ? `${avatarWidth + gap}px` : undefined,
                    maxWidth: paperMaxWidth,
                    mt: 0.5,
                    width: "auto",
                  }}
                >
                  {uniqueContextFiles.map((fileName, idx) => (
                    <Chip
                      key={`${msg.id}-ctx-${idx}`}
                      icon={<InsertDriveFileOutlinedIcon fontSize="small" />}
                      label={fileName.split(/[/\\]/).pop()}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        mt: 0.5,
                      }}
                    />
                  ))}
                </Stack>
              )}
            </ListItem>
          );
        })}
        {isBotThinking && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </List>
    </Box>
  );
};

export default memo(ChatView);
