import * as React from "react";
import { styled } from "@mui/material/styles";
import ArrowForwardIosSharpIcon from "@mui/icons-material/ArrowForwardIosSharp";
import MuiAccordion, { AccordionProps } from "@mui/material/Accordion";
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from "@mui/material/AccordionSummary";
import MuiAccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import { Box, CircularProgress } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { formatFullTimestamp } from "../../utils/time";
import ReadOnlySlate from "../../components/editor/ReadOnlySlate";
import { fetchAndEvaluateMail } from "../../utils/fetchMail";
import { addToHashMapMail } from "../../state/features/mailSlice";
import { AvatarWrapper } from "./MailTable";
import FileElement from "../../components/FileElement";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { MAIL_SERVICE_TYPE } from "../../constants/mail";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";

const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  "&:not(:last-child)": {
    borderBottom: 0,
  },
  "&:before": {
    display: "none",
  },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary
    expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: "16px" }} />}
    {...props}
  />
))(({ theme }) => ({
  backgroundColor: "var(--qmail-thread-summary-bg)",
  flexDirection: "row-reverse",
  "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": {
    transform: "rotate(90deg)",
  },
  "& .MuiAccordionSummary-content": {
    marginLeft: theme.spacing(1),
  },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
  padding: theme.spacing(2),
  borderTop: "1px solid var(--qmail-thread-divider)",
}));

interface IThread {
  identifier: string;
  service: string;
  name: string;
}

export default function MailThreadWithoutCalling({
  thread,
}: {
  thread: IThread[];
}) {
  const [expanded, setExpanded] = React.useState<string | false>("panel1");
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const dispatch = useDispatch();
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  );
  const handleChange =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      setExpanded(newExpanded ? panel : false);
    };

  if (isLoading) return <CircularProgress color="secondary" />;
  return (
    <Box
      sx={{
        width: "100%",
      }}
    >
      {thread?.map((item: any) => {
        const message = item?.data;
        if (!message) return null;

        return (
          <Accordion>
            <AccordionSummary
              aria-controls="panel1d-content"
              id="panel1d-header"
              sx={{
                fontSize: "1rem",
                height: "36px",
              }}
            >
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <AvatarWrapper user={message?.user} />
                  <Typography
                    sx={{
                      fontSize: "1rem",
                    }}
                  >
                    {message?.user}
                  </Typography>
                  <Typography>{message?.description}</Typography>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "1rem",
                    }}
                  >
                    {formatFullTimestamp(message?.createdAt)}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <>
                {message?.attachments?.length > 0 && (
                  <Box
                    sx={{
                      width: "100%",
                      marginTop: "10px",
                      marginBottom: "20px",
                    }}
                  >
                    {message?.attachments.map((file: any) => {
                      return (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            width: "100%",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                              cursor: "pointer",
                              width: "auto",
                            }}
                          >
                            <FileElement
                              fileInfo={{ ...file, mimeTypeSaved: file?.type }}
                              title={file?.filename}
                              mode="mail"
                              otherUser={message?.user}
                            >
                              <AttachFileIcon
                                sx={{
                                  height: "16px",
                                  width: "auto",
                                }}
                              ></AttachFileIcon>
                              <Typography
                                sx={{
                                  fontSize: "1rem",
                                }}
                              >
                                {file?.originalFilename || file?.filename}
                              </Typography>
                            </FileElement>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
                {message?.textContent && (
                  <ReadOnlySlate content={message.textContent} mode="mail" />
                )}
                {message?.textContentV2 && (
                  <DisplayHtml html={message?.textContentV2} />
                )}
              </>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
