import AttachFileIcon from "@mui/icons-material/AttachFile";
import { Tooltip, Typography } from "@mui/material";
import React, { CSSProperties, useEffect, useMemo, useState } from "react";
import { getIconsAndLabels } from "../../pages/IssueContent/IssueContent-functions.ts";
import { Issue } from "../../state/features/fileSlice.ts";

interface IssueIconProps {
  iconSrc: string;
  label?: string;
  showBackupIcon?: boolean;
  style?: CSSProperties;
}
export const IssueIcon = ({
  iconSrc,
  label,
  showBackupIcon = true,
  style,
}: IssueIconProps) => {
  const displayFileIcon = !iconSrc && showBackupIcon;
  const widthAndHeight = "50px";
  return (
    <>
      {iconSrc && (
        <Tooltip
          title={<Typography fontSize={16}>{label}</Typography>}
          arrow
          disableHoverListener={!label}
          placement={"top"}
        >
          <img
            src={iconSrc}
            width={style?.width || widthAndHeight}
            height={style?.width || widthAndHeight}
            style={{
              borderRadius: "5px",
              ...style,
            }}
          />
        </Tooltip>
      )}
      {displayFileIcon && (
        <AttachFileIcon
          sx={{
            ...style,
            width: style?.width || widthAndHeight,
            height: style?.width || widthAndHeight,
          }}
        />
      )}
    </>
  );
};

interface IssueIconsProps {
  issueData: Issue;
  showBackupIcon?: boolean;
  style?: CSSProperties;
}

export const IssueIcons = ({
  issueData,
  showBackupIcon = true,
  style,
}: IssueIconsProps) => {
  const [icons, setIcons] = useState<string[]>([]);
  const [iconLabels, setIconLabels] = useState<string[]>([]);

  useMemo(() => {
    if (issueData) {
      getIconsAndLabels(issueData).then(data => {
        const [iconData, labels] = data;
        if (iconData) setIcons(iconData);
        if (labels) setIconLabels(labels);
      });
    }
  }, [issueData]);

  return icons.map((icon, index) => (
    <IssueIcon
      key={icon + index}
      iconSrc={icon}
      label={iconLabels ? iconLabels[index] : ""}
      style={{ ...style }}
      showBackupIcon={showBackupIcon}
    />
  ));
};
