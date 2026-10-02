/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import { useCallback, useEffect, useState, useRef } from "react";
import { CircleSVG } from "../../../assets/svgs/CircleSVG";
import { EmptyCircleSVG } from "../../../assets/svgs/EmptyCircleSVG";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { errorMessage, isHubDecline, isHubTimeout } from "../../../utils/hubErrors";

const getUnsuccessfulPublishes = (value: any) => {
  const unsuccessfulPublishes = value?.error?.unsuccessfulPublishes;
  return Array.isArray(unsuccessfulPublishes) ? unsuccessfulPublishes : [];
};


interface Publish {
  resources: any[];
  action: string;
}

interface MultiplePublishProps {
  publishes: Publish;
  isOpen: boolean;
  /** Called once every resource in the batch published (data contract §3). */
  onSubmit: () => void;
  onError: (message?: string) => void;
}

/**
 * Runs one PUBLISH_MULTIPLE_QDN_RESOURCES request and shows each resource's
 * outcome; failed items can be retried without re-publishing the rest. The
 * dialog cannot be dismissed while Hub is asking for the signature.
 */
export const MultiplePublish = ({ publishes, isOpen, onSubmit, onError }: MultiplePublishProps) => {
  const theme = useTheme();
  const [listOfUnsuccessfulPublishes, setListOfUnSuccessfulPublishes] = useState<any[]>([]);
  const hasStarted = useRef(false);
  const publish = useCallback(async (pub: any) => {
    return await qortalRequest(pub);
  }, []);
  const [isPublishing, setIsPublishing] = useState(true);

  const handlePublish = useCallback(
    async (pub: any) => {
      try {
        setListOfUnSuccessfulPublishes([]);
        setIsPublishing(true);
        const res = await publish(pub);
        const unsuccessfulPublishes = getUnsuccessfulPublishes(res);
        if (unsuccessfulPublishes.length > 0) {
          setListOfUnSuccessfulPublishes(unsuccessfulPublishes);
          return;
        }
        onSubmit();
      } catch (error: unknown) {
        const unsuccessfulPublishes = getUnsuccessfulPublishes(error);

        // A decline in any of Hub's languages, or Hub's Cancel, is the user's choice: close quietly.
        if (isHubDecline(error)) {
          onError();
          return;
        }

        if (isHubTimeout(error)) {
          onError("The request timed out");
          return;
        }

        if (unsuccessfulPublishes.length > 0) {
          setListOfUnSuccessfulPublishes(unsuccessfulPublishes);
          return;
        }

        onError(errorMessage(error, "Failed to publish resources"));
      } finally {
        setIsPublishing(false);
      }
    },
    [onError, onSubmit, publish]
  );

  const retry = () => {
    const newlistOfMultiplePublishes: any[] = [];
    listOfUnsuccessfulPublishes?.forEach(item => {
      const findPub = publishes?.resources.find((res: any) => res?.identifier === item.identifier);
      if (findPub) {
        newlistOfMultiplePublishes.push(findPub);
      }
    });
    const multiplePublish = {
      ...publishes,
      resources: newlistOfMultiplePublishes,
    };
    handlePublish(multiplePublish);
  };

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

  const hasFailures = !isPublishing && listOfUnsuccessfulPublishes.length > 0;
  const unpublished = listOfUnsuccessfulPublishes.map(item => item?.identifier);

  return (
    <ResponsiveDialog
      open={isOpen}
      title={isPublishing ? "Publishing…" : hasFailures ? "Some items did not publish" : "Published"}
      describedBy="qmail-publish-description"
      maxWidth="sm"
      actions={
        hasFailures ? (
          <>
            <Button variant="outlined" color="inherit" onClick={() => onError("Some items were not published")}>
              Stop
            </Button>
            <Button variant="contained" onClick={retry}>
              Try again
            </Button>
          </>
        ) : undefined
      }
    >
      <Typography id="qmail-publish-description" variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {isPublishing
          ? "Confirm the publish in Hub if asked. Each item below is published once."
          : hasFailures
          ? "Everything must publish for the message to work. Wait a moment and try again; only the failed items are sent."
          : "All items published."}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {publishes?.resources?.map((publish: any, index: number) => (
          <Box
            key={publish?.identifier || index}
            sx={{ display: "flex", gap: 2, justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography sx={{ minWidth: 0, overflowWrap: "anywhere", fontSize: "0.875rem" }}>
              {publish?.identifier}
            </Typography>
            {!isPublishing && hasStarted.current ? (
              !unpublished.includes(publish.identifier) ? (
                <CircleSVG color={theme.palette.text.primary} height="24px" width="24px" />
              ) : (
                <EmptyCircleSVG color={theme.palette.text.primary} height="24px" width="24px" />
              )
            ) : (
              <CircularProgress size={16} color="secondary" aria-label="Publishing" />
            )}
          </Box>
        ))}
      </Box>
    </ResponsiveDialog>
  );
};
