import { useEffect, useState } from "react";
import CreateIcon from "@mui/icons-material/Create";
import {
  AddCrowdFundButton,
  CATContainer,
  CrowdfundCardTitle,
  CustomInputField,
  EditCrowdFundButton,
  ModalBody,
  NewCrowdFundFont,
  NewCrowdfundTitle,
  CrowdfundActionButton,
  CrowdfundActionButtonRow,
} from "./Crowdfund-styles";

import { Box, Button, Modal, useTheme } from "@mui/material";
import ReactQuill, { Quill } from "react-quill";
import ImageResize from "quill-image-resize-module-react";
import ShortUniqueId from "short-unique-id";
import AddIcon from "@mui/icons-material/Add";
import "react-quill/dist/quill.snow.css";
import { FileAttachment } from "./FileAttachment";
import { useDispatch, useSelector } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice";
import { objectToBase64 } from "../../utils/toBase64";
import { RootState } from "../../state/store";
import { ATTACHMENT_BASE, UPDATE_BASE } from "../../constants";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween"; // Import the plugin
import duration from "dayjs/plugin/duration";
import { addToHashMap } from "../../state/features/crowdfundSlice";
import { CloseNewUpdateModal } from "../../pages/Crowdfund/Update-styles";

dayjs.extend(isBetween);
dayjs.extend(duration);
Quill.register("modules/imageResize", ImageResize);

const uid = new ShortUniqueId();

const modules = {
  imageResize: {
    parchment: Quill.import("parchment"),
    modules: ["Resize", "DisplaySize"],
  },
  toolbar: [
    ["bold", "italic", "underline", "strike"], // styled text
    ["blockquote", "code-block"], // blocks
    [{ header: 1 }, { header: 2 }], // custom button values
    [{ list: "ordered" }, { list: "bullet" }], // lists
    [{ script: "sub" }, { script: "super" }], // superscript/subscript
    [{ indent: "-1" }, { indent: "+1" }], // outdent/indent
    [{ direction: "rtl" }], // text direction
    [{ size: ["small", false, "large", "huge"] }], // custom dropdown
    [{ header: [1, 2, 3, 4, 5, 6, false] }], // custom button values
    [{ color: [] }, { background: [] }], // dropdown with defaults
    [{ font: [] }], // font family
    [{ align: [] }], // text align
    ["clean"], // remove formatting
    ["image"], // image
  ],
};

interface NewUpdateProps {
  editId?: string;
  editContent?: null | {
    title: string;
    inlineContent: string;
    attachments: any[];
    user: string;
  };
  crowdfundId?: string;
  onSubmit?: (content: any) => void;
  crowdfundName: string;
}
export const NewUpdate = ({
  editId,
  editContent,
  crowdfundId,
  onSubmit,
  crowdfundName,
}: NewUpdateProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const userAddress = useSelector(
    (state: RootState) => state.auth?.user?.address
  );

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [inlineContent, setInlineContent] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    if (editContent) {
      setTitle(editContent?.title);
      setInlineContent(editContent?.inlineContent);
      setAttachments(editContent?.attachments);
    }
  }, [editContent]);

  const onClose = () => {
    setIsOpen(false);
  };

  async function publishQDNResource() {
    try {
      if (!crowdfundId && !editId)
        throw new Error("unable to locate crowdfund id");
      if (!userAddress) throw new Error("Unable to locate user address");
      let errorMsg = "";
      let name = "";
      if (username) {
        name = username;
      }
      if (!name) {
        errorMsg =
          "Cannot publish without access to your name. Please authenticate.";
      }
      if (!title) {
        errorMsg = "Cannot publish without a title";
      }
      if (editId && editContent?.user !== name) {
        errorMsg = "Cannot publish another user's resource";
      }

      if (errorMsg) {
        dispatch(
          setNotification({
            msg: errorMsg,
            alertType: "error",
          })
        );
        return;
      }

      const crowdfundObject: any = {
        title,
        createdAt: Date.now(),
        version: 1,
        attachments: [],
        inlineContent,
      };

      const id = uid();

      const attachmentArray: any[] = [];
      const attachmentArrayToSave: any[] = [];
      for (const attachment of attachments) {
        const alreadyExits = !!attachment?.identifier;

        if (alreadyExits) {
          attachmentArray.push(attachment);
          continue;
        }
        const id = uid();
        const id2 = uid();
        const identifier = `${ATTACHMENT_BASE}${id}_${id2}`;
        const fileExtension = attachment?.name?.split(".")?.pop();
        if (!fileExtension) {
          throw new Error("One of your attachments does not have an extension");
        }
        let service = "FILE";
        const type = attachment?.type;
        if (type.startsWith("audio/")) {
          service = "AUDIO";
        }
        if (type.startsWith("video/")) {
          service = "VIDEO";
        }
        const obj: any = {
          name,
          service,
          filename: attachment.name,
          identifier,
          file: attachment,
          type: attachment?.type,
          size: attachment?.size,
        };

        attachmentArray.push(obj);
        attachmentArrayToSave.push(obj);
      }
      crowdfundObject.attachments = attachmentArray;
      if (attachmentArrayToSave.length > 0) {
        const multiplePublish = {
          action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
          resources: [...attachmentArrayToSave],
        };
        await qortalRequest(multiplePublish);
      }

      const identifier = editId
        ? editId
        : `${UPDATE_BASE}${crowdfundId?.slice(-12)}_${id}`;
      const crowdfundObjectToBase64 = await objectToBase64(crowdfundObject);
      const requestBody2: any = {
        action: "PUBLISH_QDN_RESOURCE",
        name: name,
        service: "DOCUMENT",
        data64: crowdfundObjectToBase64,
        title: title.slice(0, 50),
        // description: description,
        identifier,
      };

      await qortalRequest(requestBody2);
      dispatch(
        setNotification({
          msg: "Update published",
          alertType: "success",
        })
      );
      const objToStore: any = {
        ...crowdfundObject,
        title: title,
        // description: description,
        id: identifier,
        user: name,
        created: Date.now(),
        updated: Date.now(),
      };

      if (editId && onSubmit) {
        onSubmit(objToStore);
      }

      dispatch(addToHashMap(objToStore));

      setTitle("");
      setInlineContent("");
      setAttachments([]);
      setIsOpen(false);
    } catch (error: any) {
      let notificationObj: any = null;
      if (typeof error === "string") {
        notificationObj = {
          msg: error || "Failed to publish crowdfund",
          alertType: "error",
        };
      } else if (typeof error?.error === "string") {
        notificationObj = {
          msg: error?.error || "Failed to publish crowdfund",
          alertType: "error",
        };
      } else {
        notificationObj = {
          msg: error?.message || "Failed to publish crowdfund",
          alertType: "error",
        };
      }
      if (!notificationObj) return;
      dispatch(setNotification(notificationObj));

      throw new Error("Failed to publish crowdfund");
    }
  }

  return (
    <>
      {username && username === crowdfundName && (
        <>
          <CATContainer
            style={{
              alignItems:
                editId && editContent?.user === username
                  ? "flex-start"
                  : "center",
            }}
          >
            {editId && editContent?.user === username ? (
              <EditCrowdFundButton onClick={() => setIsOpen(true)}>
                <>
                  <CreateIcon fontSize="small" />{" "}
                  <CrowdfundCardTitle
                    style={{ marginBottom: 0, fontSize: "17px" }}
                  >
                    Edit update
                  </CrowdfundCardTitle>
                </>
              </EditCrowdFundButton>
            ) : (
              <AddCrowdFundButton onClick={() => setIsOpen(true)}>
                <>
                  <AddIcon fontSize="large" />{" "}
                  <CrowdfundCardTitle>Add an update</CrowdfundCardTitle>
                </>
              </AddCrowdFundButton>
            )}
          </CATContainer>
        </>
      )}

      <Modal
        open={isOpen}
        onClose={onClose}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <ModalBody>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {editId ? (
              <NewCrowdfundTitle>Edit update</NewCrowdfundTitle>
            ) : (
              <NewCrowdfundTitle>Add an update</NewCrowdfundTitle>
            )}
            <CloseNewUpdateModal
              height="25px"
              width="25px"
              color={theme.palette.text.primary}
              onClickFunc={onClose}
            />
          </Box>

          <CustomInputField
            name="title"
            label="Title of update"
            variant="filled"
            value={title}
            onChange={e => setTitle(e.target.value)}
            inputProps={{ maxLength: 180 }}
            multiline
            maxRows={3}
            required
          />

          <NewCrowdFundFont>Add necessary files - optional</NewCrowdFundFont>
          <FileAttachment
            setAttachments={setAttachments}
            attachments={attachments}
          />
          <NewCrowdFundFont>Write out your update</NewCrowdFundFont>
          <ReactQuill
            theme="snow"
            value={inlineContent}
            onChange={setInlineContent}
            modules={modules}
          />
          <CrowdfundActionButtonRow>
            <CrowdfundActionButton
              onClick={() => {
                onClose();
              }}
              variant="outlined"
              color="error"
              style={{ color: "#c92727ff" }}
            >
              Cancel
            </CrowdfundActionButton>
            <CrowdfundActionButton
              variant="contained"
              onClick={() => {
                publishQDNResource();
              }}
            >
              Publish
            </CrowdfundActionButton>
          </CrowdfundActionButtonRow>
        </ModalBody>
      </Modal>
    </>
  );
};
