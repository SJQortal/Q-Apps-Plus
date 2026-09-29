import { Box, Typography } from "@mui/material";
import React from "react";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useDropzone } from "react-dropzone";
import { useDispatch } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice";
import CloseIcon from "@mui/icons-material/Close";

const maxSize = 25 * 1024 * 1024; // 25 MB in bytes
export const FileAttachment = ({ setAttachments, attachments }) => {
  const dispatch = useDispatch();
  const { getRootProps, getInputProps } = useDropzone({
    maxSize,
    onDrop: acceptedFiles => {
      setAttachments(prev => [...prev, ...acceptedFiles]);
    },
    onDropRejected: rejectedFiles => {
      dispatch(
        setNotification({
          msg: "One of your files is over the 50mb limit",
          alertType: "error",
        })
      );
    },
  });

  return (
    <>
      <Box
        {...getRootProps()}
        sx={{
          border: "1px dashed gray",
          padding: 2,
          textAlign: "center",
          marginBottom: 2,
        }}
      >
        <input {...getInputProps()} />
        <AttachFileIcon
          sx={{
            height: "20px",
            width: "auto",
            cursor: "pointer",
          }}
        ></AttachFileIcon>
      </Box>

      <Box>
        {attachments.map((file, index) => {
          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "15px",
              }}
              key={file.name + index}
            >
              <Typography
                sx={{
                  fontSize: "16px",
                }}
              >
                {file?.filename || file?.name}
              </Typography>
              <CloseIcon
                onClick={() =>
                  setAttachments(prev =>
                    prev.filter((item, itemIndex) => itemIndex !== index)
                  )
                }
                sx={{
                  height: "16px",
                  width: "auto",
                  cursor: "pointer",
                }}
              />
            </Box>
          );
        })}
      </Box>
    </>
  );
};
