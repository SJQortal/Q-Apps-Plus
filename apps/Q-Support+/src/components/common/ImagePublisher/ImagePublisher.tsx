import ImageUploader from "./ImageUploader.tsx";
import React, { useImperativeHandle, useState } from "react";
import {
  AddCoverImageButton,
  AddLogoIcon,
  CoverImagePreview,
  LogoPreviewRow,
  TimesIcon,
} from "./ImagePublisher-styles.tsx";
import { useTheme } from "@mui/material";

export type ImagePublisherRef = {
  getImageArray: () => string[];
  setImageArray: (imageArray: string[]) => void;
};

interface ImagePublisherProps {
  initialImages?: string[];
}
export const ImagePublisher = React.forwardRef<
  ImagePublisherRef,
  ImagePublisherProps
>(({ initialImages }: ImagePublisherProps, ref) => {
  const theme = useTheme();
  const [imageArray, setImageArray] = useState<string[]>(initialImages || []);

  useImperativeHandle(ref, () => ({
    getImageArray: () => {
      return imageArray;
    },
    setImageArray: (imageArray: string[]) => {
      setImageArray(imageArray);
    },
  }));

  return (
    <>
      {imageArray.length === 0 ? (
        <ImageUploader onPick={(img: string[]) => setImageArray(img)}>
          <AddCoverImageButton variant="contained">
            Add Images
            <AddLogoIcon
              sx={{
                height: "25px",
                width: "auto",
              }}
            ></AddLogoIcon>
          </AddCoverImageButton>
        </ImageUploader>
      ) : (
        <LogoPreviewRow>
          {imageArray.map(
            image =>
              image && <CoverImagePreview src={image} alt="logo" key={image} />
          )}
          <TimesIcon
            color={theme.palette.text.primary}
            onClickFunc={() => setImageArray([])}
            height={"32"}
            width={"32"}
          ></TimesIcon>
        </LogoPreviewRow>
      )}
    </>
  );
});
