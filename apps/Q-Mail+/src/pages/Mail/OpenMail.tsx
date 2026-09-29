import {
    Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@mui/material";
import React, { useEffect } from "react";
import { MyContext } from "../../wrappers/DownloadWrapper";
import { RootState } from "../../state/store";
import { useDispatch, useSelector } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice";
import { fetchAndEvaluateMail } from "../../utils/fetchMail";
import { addToHashMapMail } from "../../state/features/mailSlice";

interface OpenMailProps {
  open: boolean;
  handleClose: (payload?:any) => void;
  children?: React.ReactNode;
  fileInfo?: any;
  mimeTypeSaved?: string;
  disable?: boolean;
  mode?: string;
  otherUser?: string;
  customStyles?: any;
}

export const OpenMail = ({
  open,
  handleClose,
  fileInfo
}: OpenMailProps) => {
  const { downloadVideo } = React.useContext(MyContext);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [startedDownload, setStartedDownload] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const downloads = useSelector((state: RootState) => state.global?.downloads);
  const hasCommencedDownload = React.useRef(false);
  const dispatch = useDispatch();
  const reDownload = React.useRef<boolean>(false);
  const status = React.useRef<null | string>(null);
const [unableToDecrypt, setUnableToDecrypt] = React.useState<boolean>(false)
const [isValid, setIsValid] = React.useState<boolean>(true)

  const saveToHash = (payload: any)=> {
    dispatch(addToHashMapMail(payload))
  }

  const handleFetchMail = async (contentInfo: any, saveToHashFunc: any)=> {
    try {
      const res =  await fetchAndEvaluateMail(contentInfo, saveToHashFunc, username)
      if(res.unableToDecrypt){
        setUnableToDecrypt(true)
      } else if(res.isValid === false){
        setIsValid(false)
      } else {
        handleClose(res)
      }
    } catch (error) {
        
    }
  }

  const isFetchingProperties = React.useRef<boolean>(false);
  const download = React.useMemo(() => {
    if (!downloads || !fileInfo?.identifier) return {};
    const findDownload = downloads[fileInfo?.identifier];

    if (!findDownload) return {};
    return findDownload;
  }, [downloads, fileInfo]);

  const resourceStatus = React.useMemo(() => {
    return download?.status || {};
  }, [download]);


  const handleDownloadMail = async () => {

  
    const { name, service, identifier } = fileInfo;
    try {
        const res = await qortalRequest({
            action: 'GET_QDN_RESOURCE_STATUS',
            name: name,
            service: service,
            identifier: identifier
          })
          if(res?.status === "READY"){
            hasCommencedDownload.current = true;
            handleFetchMail({
                user: name,
                messageIdentifier: identifier,
                content: fileInfo,
                otherUser: name
              }, saveToHash)

              return
          }
    } catch (error) {
        
    }

    setStartedDownload(true);
    if (resourceStatus?.status === "READY" && !hasCommencedDownload.current) {
        hasCommencedDownload.current = true;
        handleFetchMail({
            user: name,
            messageIdentifier: identifier,
            content: fileInfo,
            otherUser: name
          }, saveToHash)
    }


    setIsLoading(true);
    downloadVideo({
      name,
      service,
      identifier,
      properties: {}
    });
  };

  const refetch = React.useCallback(async () => {
    if (!fileInfo) return;
    try {
      const { name, service, identifier } = fileInfo;
      isFetchingProperties.current = true;
      await qortalRequest({
        action: "GET_QDN_RESOURCE_PROPERTIES",
        name,
        service,
        identifier,
      });
    } catch (error) {
    } finally {
      isFetchingProperties.current = false;
    }
  }, [fileInfo]);

  const refetchInInterval = () => {
    try {
      const interval = setInterval(() => {
        if (status?.current === "DOWNLOADED") {
          refetch();
        }
        if (status?.current === "READY") {
          clearInterval(interval);
        }
      }, 7500);
    } catch (error) {}
  };

  React.useEffect(() => {
    if (resourceStatus?.status) {
      status.current = resourceStatus?.status;
    }
    if (
      resourceStatus?.status === "READY" && !hasCommencedDownload.current
    ) {
        const { name, service, identifier } = fileInfo;
        hasCommencedDownload.current = true;
        handleFetchMail({
            user: name,
            messageIdentifier: identifier,
            content: fileInfo,
            otherUser: name
          }, saveToHash)
    } else if (
      resourceStatus?.status === "DOWNLOADED" &&
      reDownload?.current === false
    ) {
      refetchInInterval();
      reDownload.current = true;
    }
  }, [resourceStatus, download]);

  useEffect(()=> {
    handleDownloadMail()
  }, [])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">Mail download status</DialogTitle>
      <DialogContent>
      {unableToDecrypt && (
                 <Typography
                 variant="subtitle2"
                 component="div"
                 sx={{
                   fontSize: "0.875rem",
                 }}
               >
                Unable to decrypt message
                </Typography>
            )}
            {!isValid && (
                 <Typography
                 variant="subtitle2"
                 component="div"
                 sx={{
                   fontSize: "0.875rem",
                 }}
               >
                Message has an invalid format
                </Typography>
            )}
            {}
            {!resourceStatus.status && (isValid && !unableToDecrypt) && (
                  <Box
              
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "8px",
                    borderRadius: "10px",
                  }}
                >
                <CircularProgress color="secondary" />
                <>Downloading Message</>
                </Box>
            )}
        {((resourceStatus.status && resourceStatus?.status !== "READY") && (isValid && !unableToDecrypt)) && (
            <Box
              
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "8px",
                borderRadius: "10px",
              }}
            >
            <CircularProgress color="secondary" />
              {resourceStatus && (
                <Typography
                  variant="subtitle2"
                  component="div"
                  sx={{
                    color: "text.primary",
                    fontSize: "0.875rem",
                  }}
                >
                  {resourceStatus?.status === "REFETCHING" ? (
                    <>
                      <>
                        {(
                          (resourceStatus?.localChunkCount /
                            resourceStatus?.totalChunkCount) *
                          100
                        )?.toFixed(0)}
                        %
                      </>

                      <> Refetching in 2 minutes</>
                    </>
                  ) : resourceStatus?.status === "DOWNLOADED" ? (
                    <>Download Completed: building message...</>
                  ) : resourceStatus?.status === "MISSING_DATA" ? (
                    <>Missing Data: make sure the sender has their Core turned on.</>
                  )  :  resourceStatus?.status === "DOWNLOADING" ? (
                    <>Downloading Message</>
                  ) : resourceStatus?.status !== "READY" ? (
                    <>
                      {(
                        (resourceStatus?.localChunkCount /
                          resourceStatus?.totalChunkCount) *
                        100
                      )?.toFixed(0)}
                      %
                    </>
                  ) : (
                    <>Download Completed: fetching message...</>
                  )}
                </Typography>
              )}
            </Box>
          )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
