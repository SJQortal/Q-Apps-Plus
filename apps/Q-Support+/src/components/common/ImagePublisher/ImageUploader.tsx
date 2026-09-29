import React, { useCallback } from "react";
import { Box } from "@mui/material";
import {
  DropzoneInputProps,
  DropzoneRootProps,
  useDropzone,
} from "react-dropzone";
import Compressor from "compressorjs";
import { setNotification } from "../../../state/features/notificationsSlice.ts";
import { useDispatch } from "react-redux";

const toBase64 = (file: File): Promise<string | ArrayBuffer | null> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => {
      reject(error);
    };
  });

interface ImageUploaderProps {
  children: React.ReactNode;
  onPick: (base64Img: string[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  children,
  onPick,
}) => {
  const dispatch = useDispatch();
  const imageLimit = 3;

  const compressImages = async (images: File[]) => {
    const promises = images.map(image => {
      return new Promise<File | Blob>(resolve => {
        new Compressor(image, {
          quality: 0.6,
          maxWidth: 1200,
          mimeType: "image/webp",
          success(result) {
            const file = new File([result], "name", {
              type: "image/webp",
            });
            resolve(result);
          },
          error(err) {},
        });
      });
    });
    return await Promise.all(promises);
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > imageLimit) {
        const notificationObj = {
          msg: `Only ${imageLimit} images can be published`,
          alertType: "error",
        };
        dispatch(setNotification(notificationObj));
        return;
      }

      try {
        const compressedImages = await compressImages(acceptedFiles);
        if (!compressedImages) return;

        const base64Iamges = await Promise.all(
          compressedImages.map(image => toBase64(image as File))
        );

        onPick(base64Iamges as string[]);
      } catch (error) {
        console.error(error);
      }
    },
    [onPick]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  }: {
    getRootProps: () => DropzoneRootProps;
    getInputProps: () => DropzoneInputProps;
    isDragActive: boolean;
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
    },
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        display: "flex",
        width: "170px",
      }}
    >
      <input {...getInputProps()} />
      {children}
    </Box>
  );
};

export default ImageUploader;
