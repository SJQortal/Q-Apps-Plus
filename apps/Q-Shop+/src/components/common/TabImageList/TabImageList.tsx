import { useState } from "react";
import {
  TabImageContainer,
  TabImageListStyle,
  TabImageStyle
} from "./TabImageList-styles";
import { Box } from "@mui/material";
import CSS from "csstype";

export interface TabImageListProps {
  divStyle?: CSS.Properties;
  imgStyle?: CSS.Properties;
  images: string[] | undefined;
}
const TabImageList = ({
  divStyle = {},
  imgStyle = {},
  images
}: TabImageListProps) => {
  if (images) {
    const [mainImage, setMainImage] = useState<string>(images[0]);
    const [imageFocusedIndex, setImageFocusedIndex] = useState<number>(0);

    const imageTabOutlineStyle = {
      outline: "4px solid #03A9F4"
    };

    const switchMainImage = (index: number) => {
      setMainImage(images[index]);
      setImageFocusedIndex(index);
    };
    const imageRow =
      images.length > 1 ? (
        images.map((image, index) => (
          <TabImageStyle
            style={imageFocusedIndex === index ? imageTabOutlineStyle : {}}
            src={image}
            alt={`Image #${index}`}
            onClick={() => switchMainImage(index)}
            key={image + index.toString()}
          />
        ))
      ) : (
        <div />
      );

    const defaultStyle = { width: "100%" };
    return (
      <TabImageListStyle>
        <Box style={{ ...defaultStyle, ...divStyle }}>
          <img
            style={{ width: "100%", aspectRatio: "1", ...imgStyle }}
            src={mainImage}
            alt="No product image found"
          />
        </Box>
        <TabImageContainer>{imageRow}</TabImageContainer>
      </TabImageListStyle>
    );
  } else {
    return <div />;
  }
};

export default TabImageList;
