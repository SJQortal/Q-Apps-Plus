import RemoveIcon from "@mui/icons-material/Remove";
import {
  Box,
  MenuItem,
  Modal,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useDispatch, useSelector } from "react-redux";

import ShortUniqueId from "short-unique-id";
import { allCategoryData } from "../../constants/Categories/Categories.ts";
import { QSUPPORT_FILE_BASE } from "../../constants/Identifiers.ts";
import { log, titleFormatter } from "../../constants/Misc.ts";
import { supportedCoins } from "../../constants/PublishFees/FeeData.tsx";
import { CoinType } from "../../constants/PublishFees/FeePricePublish/FeePricePublish.ts";
import { payPublishFeeQORT } from "../../constants/PublishFees/SendFeeFunctions.ts";
import { verifyPayment } from "../../constants/PublishFees/VerifyPayment.ts";
import { ThemeButtonBright } from "../../pages/Home/Home-styles.tsx";
import {
  setEditFile,
  updateFile,
  updateInHashMap,
} from "../../state/features/fileSlice.ts";

import { setNotification } from "../../state/features/notificationsSlice.ts";
import { RootState } from "../../state/store.ts";
import { BountyData, validateBountyInput } from "../../utils/qortalRequests.ts";
import { objectToBase64, objectToFile } from "../../utils/PublishFormatter.ts";
import { isNumber } from "../../utils/utilFunctions.ts";
import {
  AutocompleteQappNames,
  QappNamesRef,
} from "../common/AutocompleteQappNames.tsx";
import {
  CategoryList,
  CategoryListRef,
  getCategoriesFromObject,
} from "../common/CategoryList/CategoryList.tsx";
import {
  ImagePublisher,
  ImagePublisherRef,
} from "../common/ImagePublisher/ImagePublisher.tsx";
import { MultiplePublish } from "../common/MultiplePublish/MultiplePublishAll.js";
import { TextEditor } from "../common/TextEditor/TextEditor.js";
import { extractTextFromHTML } from "../common/TextEditor/utils.js";
import {
  ActionButton,
  CrowdfundActionButtonRow,
  CustomInputField,
  ModalBody,
  NewCrowdfundTitle,
} from "./EditIssue-styles.tsx";

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
  identifier?: string;
  filename?: string;
}

export const EditIssue = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const userAddress = useSelector(
    (state: RootState) => state.auth?.user?.address
  );
  const editIssueProperties = useSelector(
    (state: RootState) => state.file.editFileProperties
  );
  const QappNames = useSelector(
    (state: RootState) => state.file.publishedQappNames
  );

  const [publishes, setPublishes] = useState<any>(null);
  const bountyData = editIssueProperties?.bountyData;
  const [bounty, setBounty] = useState<string>("");
  const [sourceCode, setSourceCode] = useState<string>("");
  const [isOpenMultiplePublish, setIsOpenMultiplePublish] = useState(false);
  const [videoPropertiesToSetToRedux, setVideoPropertiesToSetToRedux] =
    useState(null);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [coverImage, setCoverImage] = useState<string>("");
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState<VideoFile[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isIssuePaid, setIsIssuePaid] = useState<boolean>(true);

  const [coin, setCoin] = useState<CoinType>("QORT");

  const [showCoins, setShowCoins] = useState<boolean>(false);

  const categoryListRef = useRef<CategoryListRef>(null);
  const imagePublisherRef = useRef<ImagePublisherRef>(null);
  const autocompleteRef = useRef<QappNamesRef>(null);

  const { getRootProps, getInputProps } = useDropzone({
    maxFiles: 10,
    maxSize: 419430400, // 400 MB in bytes
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
            errorString = "File must be under 400mb";
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
    if (editIssueProperties) {
      setTitle(editIssueProperties?.title || "");
      setFiles(editIssueProperties?.files || []);
      if (editIssueProperties?.htmlDescription) {
        setDescription(editIssueProperties?.htmlDescription);
      } else if (editIssueProperties?.fullDescription) {
        const paragraph = `<p>${editIssueProperties?.fullDescription}</p>`;
        setDescription(paragraph);
      }

      verifyPayment(editIssueProperties).then(isIssuePaid => {
        setIsIssuePaid(isIssuePaid);
      });
      const categoriesFromEditFile =
        getCategoriesFromObject(editIssueProperties);
      setSelectedCategories(categoriesFromEditFile);
      setBounty(bountyData?.crowdfundLink || bountyData?.amount || "");
      setShowCoins(
        isNumber(editIssueProperties?.bountyData?.amount || undefined)
      );

      if (editIssueProperties?.bountyData?.coinType)
        setCoin(editIssueProperties?.bountyData?.coinType);
      if (editIssueProperties?.bountyData?.sourceCodeLink)
        setSourceCode(editIssueProperties?.bountyData?.sourceCodeLink);
    }
  }, [editIssueProperties]);

  const onClose = () => {
    dispatch(setEditFile(null));
    setVideoPropertiesToSetToRedux(null);
    setFile(null);
    setTitle("");
    setDescription("");
    setCoverImage("");
  };

  async function publishQDNResource(payFee: boolean) {
    try {
      if (bounty) {
        const isValidated = await validateBountyInput(bounty);
        if (!isValidated) throw new Error("Bounty is not valid");
      }

      if (!categoryListRef.current) throw new Error("No CategoryListRef found");
      if (!userAddress) throw new Error("Unable to locate user address");
      if (!description) throw new Error("Please enter a description");
      const allCategoriesSelected = !selectedCategories.includes("");
      if (!allCategoriesSelected)
        throw new Error("All Categories must be selected");

      if (log) console.log("categories", selectedCategories);
      const QappsCategoryID = "3";
      if (
        selectedCategories[0] === QappsCategoryID &&
        !autocompleteRef?.current?.getSelectedValue()
      )
        throw new Error("Select a published Q-App");
      let errorMsg = "";
      let name = "";
      if (username) {
        name = username;
      }
      if (!name) {
        errorMsg =
          "Cannot publish without access to your name. Please authenticate.";
      }

      if (editIssueProperties?.user !== username) {
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

      const sanitizeTitle = title
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim()
        .toLowerCase();

      if (!sanitizeTitle) throw new Error("Please enter a title");
      const fileReferences = [];

      const listOfPublishes = [];
      const fullDescription = extractTextFromHTML(description);

      for (const publish of files) {
        if (publish?.identifier) {
          fileReferences.push(publish);
          continue;
        }
        const file = publish.file;
        const id = uid();

        const identifier = `${QSUPPORT_FILE_BASE}${sanitizeTitle.slice(0, 30)}_${id}`;

        let fileExtension = "";
        const fileExtensionSplit = file?.name?.split(".");
        if (fileExtensionSplit?.length > 1) {
          fileExtension = fileExtensionSplit?.pop() || "";
        }
        const firstPartName = fileExtensionSplit[0];

        let filename = firstPartName.slice(0, 15);

        // Step 1: Replace all white spaces with underscores

        // Replace all forms of whitespace (including non-standard ones) with underscores
        const stringWithUnderscores = filename.replace(/[\s\uFEFF\xA0]+/g, "_");

        // Remove all non-alphanumeric characters (except underscores)
        const alphanumericString = stringWithUnderscores.replace(
          /[^a-zA-Z0-9_]/g,
          ""
        );

        if (fileExtension) {
          filename = `${alphanumericString.trim()}.${fileExtension}`;
        } else {
          filename = alphanumericString;
        }

        const categoryString = `**${categoryListRef.current?.getSelectedCategories()}**`;
        const metadescription = categoryString + fullDescription.slice(0, 150);

        const requestBodyVideo: any = {
          action: "PUBLISH_QDN_RESOURCE",
          name: name,
          service: "FILE",
          file,
          title: title.slice(0, 50),
          description: metadescription,
          identifier,
          filename,
          tag1: QSUPPORT_FILE_BASE,
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
      const selectedQappName = autocompleteRef?.current?.getSelectedValue();

      const isBountyNumber = isNumber(bounty);
      const bountyData: BountyData = {
        amount: isBountyNumber ? Number(bounty) : undefined,
        crowdfundLink: isBountyNumber ? undefined : bounty,
        coinType: coin,
        sourceCodeLink: sourceCode,
      };

      const issueObject: any = {
        title,
        version: editIssueProperties.version,
        fullDescription,
        htmlDescription: description,
        commentsId: editIssueProperties.commentsId,
        ...categoryListRef.current?.categoriesToObject(),
        files: fileReferences,
        images: imagePublisherRef?.current?.getImageArray(),
        QappName: selectedQappName,
        feeData: editIssueProperties?.feeData,
        bountyData,
      };
      if (payFee) {
        const publishFeeResponse = await payPublishFeeQORT("default", "QORT");
        if (!publishFeeResponse) {
          dispatch(
            setNotification({
              msg: "Fee publish rejected by user.",
              alertType: "error",
            })
          );
          return;
        }
        if (log) console.log("feeResponse: ", publishFeeResponse);

        issueObject.feeData = { signature: publishFeeResponse };
        dispatch(updateInHashMap(issueObject)); // shows issue as paid right away?
      }

      const QappNameString = autocompleteRef?.current?.getQappNameFetchString();
      const categoryString =
        categoryListRef.current?.getCategoriesFetchString(selectedCategories);
      const metaDataString = `**${categoryString + QappNameString}**`;

      const metadescription = metaDataString + fullDescription.slice(0, 150);
      if (log) console.log("description is: ", metadescription);
      if (log) console.log("description length is: ", metadescription.length);
      if (log) console.log("characters left:", 240 - metadescription.length);
      if (log)
        console.log("% of characters used:", metadescription.length / 240);

      // Description is obtained from raw data
      const requestBodyJson: any = {
        action: "PUBLISH_QDN_RESOURCE",
        name: name,
        service: "DOCUMENT",
        data64: await objectToBase64(issueObject),
        title: title.slice(0, 50),
        description: metadescription,
        identifier: editIssueProperties.id,
        tag1: QSUPPORT_FILE_BASE,
        filename: `video_metadata.json`,
      };
      listOfPublishes.push(requestBodyJson);

      const multiplePublish = {
        action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
        resources: [...listOfPublishes],
      };
      setPublishes(multiplePublish);
      setIsOpenMultiplePublish(true);
      setVideoPropertiesToSetToRedux({
        ...editIssueProperties,
        ...issueObject,
      });
    } catch (error: any) {
      console.log("error is: ", error);
      if (error === "User declined request") return;

      let notificationObj: any = null;
      if (typeof error === "string") {
        notificationObj = {
          msg: error || "Failed to publish update",
          alertType: "error",
        };
      } else if (typeof error?.error === "string") {
        notificationObj = {
          msg: error?.error || "Failed to publish update",
          alertType: "error",
        };
      } else {
        notificationObj = {
          msg: error?.message || "Failed to publish update",
          alertType: "error",
        };
      }
      if (!notificationObj) return;
      dispatch(setNotification(notificationObj));

      throw new Error("Failed to publish update");
    }
  }

  const isShowQappNameTextField = () => {
    const QappID = "3";
    return selectedCategories[0] === QappID;
  };

  return (
    <>
      <Modal
        open={!!editIssueProperties}
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
            <NewCrowdfundTitle>Update Issue</NewCrowdfundTitle>
          </Box>
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
              <Typography>Click to add more files</Typography>
            </Box>
            {files.map((file, index) => {
              const isExistingFile = !!file?.identifier;
              return (
                <React.Fragment key={index}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography>
                      {isExistingFile ? file.filename : file?.file?.name}
                    </Typography>
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

            <Box
              sx={{
                display: "flex",
                gap: "20px",
                alignItems: "flex-start",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  width: "100%",
                }}
              >
                <CategoryList
                  categoryData={allCategoryData}
                  initialCategories={selectedCategories}
                  columns={3}
                  ref={categoryListRef}
                  showEmptyItem={false}
                  afterChange={newSelectedCategories => {
                    setSelectedCategories(newSelectedCategories);
                  }}
                />
              </Box>
            </Box>
            {isShowQappNameTextField() && (
              <>
                <AutocompleteQappNames
                  ref={autocompleteRef}
                  namesList={QappNames}
                  initialSelection={editIssueProperties?.QappName}
                />
              </>
            )}
            <CustomInputField
              name="q-app-source-code"
              label="Link to Source Code"
              variant="filled"
              value={sourceCode}
              onChange={e => setSourceCode(e.target.value.trim())}
              inputProps={{ maxLength: 200 }}
            />
            <CustomInputField
              name="q-fund-link"
              label="Bounty Amount or Q-Fund Link"
              variant="filled"
              value={bounty}
              onChange={e => {
                const bountyValue = e.target.value.trim();
                setBounty(bountyValue);
                const bountyIsNumber = isNumber(bountyValue);
                setShowCoins(bountyIsNumber);
                if (!bountyIsNumber) setCoin("QORT");
              }}
              inputProps={{ maxLength: 200 }}
            />
            <TextField
              label={"Select Coin"}
              select
              fullWidth
              value={coin}
              onChange={e => setCoin(e.target.value as CoinType)}
              sx={{
                display: showCoins ? "block" : "none",
                width: "20%",
              }}
            >
              {supportedCoins.map((coin, index) => (
                <MenuItem value={coin} key={coin + index}>
                  {coin}
                </MenuItem>
              ))}
            </TextField>
            <ImagePublisher
              ref={imagePublisherRef}
              initialImages={editIssueProperties?.images}
            />
            <CustomInputField
              name="title"
              label="Title of Issue"
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
              Description of Issue
            </Typography>
            <TextEditor
              inlineContent={description}
              setInlineContent={value => {
                setDescription(value);
              }}
            />
          </>

          <CrowdfundActionButtonRow>
            <ActionButton
              onClick={() => {
                onClose();
              }}
              variant="contained"
              color="error"
              sx={{ color: theme.palette.text.primary }}
            >
              Cancel
            </ActionButton>
            <Box
              sx={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
              }}
            >
              {isIssuePaid === false && (
                <ThemeButtonBright
                  variant="contained"
                  onClick={() => {
                    publishQDNResource(true);
                  }}
                  sx={{
                    fontFamily: "Montserrat",
                    fontSize: "16px",
                    fontWeight: 400,
                    letterSpacing: "0.2px",
                  }}
                >
                  Publish Edit with Fee
                </ThemeButtonBright>
              )}

              <ThemeButtonBright
                variant="contained"
                onClick={() => {
                  publishQDNResource(false);
                }}
                sx={{
                  fontFamily: "Montserrat",
                  fontSize: "16px",
                  fontWeight: 400,
                  letterSpacing: "0.2px",
                }}
              >
                Publish Edit
              </ThemeButtonBright>
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
            const clonedCopy = structuredClone(videoPropertiesToSetToRedux);
            dispatch(updateFile(clonedCopy));
            dispatch(updateInHashMap(clonedCopy));
            dispatch(
              setNotification({
                msg: "Issue updated",
                alertType: "success",
              })
            );
            onClose();
          }}
          publishes={publishes}
        />
      )}
    </>
  );
};
