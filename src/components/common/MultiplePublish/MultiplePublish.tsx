/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    Box,
    Button,
    CircularProgress,
    Modal,
    Typography,
    useTheme,
  } from "@mui/material";
import React, { useCallback, useEffect, useState, useRef } from "react";
  import { CircleSVG } from "../../../assets/svgs/CircleSVG";
  import { EmptyCircleSVG } from "../../../assets/svgs/EmptyCircleSVG";
import { styled } from "@mui/system";

const getUnsuccessfulPublishes = (value: any) => {
  const unsuccessfulPublishes = value?.error?.unsuccessfulPublishes;
  return Array.isArray(unsuccessfulPublishes) ? unsuccessfulPublishes : [];
};

const getErrorMessage = (error: any) => {
  if (typeof error === "string") return error;
  if (typeof error?.error === "string") return error.error;
  if (typeof error?.message === "string") return error.message;
  return "";
};

interface Publish {
    resources: any[];
    action: string;
}
  
interface MultiplePublishProps {
    publishes: Publish;
    isOpen: boolean;
    onSubmit: ()=> void
    onError: (message?: string)=> void
}
  export const MultiplePublish = ({ publishes, isOpen,  onSubmit, onError}: MultiplePublishProps) => {
    const theme = useTheme();
    const [listOfUnsuccessfulPublishes, setListOfUnSuccessfulPublishes] = useState<
    any[]
  >([]);
    const hasStarted = useRef(false);
    const publish = useCallback(async (pub: any) => {
      return await qortalRequest(pub);
    }, []);
    const [isPublishing, setIsPublishing] = useState(true)
  
    const handlePublish = useCallback(
      async (pub: any) => {
        try {
          setListOfUnSuccessfulPublishes([]);
          setIsPublishing(true)
          const res = await publish(pub);
          const unsuccessfulPublishes = getUnsuccessfulPublishes(res);
          if (unsuccessfulPublishes.length > 0) {
            setListOfUnSuccessfulPublishes(unsuccessfulPublishes);
            return;
          }
          onSubmit();
        } catch (error: any) {
          const errorMessage = getErrorMessage(error);
          const unsuccessfulPublishes = getUnsuccessfulPublishes(error);

          if (errorMessage.toLowerCase().includes("user declined")) {
            onError();
            return;
          }

          if (errorMessage.toLowerCase().includes("timed out")) {
            onError("The request timed out");
            return;
          }

          if (unsuccessfulPublishes.length > 0) {
            setListOfUnSuccessfulPublishes(unsuccessfulPublishes);
            return;
          }

          onError(errorMessage || "Failed to publish resources");
        } finally {
          setIsPublishing(false)
        }
      },
      [onError, onSubmit, publish]
    );
  
    const retry = ()=> {
      let newlistOfMultiplePublishes: any[] = [];
      listOfUnsuccessfulPublishes?.forEach((item)=> {
              const findPub = publishes?.resources.find((res: any)=> res?.identifier === item.identifier)
              if(findPub){
                newlistOfMultiplePublishes.push(findPub)
              }
            })
            const multiplePublish = {
                ...publishes,
              resources: newlistOfMultiplePublishes
            };
            handlePublish(multiplePublish)
    }
  
    const startPublish = useCallback(
      async (pubs: any) => {
        await handlePublish(pubs);
      },
      [handlePublish]
    );
  
    useEffect(() => {
      if (publishes && !hasStarted.current) {
        hasStarted.current = true;
        startPublish(publishes);
      }
    }, [publishes, startPublish]);
  
    
    return (
      <Modal
        open={isOpen}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <ModalBody>
          <Typography id="modal-title" sx={{ fontWeight: 700 }}>
            {isPublishing ? "Publishing…" : "Publish"}
          </Typography>
          <Typography id="modal-description" variant="body2" color="text.secondary">
            {isPublishing
              ? "Confirm the publish in Hub if asked. Each item below is published once."
              : listOfUnsuccessfulPublishes.length > 0
              ? "Some items did not publish."
              : "All items published."}
          </Typography>
          {publishes?.resources?.map((publish: any, index: number) => {
            const unpublished = listOfUnsuccessfulPublishes.map(item => item?.identifier)
            return (
              <Box
                key={publish?.identifier || index}
                sx={{
                  display: "flex",
                  gap: "20px",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography sx={{ minWidth: 0, overflowWrap: "anywhere", fontSize: "0.875rem" }}>
                  {publish?.identifier}
                </Typography>
                {!isPublishing && hasStarted.current ? (
                  <>
                    {!unpublished.includes(publish.identifier) ? (
                  <CircleSVG
                    color={theme.palette.text.primary}
                    height="24px"
                    width="24px"
                  />
                ) : (
                  <EmptyCircleSVG
                    color={theme.palette.text.primary}
                    height="24px"
                    width="24px"
                  />
                )}
                  </>
                ): <CircularProgress size={16} color="secondary"/>}
                
              </Box>
            );
          })}
        {!isPublishing && listOfUnsuccessfulPublishes.length > 0 && (
          <>
             <Typography sx={{
              marginTop: '20px',
              fontSize: '1rem'
             }}>Some files were not published. Please try again. It's important that all the files get published. Maybe wait a couple minutes if the error keeps occurring</Typography>
          <Button variant="contained" sx={{ minHeight: 44, alignSelf: "flex-start" }} onClick={()=> {
            retry()
          }}>Try again</Button>
          </>
        )}
         
        </ModalBody>
      </Modal>
    );
  };
  
  // Colours and radius come from the theme (ground rule 3); the modal fills
  // the width on phones and never exceeds the app's own height.
  export const ModalBody = styled(Box)(({ theme }) => ({
    position: "absolute",
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(92%, 900px)",
    padding: theme.spacing(2, 2.5),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    overflowY: "auto",
    maxHeight: "calc(var(--qmail-app-height, 100dvh) - 32px)",
  }));