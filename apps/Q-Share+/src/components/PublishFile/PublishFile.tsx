import React, { useEffect, useRef, useState } from "react";
import {
  CrowdfundActionButton,
  CrowdfundActionButtonRow,
  CustomInputField,
  ModalBody,
  NewCrowdfundTitle,
  StyledButton,
} from "./Upload-styles";
import { Box, Modal, Typography, useTheme } from "@mui/material";
import RemoveIcon from "@mui/icons-material/Remove";
import ShortUniqueId from "short-unique-id";
import { useDispatch, useSelector } from "react-redux";
import AddBoxIcon from "@mui/icons-material/AddBox";
import { useDropzone } from "react-dropzone";

import { setNotification } from "../../state/features/notificationsSlice";
import { objectToBase64 } from "../../utils/toBase64";
import { RootState } from "../../state/store";
import { QSHARE_FILE_BASE } from "../../constants/Identifiers.ts";
import { MultiplePublish } from "../common/MultiplePublish/MultiplePublishAll";
import { TextEditor } from "../common/TextEditor/TextEditor";
import { extractTextFromHTML } from "../common/TextEditor/utils";
import { allCategoryData } from "../../constants/Categories/1stCategories.ts";
import {
  maxSize,
  titleFormatter,
  titleFormatterOnSave,
} from "../../constants/Misc.ts";
import {
  CategoryList,
  CategoryListRef,
} from "../common/CategoryList/CategoryList.tsx";

const uid = new ShortUniqueId();
const shortuid = new ShortUniqueId({ length: 5 });

interface NewCrowdfundProps {
  editId?: string;
  editContent?: null | {
    title: string;
    user: string;
    coverImage: string | null;
  };
}

interface VideoFile {
  file: File;
  title: string;
  description: string;
  coverImage?: string;
}
export const PublishFile = ({ editId, editContent }: NewCrowdfundProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const [isOpenMultiplePublish, setIsOpenMultiplePublish] = useState(false);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const userAddress = useSelector(
    (state: RootState) => state.auth?.user?.address
  );
  const [files, setFiles] = useState<VideoFile[]>([]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [step, setStep] = useState<string>("videos");
  const [playlistCoverImage, setPlaylistCoverImage] = useState<null | string>(
    null
  );
  const [selectExistingPlaylist, setSelectExistingPlaylist] =
    useState<any>(null);
  const [playlistTitle, setPlaylistTitle] = useState<string>("");
  const [playlistDescription, setPlaylistDescription] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<any>(null);

  const [playlistSetting, setPlaylistSetting] = useState<null | string>(null);
  const [publishes, setPublishes] = useState<any>(null);
  const categoryListRef = useRef<CategoryListRef>(null);

  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 10,
    maxSize,
    onDrop: (acceptedFiles, rejectedFiles) => {
      const formatArray = acceptedFiles.map(item => {
        return {
          file: item,
          title: "",
          description: "",
          coverImage: "",
        };
      });

      setFiles(prev => [...prev, ...formatArray]);

      let errorString = null;
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach(error => {
          if (error.code === "file-too-large") {
            errorString = "File must be under 2GB";
          }
          console.log(`Error with file ${file.name}: ${error.message}`);
        });
      });
      if (errorString) {
        const notificationObj = {
          msg: errorString,
          alertType: "error",
        };

        dispatch(setNotification(notificationObj));
      }
    },
  });

  useEffect(() => {
    if (editContent) {
    }
  }, [editContent]);

  const onClose = () => {
    setIsOpen(false);
  };

  async function publishQDNResource() {
    try {
      if (!categoryListRef.current) throw new Error("No CategoryListRef found");
      if (!userAddress) throw new Error("Unable to locate user address");

      if (!title) throw new Error("Please enter a title");
      if (!description) throw new Error("Please enter a description");
      if (!categoryListRef.current?.getSelectedCategories()[0])
        throw new Error("Please select a category");
      if (files.length === 0) throw new Error("Add at least one file");
      let errorMsg = "";
      let name = "";
      if (username) {
        name = username;
      }
      if (!name) {
        errorMsg =
          "Cannot publish without access to your name. Please authenticate.";
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

      let fileReferences = [];

      let listOfPublishes = [];

      const fullDescription = extractTextFromHTML(description);

      const sanitizeTitle = title
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim()
        .toLowerCase();

      for (const publish of files) {
        const file = publish.file;
        const id = uid();

        const identifier = `${QSHARE_FILE_BASE}${sanitizeTitle.slice(0, 30)}_${id}`;

        const filename = file.name.replaceAll(titleFormatterOnSave, "");

        let metadescription =
          `**${categoryListRef.current?.getCategoriesFetchString()}**` +
          fullDescription.slice(0, 150);

        const requestBodyVideo: any = {
          action: "PUBLISH_QDN_RESOURCE",
          name: name,
          service: "FILE",
          file,
          title: title.slice(0, 50),
          description: metadescription,
          identifier,
          filename,
          tag1: QSHARE_FILE_BASE,
        };
        listOfPublishes.push(requestBodyVideo);
        fileReferences.push({
          filename: file.name,
          identifier,
          name,
          service: "FILE",
          mimetype: file.type,
          size: file.size,
        });
      }

      const idMeta = uid();
      const identifier = `${QSHARE_FILE_BASE}${sanitizeTitle.slice(0, 30)}_${idMeta}`;
      const fileObject: any = {
        title,
        version: 1,
        fullDescription,
        htmlDescription: description,
        commentsId: `${QSHARE_FILE_BASE}_cm_${idMeta}`,
        ...categoryListRef.current?.categoriesToObject(),
        files: fileReferences,
      };

      let metadescription =
        `**${categoryListRef.current?.getCategoriesFetchString()}**` +
        fullDescription.slice(0, 150);

      const crowdfundObjectToBase64 = await objectToBase64(fileObject);
      // Description is obtained from raw data
      const requestBodyJson: any = {
        action: "PUBLISH_QDN_RESOURCE",
        name: name,
        service: "DOCUMENT",
        identifier: identifier + "_metadata",
        data64: crowdfundObjectToBase64,
        title: title.slice(0, 50),
        description: metadescription,
        tag1: QSHARE_FILE_BASE,
        filename: `video_metadata.json`,
      };
      listOfPublishes.push(requestBodyJson);

      const multiplePublish = {
        action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
        resources: [...listOfPublishes],
      };
      setPublishes(multiplePublish);
      setIsOpenMultiplePublish(true);
    } catch (error: any) {
      let notificationObj: any = null;
      if (typeof error === "string") {
        notificationObj = {
          msg: error || "Failed to publish share",
          alertType: "error",
        };
      } else if (typeof error?.error === "string") {
        notificationObj = {
          msg: error?.error || "Failed to publish share",
          alertType: "error",
        };
      } else {
        notificationObj = {
          msg: error?.message || "Failed to publish share",
          alertType: "error",
        };
      }
      if (!notificationObj) return;
      dispatch(setNotification(notificationObj));
    }
  }

  return (
    <>
      {username && (
        <>
          {editId ? null : (
            <StyledButton
              color="primary"
              startIcon={
                <AddBoxIcon
                  sx={{
                    color: "#66C3FE",
                    width: "40px",
                    height: "40px",
                  }}
                />
              }
              onClick={() => {
                setIsOpen(true);
              }}
            >
              share
            </StyledButton>
          )}
        </>
      )}

      <Modal
        open={isOpen}
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
            <NewCrowdfundTitle>Share</NewCrowdfundTitle>
          </Box>

          {step === "videos" && (
            <>
              <Box
                {...getRootProps()}
                sx={{
                  border: "1px dashed gray",
                  padding: 2,
                  textAlign: "center",
                  marginBottom: 2,
                  cursor: "pointer",
                }}
              >
                <input {...getInputProps()} />
                <Typography>
                  Drag and drop files here or click to select files
                </Typography>
              </Box>
              {files.map((file, index) => {
                return (
                  <React.Fragment key={index}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography>{file?.file?.name}</Typography>
                      <RemoveIcon
                        onClick={() => {
                          setFiles(prev => {
                            const copyPrev = [...prev];
                            copyPrev.splice(index, 1);
                            return copyPrev;
                          });
                        }}
                        sx={{
                          cursor: "pointer",
                        }}
                      />
                    </Box>
                  </React.Fragment>
                );
              })}

              {files?.length > 0 && (
                <>
                  <Box
                    sx={{
                      display: "flex",
                      gap: "20px",
                      alignItems: "flex-start",
                    }}
                  >
                    <CategoryList
                      categoryData={allCategoryData}
                      ref={categoryListRef}
                      columns={3}
                    />
                  </Box>
                  <CustomInputField
                    name="title"
                    label="Title of share"
                    variant="filled"
                    value={title}
                    onChange={e => {
                      const value = e.target.value;
                      const formattedValue = value.replace(titleFormatter, "");
                      setTitle(formattedValue);
                    }}
                    inputProps={{ maxLength: 180 }}
                    required
                  />
                  <Typography
                    sx={{
                      fontSize: "18px",
                    }}
                  >
                    Description of share
                  </Typography>
                  <TextEditor
                    inlineContent={description}
                    setInlineContent={value => {
                      setDescription(value);
                    }}
                  />
                </>
              )}
            </>
          )}
          <CrowdfundActionButtonRow>
            <CrowdfundActionButton
              onClick={() => {
                onClose();
              }}
              variant="contained"
              color="error"
            >
              Cancel
            </CrowdfundActionButton>
            <Box
              sx={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
              }}
            >
              <CrowdfundActionButton
                variant="contained"
                onClick={() => {
                  publishQDNResource();
                }}
              >
                Publish
              </CrowdfundActionButton>
            </Box>
          </CrowdfundActionButtonRow>
        </ModalBody>
      </Modal>

      {isOpenMultiplePublish && (
        <MultiplePublish
          isOpen={isOpenMultiplePublish}
          onError={messageNotification => {
            setIsOpenMultiplePublish(false);
            setPublishes(null);
            if (messageNotification) {
              dispatch(
                setNotification({
                  msg: messageNotification,
                  alertType: "error",
                })
              );
            }
          }}
          onSubmit={() => {
            setIsOpenMultiplePublish(false);
            setIsOpen(false);
            setFiles([]);
            setStep("videos");
            setPlaylistCoverImage(null);
            setPlaylistTitle("");
            setPlaylistDescription("");
            setSelectedCategory(null);
            setSelectedSubCategory(null);
            setPlaylistSetting(null);
            categoryListRef.current?.clearCategories();
            dispatch(
              setNotification({
                msg: "Files published",
                alertType: "success",
              })
            );
          }}
          publishes={publishes}
        />
      )}
    </>
  );
};
