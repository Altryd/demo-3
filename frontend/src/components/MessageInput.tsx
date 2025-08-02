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
import { animate } from "animejs";

export interface AttachmentFile {
  id: string;
  file?: File;
  url?: string;
  preview?: string;
}

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled,
  attachments,
  onAttachmentsChange,
}) => {
  const [value, setValue] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    return () => {
      attachments.forEach((att) => {
        if (att.preview) {
          URL.revokeObjectURL(att.preview);
        }
      });
    };
  }, [attachments]);

  const removeAttachment = (idToRemove: string) => {
    onAttachmentsChange(attachments.filter((att) => att.id !== idToRemove));
  };

  useEffect(() => {
    if (!disabled) {
      setValue("");
      // Родитель теперь отвечает за очистку вложений
    }
  }, [disabled]);

  const handleAttachmentClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleAttachmentClose = () => {
    setAnchorEl(null);
  };

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
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
    handleAttachmentClose();
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
      onAttachmentsChange([...attachments, newAttachment]);
    }
    setUrlDialogOpen(false);
    setUrlValue("");
    handleAttachmentClose();
  };

  const handleSend = () => {
    if ((value.trim() || attachments.length > 0) && !disabled) {
      onSendMessage(value.trim());
      setValue("");
      // Родитель очистит вложения
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
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          hidden
          multiple
          accept="image/*,application/pdf,.doc,.docx,.txt"
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
