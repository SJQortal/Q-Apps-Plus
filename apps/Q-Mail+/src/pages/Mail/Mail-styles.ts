import {
  AppBar,
  Button,
  Toolbar,
  Typography,
  Box,
  TextField,
} from "@mui/material";
import { styled } from "@mui/system";

export const InstanceContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  width: "100%",
  backgroundColor: "var(--color-instance)",
  borderBottom: "1px solid var(--qmail-shell-border)",
  height: "59px",
  flexShrink: 0,
  justifyContent: "space-between",
}));
export const MailContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "calc(100vh - 78px)",
  overflow: "hidden",
}));

export const MailBody = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  width: "100%",
  flex: 1,
  minHeight: 0,
  position: 'relative'
  // overflow: 'auto !important'
}));
export const MailBodyInner = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "50%",
  height: "100%",
}));
export const MailBodyInnerHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  height: "25px",
  marginTop: "50px",
  marginBottom: "35px",
  justifyContent: "center",
  alignItems: "center",
  gap: "11px",
}));

export const MailBodyInnerScroll = styled(Box)`
  display: flex;
  flex-direction: column;
  overflow: auto !important;
  transition: background-color 0.3s;
  height: calc(100% - 110px);
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    background-color: transparent; /* Initially transparent */
    transition: background-color 0.3s; /* Transition for background color */
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent; /* Initially transparent */
    border-radius: 3px; /* Scrollbar thumb radius */
    transition: background-color 0.3s; /* Transition for thumb color */
  }

  &:hover {
    &::-webkit-scrollbar {
      background-color: var(--qmail-scroll-track-hover); /* Scrollbar background color on hover */
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--qmail-scroll-thumb-hover); /* Scrollbar thumb color on hover */
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: var(--qmail-scroll-thumb-hover); /* Color when hovering over the thumb */
    }
  }
`;

export const ComposeContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "150px",
  alignItems: "center",
  gap: "7px",
  height: "100%",
  cursor: "pointer",
  transition: "0.2s background-color",
  justifyContent: "center",
  "&:hover": {
    backgroundColor: "var(--qmail-shell-hover-strong)",
  },
}));
export const ComposeContainerBlank = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "150px",
  alignItems: "center",
  gap: "7px",
  height: "100%",
}));
export const ComposeP = styled(Typography)(({ theme }) => ({
  fontSize: "0.9375rem",
  fontWeight: 500,
}));

export const ComposeIcon = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  cursor: "pointer",
  filter: "var(--qmail-shell-icon-filter)",
});
export const ArrowDownIcon = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  cursor: "pointer",
  filter: "var(--qmail-shell-icon-filter)",
});
export const MailIconImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-shell-icon-filter)",
});

export const MailMessageRowInfoImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-shell-icon-filter)",
});

export const SelectInstanceContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "17px",
}));
export const SelectInstanceContainerInner = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "3px",
  cursor: "pointer",
  padding: "8px",
  transition: "all 0.2s",
  "&:hover": {
    borderRadius: "8px",
    background: "var(--qmail-shell-hover)",
  },
}));
export const SelectInstanceContainerFilterInner = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "3px",
  cursor: "pointer",
  padding: "8px",
  transition: "all 0.2s"
}));


export const InstanceLabel = styled(Typography)(({ theme }) => ({
  fontSize: "1rem",
  fontWeight: 500,
  color: "var(--qmail-shell-muted)",
}));

export const InstanceP = styled(Typography)(({ theme }) => ({
  fontSize: "1rem",
  fontWeight: 500,
}));

export const MailMessageRowContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  justifyContent: "space-between",
  width: "100%",
  maxWidth: "100%",
  borderRadius: "56px 5px 10px 56px",
  paddingRight: "15px",
  transition: "background 0.2s",
  gap: "10px",
  "&:hover": {
    background: "var(--qmail-shell-hover)",
  },
}));
export const MailMessageRowProfile = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  justifyContent: "flex-start",
  gap: "10px",
  flex: "0 0 320px",
  maxWidth: "45%",
  minWidth: 0,
  overflow: "hidden",
  "@media (max-width:950px)": {
    flex: "1 1 auto",
    maxWidth: "100%",
    width: "100%",
  },
}));
export const MailMessageRowInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  justifyContent: "flex-start",
  gap: "7px",
  flex: "1 1 auto",
  minWidth: 0,
  "@media (max-width:950px)": {
    width: "100%",
  },
}));
export const MailMessageRowInfoStatusNotDecrypted = styled(Typography)(
  ({ theme }) => ({
    fontSize: "1rem",
    fontWeight: 900,
    textTransform: "uppercase",
    paddingTop: "2px",
  })
);
export const MailMessageRowInfoStatusRead = styled(Typography)(({ theme }) => ({
  fontSize: "1rem",
  fontWeight: 300,
  minWidth: 0,
}));

export const MessageExtraInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  overflow: "hidden",
}));
export const MessageExtraName = styled(Typography)(({ theme }) => ({
  fontSize: "1rem",
  fontWeight: 900,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  overflow: "hidden",
}));
export const MessageExtraDate = styled(Typography)(({ theme }) => ({
  fontSize: "0.9375rem",
  fontWeight: 500,
}));

export const MessagesContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
}));

export const InstanceListParent = styled(Box)`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 246px;
  max-height: 325px;
  max-width: 425px;
  padding: 10px 0px 7px 0px;
  background-color: var(--color-instance-popover-bg);
  border: 1px solid var(--qmail-shell-border);
`;
export const InstanceListHeader = styled(Box)`
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--color-instance-popover-bg);
`;
export const InstanceFooter = styled(Box)`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-shrink: 0;
`;
export const InstanceListContainer = styled(Box)`
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;

  overflow: auto !important;
  transition: background-color 0.3s;
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
    background-color: transparent; /* Initially transparent */
    transition: background-color 0.3s; /* Transition for background color */
  }

  &::-webkit-scrollbar-thumb {
    background-color: transparent; /* Initially transparent */
    border-radius: 3px; /* Scrollbar thumb radius */
    transition: background-color 0.3s; /* Transition for thumb color */
  }

  &:hover {
    &::-webkit-scrollbar {
      background-color: var(--qmail-scroll-track-hover); /* Scrollbar background color on hover */
    }

    &::-webkit-scrollbar-thumb {
      background-color: var(--qmail-scroll-thumb-hover); /* Scrollbar thumb color on hover */
    }

    &::-webkit-scrollbar-thumb:hover {
      background-color: var(--qmail-scroll-thumb-hover); /* Color when hovering over the thumb */
    }
  }
`;
export const InstanceListContainerRowLabelContainer = styled(Box)(
  ({ theme }) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    height: "50px",
  })
);
export const InstanceListContainerRow = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  height: "50px",
  cursor: "pointer",
  transition: "0.2s background",
  "&:hover": {
    background: "var(--qmail-shell-hover-strong)",
  },
  flexShrink: 0,
}));
export const InstanceListContainerRowCheck = styled(Box)(({ theme }) => ({
  width: "47px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));
export const InstanceListContainerRowMain = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  width: "100%",
  alignItems: "center",
  overflow: "hidden",
}));
export const CloseParent = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "20px",
}));
export const InstanceListContainerRowMainP = styled(Typography)(
  ({ theme }) => ({
    fontWeight: 500,
    fontSize: "1rem",
    textOverflow: "ellipsis",
    overflow: "hidden",
  })
);

export const InstanceListContainerRowCheckIcon = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-shell-icon-filter)",
});
export const InstanceListContainerRowGroupIcon = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-shell-icon-filter)",
});
export const TypeInAliasTextfield = styled(TextField)(({ theme }) => ({
  width: "340px", // Adjust the width as needed
  borderRadius: "5px",
  backgroundColor: "var(--qmail-instance-input-bg)",
  border: "none",
  outline: "none",
  input: {
    fontSize: "1rem",
    color: theme.palette.text.primary,
    "&::placeholder": {
      fontSize: "1rem",
      color: "var(--qmail-instance-input-placeholder)",
    },
    border: "none",
    outline: "none",
    padding: "10px",
  },
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    "&:hover fieldset": {
      border: "none",
    },
    "&.Mui-focused fieldset": {
      border: "none",
    },
  },
  "& .MuiInput-underline:before": {
    borderBottom: "none",
  },
  "& .MuiInput-underline:hover:not(.Mui-disabled):before": {
    borderBottom: "none",
  },
  "& .MuiInput-underline:after": {
    borderBottom: "none",
  },
}));

export const NewMessageCloseImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  cursor: "pointer",
  filter: "var(--qmail-shell-icon-filter)",
});
export const NewMessageHeaderP = styled(Typography)(({ theme }) => ({
  fontSize: "1.125rem",
  fontWeight: 600,
}));

export const NewMessageInputRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid var(--qmail-compose-divider)",
  width: "100%",
  paddingBottom: "6px",
  gap: "12px",
  "@media (max-width:950px)": {
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
}));
export const NewMessageInputLabelP = styled(Typography)`
  color: var(--qmail-compose-muted);
  font-size: 1.25rem;
  font-style: normal;
  font-weight: 400;
  line-height: 120%; /* 24px */
  letter-spacing: 0.15px;
`;
export const AliasLabelP = styled(Typography)`
  color: var(--qmail-compose-muted);
  font-size: 1rem;
  font-style: normal;
  font-weight: 500;
  line-height: 120%; /* 24px */
  letter-spacing: 0.15px;
  transition: color 0.2s;
  cursor: pointer;
  &:hover {
    color: var(--qmail-compose-text);
  }
`;
export const NewMessageAliasContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
  "@media (max-width:950px)": {
    flexWrap: "wrap",
    width: "100%",
  },
}));
export const AttachmentContainer = styled(Box)(({ theme }) => ({
  height: "36px",
  width: "100%",
  display: "flex",
  alignItems: "center",
}));

export const NewMessageAttachmentImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  cursor: "pointer",
  padding: "10px",
  border: "1px dashed var(--qmail-compose-attach-border)",
  filter: "var(--qmail-compose-icon-filter)",
});

export const NewMessageSendButton = styled(Box)`
  border-radius: 4px;
  border: 1px solid var(--qmail-action-primary-border);
  display: inline-flex;
  padding: 8px 16px 8px 12px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  width: fit-content;
  transition: all 0.2s;
  color: var(--qmail-action-primary-text);
  background: var(--qmail-action-primary-bg);
  min-width: 120px;
  gap: 8px;
  cursor: pointer;
  &:hover {
    background-color: var(--qmail-action-primary-hover);
    svg path {
      fill: currentColor;
    }
  }
  @media (max-width: 950px) {
    width: 100%;
    min-height: 48px;
    padding: 10px 14px;
    justify-content: space-between;
    border-radius: 12px;
  }
`;

export const NewMessageSendP = styled(Typography)`
  font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
  font-size: 1rem;
  font-style: normal;
  font-weight: 500;
  line-height: 120%; /* 19.2px */
  letter-spacing: -0.16px;
`;

export const ShowMessageNameP = styled(Typography)`
  font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
  font-size: 1rem;
  font-weight: 900;
  line-height: 19px;
  letter-spacing: 0em;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;
export const ShowMessageTimeP = styled(Typography)`
  color: var(--qmail-message-meta);
  font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
  font-size: 0.9375rem;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
`;
export const ShowMessageSubjectP = styled(Typography)`
  font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
  font-size: 1rem;
  font-weight: 500;
  line-height: 19px;
  letter-spacing: 0.0075em;
  text-align: left;
`;

export const ShowMessageButton = styled(Box)`
display: inline-flex;
padding: 8px 16px 8px 16px;
align-items: center;
justify-content: center;
gap: 8px;
width: fit-content;
transition: all 0.2s;
color: var(--qmail-message-button-text);
background-color: var(--qmail-message-button-bg);
min-width: 120px;
gap: 8px;
border-radius: 4px;
border: 0.5px solid var(--qmail-message-button-border);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);

min-width: 120px;
cursor: pointer;
&:hover {
  border-radius: 4px;
border: 0.5px solid var(--qmail-message-button-border);
background:  var(--qmail-message-button-hover);
}
`;
export const ShowMessageReturnButton = styled(Box)`
display: inline-flex;
padding: 8px 16px 8px 16px;
align-items: center;
justify-content: center;
gap: 8px;
width: fit-content;
transition: all 0.2s;
color: var(--qmail-message-button-text);
background-color: var(--qmail-message-button-bg);
min-width: 120px;
gap: 8px;
border-radius: 4px;
border: 0.5px solid var(--qmail-message-button-border);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);

min-width: 120px;
cursor: pointer;
&:hover {
  border-radius: 4px;
border: 0.5px solid var(--qmail-message-button-border);
background:  var(--qmail-message-button-hover);
}
`;

export const ShowMessageButtonP = styled(Typography)`
  font-size: 1rem;
  font-style: normal;
  font-weight: 500;
  line-height: 120%; /* 19.2px */
  letter-spacing: -0.16px;
  color: var(--qmail-message-button-text);
`;

export const ShowMessageButtonImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  cursor: "pointer",
  filter: "var(--qmail-message-icon-filter)",
});

export const MailAttachmentImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-message-icon-filter)",
});
export const AliasAvatarImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-shell-icon-filter)",
});
export const MoreImg = styled("img")({
  width: "auto",
  height: "auto",
  userSelect: "none",
  objectFit: "contain",
  filter: "var(--qmail-message-icon-filter)",
  transition: "0.2s all",
  "&:hover": {
    transform: "scale(1.3)",
  },
});

export const MoreP = styled(Typography)`
  color: var(--qmail-message-meta);

  /* Attachments */
  font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
  font-size: 1rem;
  font-style: normal;
  font-weight: 400;
  line-height: 120%; /* 19.2px */
  letter-spacing: -0.16px;
  white-space: nowrap;
`;
export const ThreadContainerFullWidth = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  alignItems: "center",
}));
export const ThreadContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "1254px",
  maxWidth: "95%",
}));

export const GroupNameP = styled(Typography)`
  color: var(--qmail-thread-text);
  font-size: 1.5625rem;
  font-style: normal;
  font-weight: 700;
  line-height: 120%; /* 30px */
  letter-spacing: 0.188px;
`;

export const AllThreadP = styled(Typography)`
  color: var(--qmail-thread-text);
font-size: 1.25rem;
font-style: normal;
font-weight: 400;
line-height: 120%; /* 24px */
letter-spacing: 0.15px;
`;

export const SingleThreadParent = styled(Box)`
border-radius: 35px 4px 4px 35px;
background: var(--qmail-thread-card-bg);
display: flex;
padding: 13px;
cursor: pointer;
margin-bottom: 5px;
height: 76px;
align-items:center;
transition: 0.2s all;
&:hover {
background: var(--qmail-thread-card-hover)
}
`;
export const SingleTheadMessageParent = styled(Box)`
border-radius: 35px 4px 4px 35px;
background: var(--qmail-thread-card-bg);
display: flex;
padding: 13px;
cursor: pointer;
margin-bottom: 5px;
height: 76px;
align-items:center;

`;

export const ThreadInfoColumn = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "170px",
  gap: '2px',
  marginLeft: '10px',
  height: '100%',
  justifyContent: 'center'
}));


export const ThreadInfoColumnNameP = styled(Typography)`
color: var(--qmail-thread-text);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
font-size: 1rem;
font-style: normal;
font-weight: 900;
line-height: normal;
white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;
export const ThreadInfoColumnbyP = styled('span')`
color: var(--qmail-thread-muted);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
font-size: 1rem;
font-style: normal;
font-weight: 500;
line-height: normal;
`;

export const ThreadInfoColumnTime = styled(Typography)`
color: var(--qmail-thread-muted);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
font-size: 0.9375rem;
font-style: normal;
font-weight: 500;
line-height: normal;
`
export const ThreadSingleTitle = styled(Typography)`
color: var(--qmail-thread-text);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
font-size: 1.4375rem;
font-style: normal;
font-weight: 700;
line-height: normal;
white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`
export const ThreadSingleLastMessageP = styled(Typography)`
color: var(--qmail-thread-text);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
font-size: 0.75rem;
font-style: normal;
font-weight: 600;
line-height: normal;
`
export const ThreadSingleLastMessageSpanP = styled('span')`
color: var(--qmail-thread-text);
font-family: var(--qapp-font-sans, 'Lexend', sans-serif);
font-size: 0.75rem;
font-style: normal;
font-weight: 400;
line-height: normal;
`;

export const GroupContainer = styled(Box)`
position: relative;
        overflow: auto;
        width: 100%;
&::-webkit-scrollbar-track {
  background-color: transparent;
}
&::-webkit-scrollbar-track:hover {
  background-color: transparent;
}

&::-webkit-scrollbar {
  width: 16px;
  height: 10px;
  background-color: var(--qmail-scroll-track-hover);
}

&::-webkit-scrollbar-thumb {
  background-color: var(--qmail-scroll-thumb-hover);
  border-radius: 8px;
  background-clip: content-box;
  border: 4px solid transparent;
}

&::-webkit-scrollbar-thumb:hover {
  background-color: var(--qmail-scroll-thumb-hover);
}

`

export const CloseContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "50px",
  overflow: "hidden",
  alignItems: "center",
  cursor: "pointer",
  transition: "0.2s background-color",
  justifyContent: "center",
  position: 'absolute',
  top: '0px',
  right: '0px',
  height: '50px',
  borderRadius: '0px 12px 0px 0px',
  "&:hover": {
    backgroundColor: "var(--qmail-danger-hover)",
  },
}));
