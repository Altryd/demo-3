import React from "react";
import { Paper, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const DragAndDropOverlay: React.FC = () => {
  const theme = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999, // Очень высокий z-index, чтобы быть поверх всего
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        pointerEvents: "none",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "80%",
          height: "80%",
          maxWidth: "800px",
          maxHeight: "500px",
          border: `3px dashed ${theme.palette.primary.main}`,
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.2)",
        }}
      >
        <UploadFileIcon
          sx={{ fontSize: 80, color: theme.palette.primary.light }}
        />
        <Typography
          variant="h4"
          sx={{ mt: 2, color: "common.white", fontWeight: "bold" }}
        >
          Перетащите файлы сюда
        </Typography>
        <Typography variant="body1" sx={{ color: "grey.400" }}>
          чтобы прикрепить их к сообщению
        </Typography>
      </Paper>
    </motion.div>
  );
};

export default DragAndDropOverlay;
