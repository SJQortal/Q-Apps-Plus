import * as React from "react";
import { styled, useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useDispatch, useSelector } from "react-redux";
import { CircularProgress } from "@mui/material";
import { MyContext } from "../wrappers/DownloadWrapper";
import { RootState } from "../state/store";
import { setNotification } from "../state/features/notificationsSlice";
import { base64ToUint8Array } from "../utils/toBase64";


const Widget = styled("div")(({ theme }) => ({
  padding: 8,
  borderRadius: 10,
  maxWidth: 350,
  position: "relative",
  zIndex: 1,
  backdropFilter: "blur(40px)",
  background: "skyblue",
  transition: "0.2s all",
  "&:hover": {
    opacity: 0.75,
  },
}));

const CoverImage = styled("div")({
  width: 40,
  height: 40,
  objectFit: "cover",
  overflow: "hidden",
  flexShrink: 0,
  borderRadius: 8,
  backgroundColor: "rgba(0,0,0,0.08)",
  "& > img": {
    width: "100%",
  },
});

interface IAudioElement {
  title: string;
  description?: string;
  author?: string;
  fileInfo?: any;
  postId?: string;
  user?: string;
  children?: React.ReactNode;
  mimeTypeSaved?: string;
  mimeType?: string;
  disable?: boolean;
  mode?: string;
  otherUser?: string;
  customStyles?: any;
  loadStyles?: any
}

interface CustomWindow extends Window {
  showSaveFilePicker: any; // Replace 'any' with the appropriate type if you know it
}

const customWindow = window as unknown as CustomWindow;

export default function FileElement({
  title,
  description,
  author,
  fileInfo,
  children,
  mimeTypeSaved,
  disable,
  customStyles,
  loadStyles = {}
}: IAudioElement) {
  const { downloadVideo } = React.useContext(MyContext);
  const [startedDownload, setStartedDownload] = React.useState<boolean>(false)
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [downloadLoader, setDownloadLoader] = React.useState<any>(false);
  const downloads  = useSelector((state: RootState) => state.global?.downloads);
  const hasCommencedDownload = React.useRef(false);
  const dispatch = useDispatch();
  const reDownload = React.useRef<boolean>(false)
  const status = React.useRef<null | string>(null)

  const isFetchingProperties = React.useRef<boolean>(false)
  const download = React.useMemo(() => {
    if (!downloads || !fileInfo?.identifier) return {};
    const findDownload = downloads[fileInfo?.identifier];

    if (!findDownload) return {};
    return findDownload;
  }, [downloads, fileInfo]);

  const resourceStatus = React.useMemo(() => {
    return download?.status || {};
  }, [download]);

  const handlePlay = async () => {
    if (disable) return;
    hasCommencedDownload.current = true;
    setStartedDownload(true)
    if (
      resourceStatus?.status === "READY"
    ) {
      if (downloadLoader) return;
     
      setDownloadLoader(true);
      let filename = download?.properties?.filename
      let mimeType = download?.properties?.type

      try {
        const { name, service, identifier } = fileInfo;

        const res = await qortalRequest({
          action: "GET_QDN_RESOURCE_PROPERTIES",
          name: name,
          service: service,
          identifier: identifier,
        });
        filename = res?.filename || filename;
        mimeType = res?.mimeType || mimeType || mimeTypeSaved;
      } catch (error) {
        
      }
      try {
        const { name, service, identifier } = fileInfo;
  
          let resData = await qortalRequest({
            action: 'FETCH_QDN_RESOURCE',
            name: name,
            service: service,
            identifier: identifier,
            encoding: 'base64'
          })
        
          let requestEncryptBody: any = {
            action: 'DECRYPT_DATA',
            encryptedData: resData          }
          const resDecrypt = await qortalRequest(requestEncryptBody)

          if (!resDecrypt) throw new Error('Unable to decrypt file')
          const decryptToUnit8Array = base64ToUint8Array(resDecrypt)
          let blob = null
          if (mimeType) {
            blob = new Blob([decryptToUnit8Array], {
              type: mimeType
            })
          } else {
            blob = new Blob([decryptToUnit8Array])
          }

          if (!blob) throw new Error('Unable to build file into blob')
          await qortalRequest({
            action: 'SAVE_FILE',
            blob,
            filename:
              download?.properties?.originalFilename ||
              filename,
            mimeType
          })

       //old
          
        // const url = `/arbitrary/${service}/${name}/${identifier}`;
        // fetch(url)
        //   .then(response => response.blob())
        //   .then(async blob => {

        //     await qortalRequest({
        //       action: "SAVE_FILE",
        //       blob,
        //       filename: filename,
        //       mimeType,
        //     });
        //   })
        //   .catch(error => {
        //     console.error("Error fetching the video:", error);
        //   });
      } catch (error: any) {
        let notificationObj: any = null;
        if (typeof error === "string") {
          notificationObj = {
            msg: error || "Failed to send message",
            alertType: "error",
          };
        } else if (typeof error?.error === "string") {
          notificationObj = {
            msg: error?.error || "Failed to send message",
            alertType: "error",
          };
        } else {
          notificationObj = {
            msg: error?.message || "Failed to send message",
            alertType: "error",
          };
        }
        if (!notificationObj) return;
        dispatch(setNotification(notificationObj));
      } finally {
        setDownloadLoader(false);
      }
      return;
    }

    const { name, service, identifier } = fileInfo;
   
    setIsLoading(true);
    downloadVideo({
      name,
      service,
      identifier,
      properties: {
        ...fileInfo,
      },
    });
  };

  const refetch = React.useCallback(async () => {
    if (!fileInfo) return
    try {
      const { name, service, identifier } = fileInfo;
      isFetchingProperties.current = true
      await qortalRequest({
        action: 'GET_QDN_RESOURCE_PROPERTIES',
        name,
        service,
        identifier
      })
      
    } catch (error) {
      
    } finally {
      isFetchingProperties.current = false
    }
   
  }, [fileInfo])

  const refetchInInterval = ()=> {
    try {
      const interval = setInterval(()=> {
          if(status?.current === 'DOWNLOADED'){
            refetch()
          }
          if(status?.current === 'READY'){
            clearInterval(interval);
          }
         
        }, 7500)
    } catch (error) {
      
    }
  }

  React.useEffect(() => {
    if(resourceStatus?.status){
      status.current = resourceStatus?.status
    }
    if (
      resourceStatus?.status === "READY" &&
      download?.url &&
      download?.properties?.filename &&
      hasCommencedDownload.current
    ) {
      setIsLoading(false);
      dispatch(
        setNotification({
          msg: "Download completed. Click to save file",
          alertType: "info",
        })
      );
    } else  if (
      resourceStatus?.status === 'DOWNLOADED' &&
      reDownload?.current === false
    ) {
      refetchInInterval()
      reDownload.current = true
    }
  }, [resourceStatus, download]);

  return (
    <Box
      onClick={handlePlay}
      sx={{
        width: "100%",
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        ...(customStyles || {}),
      }}
    >
      {children && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            gap: "7px",
          }}
        >
          {children}{" "}
          {((resourceStatus.status && resourceStatus?.status !== "READY") ||
          isLoading) && startedDownload ? (
            <>
              <CircularProgress color="secondary" size={14} />
              <Typography style={{
                ...loadStyles
              }} variant="body2">{`${Math.round(
                resourceStatus?.percentLoaded || 0
              ).toFixed(0)}% loaded`}</Typography>
            </>
          ) : resourceStatus?.status === "READY" ? (
            <>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                }}
                style={{
                  ...loadStyles
                }}
              >
                Click to save
              </Typography>
              {downloadLoader && (
                <CircularProgress color="secondary" size={14} />
              )}
            </>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
