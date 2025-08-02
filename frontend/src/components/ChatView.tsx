import React, {
  useEffect,
  useRef,
  useState,
  memo,
  useLayoutEffect,
  type ComponentProps,
} from "react";
import {
  List,
  ListItem,
  CircularProgress,
  Box,
  Paper,
  Avatar,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  motion,
  AnimatePresence,
  type Transition,
  //type Variants,
} from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { Message } from "../services/api";

import remarkGfm from "remark-gfm";

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

// добавление таблиц
const markdownComponents = {
  table: (props: ComponentProps<"table">) => (
    <TableContainer component={Paper} sx={{ my: 2, boxShadow: 3 }}>
      <Table {...props} size="small" />
    </TableContainer>
  ),
  thead: (props: ComponentProps<"thead">) => (
    <TableHead
      {...props}
      sx={{
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.04)",
      }}
    />
  ),
  tbody: (props: ComponentProps<"tbody">) => <TableBody {...props} />,
  tr: (props: ComponentProps<"tr">) => (
    <TableRow
      {...props}
      sx={{
        "&:last-child td, &:last-child th": { border: 0 },
      }}
    />
  ),
  th: (props: ComponentProps<"th">) => {
    const { align, ...rest } = props;
    const muiCompatibleAlign = align === "char" ? undefined : align;
    return (
      <TableCell
        {...rest}
        align={muiCompatibleAlign}
        sx={{ fontWeight: "bold", overflowWrap: "break-word" }}
      />
    );
  },
  td: (props: ComponentProps<"td">) => {
    const { align, ...rest } = props;
    const muiCompatibleAlign = align === "char" ? undefined : align;
    return (
      <TableCell
        {...rest}
        align={muiCompatibleAlign}
        sx={{ overflowWrap: "break-word" }}
      />
    );
  },
};

const ThinkingIndicator: React.FC = () => {
  const dotVariants = {
    initial: {
      y: 0,
    },
    animate: {
      y: -4,
    },
  };

  const transition: Transition = {
    duration: 0.4,
    repeat: Infinity,
    repeatType: "reverse",
    ease: "easeInOut",
  };

  return (
    <ListItem
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 1.5,
        mb: 1,
        justifyContent: "flex-start",
        px: 0,
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
        <motion.div
          style={{ display: "flex", gap: "4px" }}
          initial="initial"
          animate="animate"
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              variants={dotVariants}
              transition={{ ...transition, delay: i * 0.15 }}
            >
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "text.secondary",
                  display: "block",
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </Paper>
      <Box sx={{ flexGrow: 1 }} />
    </ListItem>
  );
};

interface AssistantMessageProps {
  text: string;
  onCharacterTyped: () => void;
  onTypingComplete: () => void;
}
const AssistantMessage: React.FC<AssistantMessageProps> = ({
  text,
  onCharacterTyped,
  onTypingComplete,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  useEffect(() => {
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      onCharacterTyped();
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        onTypingComplete();
      }
    }, 5);
    return () => clearInterval(interval);
  }, [text, onCharacterTyped, onTypingComplete]);
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {displayedText}
    </ReactMarkdown>
  );
};

interface ChatViewProps {
  messages: Message[];
  loading: boolean;
  isBotThinking: boolean;
  messageIdToAnimate: number | null;
  onAnimationComplete: () => void;
  isAnimationEnabled: boolean;
}

const ChatView: React.FC<ChatViewProps> = ({
  messages,
  loading,
  isBotThinking,
  messageIdToAnimate,
  onAnimationComplete,
  isAnimationEnabled,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);
  const hasScrolledUp = useRef(false);
  const listContainerRef = useRef<HTMLUListElement | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    scrollRef.current?.scrollIntoView({ behavior, block: "end" });
  };

  useEffect(() => {
    const container = listContainerRef.current?.parentElement;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight > 50) {
        hasScrolledUp.current = true;
      } else {
        hasScrolledUp.current = false;
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (isInitialLoadRef.current && messages.length > 0) {
      scrollToBottom("auto");
      isInitialLoadRef.current = false;
      return;
    }

    if (!hasScrolledUp.current) {
      scrollToBottom("smooth");
    }
  }, [messages, isBotThinking]);

  useEffect(() => {
    if (messages.length === 0) {
      isInitialLoadRef.current = true;
      hasScrolledUp.current = false;
    }
  }, [messages.length]);

  if (loading && messages.length === 0 && !isBotThinking) {
    return <CircularProgress sx={{ m: 2, display: "block", margin: "auto" }} />;
  }
  if (messages.length === 0 && !isBotThinking) return null;

  const avatarWidth = 40;
  const gap = 1.5 * 8;

  return (
    <Box sx={{ p: 2 }}>
      <List ref={listContainerRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const shouldAnimateTyping = msg.id === messageIdToAnimate;

            const paperMaxWidth = "75%";
            const uniqueContextFiles = msg.context
              ? Array.from(new Set(msg.context))
              : [];

            return (
              <motion.div
                key={msg.id}
                layout
                style={{ willChange: "transform" }}
              >
                <motion.div
                  initial={
                    isAnimationEnabled
                      ? { opacity: 0, y: 20 }
                      : { opacity: 1, y: 0 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <ListItem
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                      mb: 1,
                      px: 0,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-end",
                        gap: `${gap}px`,
                        width: "100%",
                        justifyContent: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      {!isUser && (
                        <Avatar
                          src={botAvatar}
                          sx={{
                            width: avatarWidth,
                            height: avatarWidth,
                            flexShrink: 0,
                          }}
                        />
                      )}

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
                          color: isUser
                            ? "primary.contrastText"
                            : "text.primary",
                          maxWidth: paperMaxWidth,
                          wordBreak: "break-word",
                          ...markdownStyles,
                        }}
                      >
                        {shouldAnimateTyping ? (
                          <AssistantMessage
                            text={msg.text}
                            onCharacterTyped={() => scrollToBottom("smooth")}
                            onTypingComplete={onAnimationComplete}
                          />
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        )}
                      </Paper>

                      {isUser && (
                        <Avatar
                          src={userAvatar}
                          sx={{
                            width: avatarWidth,
                            height: avatarWidth,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Box>

                    {msg.attachments && msg.attachments.length > 0 && (
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
                        {msg.attachments.map((att) => (
                          <Chip
                            key={att.id}
                            icon={
                              <InsertDriveFileOutlinedIcon fontSize="small" />
                            }
                            label={att.file_name || "attachment"}
                            size="small"
                            variant="outlined"
                            component="a"
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            clickable
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              mt: 0.5,
                            }}
                          />
                        ))}
                      </Stack>
                    )}

                    {msg.role === "assistant" &&
                      uniqueContextFiles.length > 0 && (
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
                              icon={
                                <InsertDriveFileOutlinedIcon fontSize="small" />
                              }
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
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <AnimatePresence>
          {isBotThinking && (
            <motion.div layout>
              <ThinkingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={scrollRef} />
      </List>
    </Box>
  );
};

export default memo(ChatView);
