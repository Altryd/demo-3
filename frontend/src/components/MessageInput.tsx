import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  TextField,
  IconButton,
  Popover,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Chip,
  Stack,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LinkIcon from "@mui/icons-material/Link";
//import CloseIcon from "@mui/icons-material/Close";
import { animate } from "animejs";

// --- НОВЫЙ ТИП: Определяем, что такое вложение на фронтенде ---
export interface AttachmentFile {
  id: string; // Уникальный ID для ключа в React
  file?: File; // Для локальных файлов
  url?: string; // Для ссылок
  preview?: string; // Для превью изображений
}

interface MessageInputProps {
  chatId: number | null;
  // --- ИЗМЕНЕНИЕ: onSendMessage теперь принимает массив вложений ---
  onSendMessage: (text: string, attachments: AttachmentFile[]) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  chatId,
  onSendMessage,
  disabled,
}) => {
  const [value, setValue] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");

  // --- ИЗМЕНЕНИЕ: Храним массив вложений ---
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  // Очищаем URL превью при размонтировании
  useEffect(() => {
    return () => {
      attachments.forEach((att) => {
        if (att.preview) {
          URL.revokeObjectURL(att.preview);
        }
      });
    };
  }, [attachments]);

  // --- ИЗМЕНЕНИЕ: Функция для очистки всех вложений ---
  const removeAllAttachments = useCallback(() => {
    setAttachments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // --- ИЗМЕНЕНИЕ: Функция для удаления одного вложения по ID ---
  const removeAttachment = (idToRemove: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== idToRemove));
  };

  // Сбрасываем состояние при смене чата или при отключении
  useEffect(() => {
    if (!disabled) {
      setValue("");
      removeAllAttachments();
    }
  }, [chatId, disabled, removeAllAttachments]);

  const handleAttachmentClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleAttachmentClose = () => {
    setAnchorEl(null);
  };

  // --- ИЗМЕНЕНИЕ: Обработка выбора нескольких файлов ---
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newAttachments: AttachmentFile[] = Array.from(files).map(
        (file) => ({
          id: `${file.name}-${file.lastModified}`,
          file: file,
          preview: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        })
      );
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
    handleAttachmentClose();
    // Сбрасываем значение инпута, чтобы можно было выбрать тот же файл снова
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUrlAttach = () => {
    if (urlValue.trim()) {
      const newAttachment: AttachmentFile = {
        id: `url-${Date.now()}`,
        url: urlValue.trim(),
      };
      setAttachments((prev) => [...prev, newAttachment]);
    }
    setUrlDialogOpen(false);
    setUrlValue("");
    handleAttachmentClose();
  };

  const handleSend = () => {
    if ((value.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(value.trim(), attachments);
      setValue("");
      removeAllAttachments();
    }
  };

  const handleMouseEnter = () => {
    if (buttonRef.current && !disabled) {
      animate(buttonRef.current, {
        scale: 1.1,
        duration: 200,
        easing: "easeOutQuad",
      });
    }
  };

  const handleMouseLeave = () => {
    if (buttonRef.current && !disabled) {
      animate(buttonRef.current, {
        scale: 1,
        duration: 200,
        easing: "easeOutQuad",
      });
    }
  };

  const open = Boolean(anchorEl);
  const hasAttachments = attachments.length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* --- ИЗМЕНЕНИЕ: Отображение списка вложений --- */}
      {hasAttachments && (
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            borderColor: "primary.main",
            borderRadius: "12px",
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {attachments.map((att) => (
              <Chip
                key={att.id}
                icon={
                  att.preview ? (
                    <img
                      src={att.preview}
                      alt="preview"
                      height={24}
                      style={{ borderRadius: "4px" }}
                    />
                  ) : undefined
                }
                label={att.file?.name || att.url}
                onDelete={() => removeAttachment(att.id)}
              />
            ))}
          </Stack>
        </Paper>
      )}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          position: "relative",
          top: "13px",
        }}
      >
        {/* --- ИЗМЕНЕНИЕ: Добавлен атрибут multiple --- */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          hidden
          multiple
          accept="image/*,application/pdf,.doc,.docx"
        />
        <IconButton
          onClick={handleAttachmentClick}
          disabled={disabled}
          sx={{ alignSelf: "flex-end", mb: "5px" }}
        >
          <AttachFileIcon />
        </IconButton>

        <TextField
          fullWidth
          variant="outlined"
          placeholder={
            disabled ? "Пожалуйста, подождите..." : "Введите сообщение..."
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !disabled) {
              e.preventDefault();
              handleSend();
            }
          }}
          multiline
          maxRows={5}
          disabled={disabled}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "20px",
              padding: "10px 20px",
              backgroundColor: disabled
                ? "action.disabledBackground"
                : "inherit",
            },
            "& .MuiInputBase-input": {
              padding: 0,
              fontSize: "1.1rem",
            },
          }}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={disabled || (!value.trim() && !hasAttachments)}
          ref={buttonRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{ alignSelf: "flex-end", mb: "5px" }}
        >
          <SendIcon sx={{ fontSize: 30 }} />
        </IconButton>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleAttachmentClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            backgroundColor: "background.paper",
            backgroundImage: "none",
          },
        }}
      >
        <List dense>
          <ListItemButton
            onClick={() => fileInputRef.current?.click()}
            sx={{ py: 1, px: 2 }}
          >
            <ListItemIcon>
              <UploadFileIcon />
            </ListItemIcon>
            <ListItemText primary="Прикрепить с компьютера" />
          </ListItemButton>
          <ListItemButton
            onClick={() => setUrlDialogOpen(true)}
            sx={{ py: 1, px: 2 }}
          >
            <ListItemIcon>
              <LinkIcon />
            </ListItemIcon>
            <ListItemText primary="Ввести URL" />
          </ListItemButton>
        </List>
      </Popover>

      <Dialog
        open={urlDialogOpen}
        onClose={() => setUrlDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: "16px",
            backgroundColor: "background.paper",
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle>Прикрепить ссылку</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="url"
            label="URL адрес"
            type="url"
            fullWidth
            variant="standard"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: "0 24px 12px" }}>
          <Button onClick={() => setUrlDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleUrlAttach} variant="contained">
            Прикрепить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MessageInput;
