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
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LinkIcon from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import { animate } from "animejs";

interface MessageInputProps {
  chatId: number | null;
  onSendMessage: (text: string) => void;
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

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFilePreview, setAttachedFilePreview] = useState<string | null>(
    null
  );
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);

  useEffect(() => {

    return () => {
      if (attachedFilePreview) {
        URL.revokeObjectURL(attachedFilePreview);
      }
    };
  }, [attachedFilePreview]);

  const removeAttachment = useCallback(() => {
    setAttachedFile(null);
    setAttachedFilePreview(null);
    setAttachedUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []); 

  useEffect(() => {
    if (!disabled) {
      setValue("");
      removeAttachment();
    }
  }, [chatId, disabled, removeAttachment]);

  const handleAttachmentClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleAttachmentClose = () => {
    setAnchorEl(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      removeAttachment(); // Сначала очищаем старое вложение
      setAttachedFile(file);
      if (file.type.startsWith("image/")) {
        // Создаем новый URL для превью
        setAttachedFilePreview(URL.createObjectURL(file));
      }
    }
    handleAttachmentClose();
  };

  const handleUrlAttach = () => {
    if (urlValue.trim()) {
      removeAttachment();
      setAttachedUrl(urlValue.trim());
    }
    setUrlDialogOpen(false);
    setUrlValue("");
    handleAttachmentClose();
  };

  const handleSend = () => {
    if ((value.trim() || attachedFile || attachedUrl) && !disabled) {
      onSendMessage(value.trim());
      setValue("");
      removeAttachment();
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
  const hasAttachment = attachedFile || attachedUrl;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {hasAttachment && (
        <Paper
          variant="outlined"
          sx={{
            p: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderColor: "primary.main",
            borderRadius: "12px",
          }}
        >
          {attachedFilePreview && (
            <Box
              component="img"
              src={attachedFilePreview}
              alt="Preview"
              sx={{
                maxHeight: "50px",
                maxWidth: "50px",
                borderRadius: "8px",
                mr: 1,
              }}
            />
          )}
          <ListItemText
            primary={attachedFile?.name || "Прикреплена ссылка"}
            secondary={attachedUrl}
            primaryTypographyProps={{
              noWrap: true,
              sx: { fontWeight: "500" },
            }}
            secondaryTypographyProps={{ noWrap: true }}
            sx={{ m: 0 }}
          />
          <IconButton onClick={removeAttachment} size="small">
            <CloseIcon />
          </IconButton>
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
          accept="image/*"
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
          disabled={disabled || (!value.trim() && !hasAttachment)}
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
