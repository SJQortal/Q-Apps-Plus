import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { CircularProgress, Stack, useTheme } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { DisplayHtml } from "../../components/common/DisplayHtml";
import FileElement from "../../components/common/FileElement";
import { setIsLoadingGlobal } from "../../state/features/globalSlice";
import { CROWDFUND_BASE, REVIEW_BASE, UPDATE_BASE } from "../../constants";
import { addToHashMap } from "../../state/features/crowdfundSlice";
import {
  AboutMyCrowdfund,
  BackToHomeButton,
  CoverImage,
  CrowdfundAccordion,
  CrowdfundAccordionDetails,
  CrowdfundAccordionFont,
  CrowdfundAccordionSummary,
  CrowdfundDescriptionRow,
  CrowdfundInlineContentRow,
  CrowdfundPageTitle,
  CrowdfundStatusRow,
  CrowdfundSubTitle,
  CrowdfundSubTitleRow,
  CrowdfundTitleRow,
  MainCol,
  MainContainer,
  NoReviewsFont,
  RatingContainer,
  StyledRating,
} from "../../components/Crowdfund/Crowdfund-styles";
import AudioPlayer from "../../components/common/AudioPlayer";
import { NewCrowdfund } from "../../components/Crowdfund/NewCrowdfund";
import { CommentSection } from "../../components/common/Comments/CommentSection";
import { Donate } from "../../components/common/Donate/Donate";
import { CrowdfundProgress } from "../../components/common/Progress/Progress";
import { Countdown } from "../../components/common/Countdown/Countdown";
import { NewUpdate } from "../../components/Crowdfund/NewUpdate";
import { Update } from "./Update";
import { AccountCircleSVG } from "../../assets/svgs/AccountCircleSVG";
import moment from "moment";
import {
  FileAttachmentContainer,
  FileAttachmentFont,
  PlayerBox,
} from "./Update-styles";
import CoverImageDefault from "../../assets/images/CoverImageDefault.webp";
import { setNotification } from "../../state/features/notificationsSlice";
import { useFetchCrowdfundStatus } from "../../hooks/useFetchCrowdfundStatus";
import { CrowdfundLoader } from "./CrowdfundLoader";
import { ReusableModalStyled } from "../../components/common/Reviews/QFundOwnerReviews-styles";
import { QFundOwnerReviews } from "../../components/common/Reviews/QFundOwnerReviews";
import DonorInfo from "../../components/common/Donate/DonorInfo";
import {
  SearchTransactionResponse,
  searchTransactions,
} from "qortal-app-utils";

export const Crowdfund = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { name, id } = useParams();
  const navigate = useNavigate();

  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );

  const hashMapCrowdfunds = useSelector(
    (state: RootState) => state.crowdfund.hashMapCrowdfunds
  );

  const [rawDonorData, setRawDonorData] = useState<SearchTransactionResponse[]>(
    []
  );
  const [crowdfundData, setCrowdfundData] = useState<any>(null);
  const [currentAtInfo, setCurrentAtInfo] = useState<any>(null);
  const [loadingAtInfo, setLoadingAtInfo] = useState<boolean>(false);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [updatesList, setUpdatesList] = useState<any[]>([]);
  const [atAddressBalance, setAtAddressBalance] = useState<any>(null);
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [openQFundOwnerReviews, setOpenQFundOwnerReviews] =
    useState<boolean>(false);
  const [ownerAvatar, setOwnerAvatar] = useState<string | null>(null);
  const [averageRatingLoader, setAverageRatingLoader] =
    useState<boolean>(false);
  const [averageOwnerRating, setAverageOwnerRating] = useState<number | null>(
    null
  );
  const [ownerRegisteredNumber, setOwnerRegisteredNumber] = useState<
    number | null
  >(null);
  const [blocksRemainingZero, setBlocksRemainingZero] =
    useState<boolean>(false);

  const interval = useRef<any>(null);
  const intervalBalance = useRef<any>(null);
  const endDateRef = useRef<any>(null);

  // Get the AT Address from the crowdfundData
  const atAddress = useMemo(() => {
    return crowdfundData?.deployedAT?.aTAddress || null;
  }, [crowdfundData]);

  const endDate = useMemo(() => {
    if (!currentAtInfo?.sleepUntilHeight || !nodeInfo?.height) return null;
    if (endDateRef.current) return endDateRef.current;

    const diff = +currentAtInfo?.sleepUntilHeight - +nodeInfo.height;
    const end = moment().add(diff, "minutes");
    endDateRef.current = end;
    return end;
  }, [currentAtInfo, nodeInfo]);

  const blocksRemaining = useMemo(() => {
    if (
      (!currentAtInfo?.sleepUntilHeight || !nodeInfo?.height) &&
      !currentAtInfo?.isFinished
    ) {
      return null;
    } else if (currentAtInfo?.isFinished) {
      setBlocksRemainingZero(true);
      return 0;
    } else {
      const diff = +currentAtInfo?.sleepUntilHeight - +nodeInfo.height;
      // If the difference is less than or equal to 0, then the crowdfund has ended and we must check /at/address to look for isFinished property on the response object. If it is true, then the crowdfund has ended. If it is false, then the crowdfund is still in progress, and we don't show the Q-Fund has ended status until then.
      if (diff <= 0) {
        setBlocksRemainingZero(true);
        return 0;
      }
      return diff;
    }
  }, [currentAtInfo, nodeInfo]);

  const editContent = useMemo(() => {
    if (!crowdfundData) return null;
    const content = {
      title: crowdfundData?.title,
      inlineContent: crowdfundData?.inlineContent,
      attachments: crowdfundData?.attachments,
      user: crowdfundData?.user,
      coverImage: crowdfundData?.coverImage || null,
    };
    return content;
  }, [crowdfundData]);

  const getRawDonorData = (address: string) => {
    searchTransactions({
      txType: ["PAYMENT"],
      address,
      confirmationStatus: "BOTH",
    }).then(donorResponse => {
      setRawDonorData(donorResponse);
    });
  };

  const getCurrentAtInfo = React.useCallback(async atAddress => {
    console.log({ atAddress });
    getRawDonorData(atAddress);
    setLoadingAtInfo(true);
    try {
      const url = `/at/${atAddress}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.status === 200) {
        const responseDataSearch = await response.json();
        setCurrentAtInfo(responseDataSearch);
      }
    } catch (error) {
      console.log(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
      setLoadingAtInfo(false);
    }
  }, []);

  const getNodeInfo = React.useCallback(async () => {
    try {
      const url = `/blocks/height`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseDataSearch = await response.json();
      setNodeInfo({ height: responseDataSearch });
    } catch (error) {
      console.log(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, []);

  const getAtAddressInfo = React.useCallback(async atAddress => {
    try {
      const url = `/addresses/balance/${atAddress}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseDataSearch = await response.json();
      setAtAddressBalance(responseDataSearch);
    } catch (error) {
      console.log(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, []);

  const getCrowdfundData = React.useCallback(
    async (name: string, id: string) => {
      try {
        if (!name || !id) return;
        dispatch(setIsLoadingGlobal(true));

        // Get the resource location here
        const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${CROWDFUND_BASE}&limit=1&includemetadata=true&reverse=true&excludeblocked=true&name=${name}&exactmatchnames=true&offset=0&identifier=${id}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseDataSearch = await response.json();

        // Always comes back as an array, so you must find the correct one using array bracket notation
        if (responseDataSearch?.length > 0) {
          let resourceData = responseDataSearch[0];
          resourceData = {
            title: resourceData?.metadata?.title,
            category: resourceData?.metadata?.category,
            categoryName: resourceData?.metadata?.categoryName,
            tags: resourceData?.metadata?.tags || [],
            description: resourceData?.metadata?.description,
            coverImage: resourceData?.metadata?.coverImage,
            created: resourceData?.created,
            updated: resourceData?.updated,
            user: resourceData.name,
            id: resourceData.identifier,
          };

          // Get raw data of the resource here
          const responseData = await qortalRequest({
            action: "FETCH_QDN_RESOURCE",
            name: name,
            service: "DOCUMENT",
            identifier: id,
          });

          if (responseData && !responseData.error) {
            const combinedData = {
              ...resourceData,
              ...responseData,
            };

            setCrowdfundData(combinedData);
            dispatch(addToHashMap(combinedData));
            console.log({ combinedData });
            if (combinedData?.deployedAT?.aTAddress) {
              getCurrentAtInfo(combinedData?.deployedAT?.aTAddress);
              getAtAddressInfo(combinedData?.deployedAT?.aTAddress);
            }
          }
        }
      } catch (error) {
        console.log(error);
      } finally {
        dispatch(setIsLoadingGlobal(false));
      }
    },
    []
  );

  const getUpdates = React.useCallback(async (name: string, id: string) => {
    try {
      if (!name || !id) return;
      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${UPDATE_BASE}${id.slice(
        -12
      )}&limit=0&includemetadata=false&reverse=true&excludeblocked=true&name=${name}&exactmatchnames=true&offset=0`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseDataSearch = await response.json();
      setUpdatesList(responseDataSearch);
    } catch (error) {
      console.log(error);
    }
  }, []);

  const QFundOwnerAvatarUrl = useCallback(async () => {
    try {
      if (name) {
        const url = await qortalRequest({
          action: "GET_QDN_RESOURCE_URL",
          name: name,
          service: "THUMBNAIL",
          identifier: "qortal_avatar",
        });
        console.log({ url });
        setOwnerAvatar(url);
      }
    } catch (error) {
      console.error(error);
    }
  }, [name]);

  // Get the Q-Fund Owner's Avatar
  useEffect(() => {
    QFundOwnerAvatarUrl();
  }, [name]);

  // Custom hook to get the AT Status, AT Achieved or Not, AT Amount, and AT Loading Status. We pass down the blocksRemainingZero state once blocksRemaining is 0 or less than 0. We do this to verify the completion status of the AT.
  const { ATDeployed, ATCompleted, ATLoadingStatus, ATStatus, ATAmount } =
    useFetchCrowdfundStatus(crowdfundData, atAddress, blocksRemainingZero);

  // We get the crowdfund's updates if hashMapCrowdfund changes. This changes when you publish a new update or modify an existing update and if the ATStatus changes inside the useFetchCrowdfundStatus hook.
  useEffect(() => {
    if (name && id) {
      const existingCrowdfund = hashMapCrowdfunds[id];

      if (existingCrowdfund) {
        setCrowdfundData(existingCrowdfund);
        getCurrentAtInfo(existingCrowdfund?.deployedAT?.aTAddress);
        getAtAddressInfo(existingCrowdfund?.deployedAT?.aTAddress);
      } else {
        getCrowdfundData(name, id);
      }
      getUpdates(name, id);
      getNodeInfo();
    }
  }, [id, name, hashMapCrowdfunds, ATStatus]);

  // Check node info every 30 seconds
  const checkNodeInfo = useCallback(() => {
    let isCalling = false;
    interval.current = setInterval(async () => {
      if (isCalling) return;
      isCalling = true;
      const res = await getNodeInfo();
      if (id) {
        const address = hashMapCrowdfunds[id]?.deployedAT?.aTAddress;
        getRawDonorData(address);
      }
      isCalling = false;
    }, 30000);
  }, [getNodeInfo]);

  useEffect(() => {
    checkNodeInfo();

    return () => {
      if (interval?.current) {
        clearInterval(interval.current);
      }
    };
  }, [checkNodeInfo]);

  const checkBalance = useCallback(
    atAddress => {
      let isCalling = false;
      intervalBalance.current = setInterval(async () => {
        if (isCalling) return;
        isCalling = true;
        const res = await getAtAddressInfo(atAddress);
        isCalling = false;
      }, 30000);
    },
    [getAtAddressInfo]
  );

  // Get 100 store reviews from QDN and calculate the average review.
  const getOwnerAverageReview = useCallback(async () => {
    if (!id || !name) return;
    try {
      let ownerNumber: number;
      setAverageRatingLoader(true);
      const shortQFundOwner = name.slice(0, 15);
      const QFundOwnerRegistration = await qortalRequest({
        action: "GET_NAME_DATA",
        name: name,
      });
      // Get the owner's name registered number to be used as a unique variable when creating reviews. This will be passed down to the <AddReview /> component
      if (Object.keys(QFundOwnerRegistration).length > 0) {
        ownerNumber = QFundOwnerRegistration.registered;
        setOwnerRegisteredNumber(ownerNumber);
      } else {
        throw new Error("No registered number found for QFund owner name");
      }
      // Those first three constants will remain the same no matter which crowdfund the owner made
      const query = `${REVIEW_BASE}-${shortQFundOwner}-${ownerNumber}`;
      // Since it the url includes /resources, you know you're fetching the resources and not the raw data
      const url = `/arbitrary/resources/search?service=DOCUMENT&query=${query}&limit=100&includemetadata=false&mode=LATEST&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();
      if (responseData.length === 0) {
        setAverageOwnerRating(null);
        return;
      }
      // Modify resource into data that is more easily used on the front end
      const storeRatingsArray = responseData.map((review: any) => {
        const splitIdentifier = review.identifier.split("-");
        const rating = Number(splitIdentifier[splitIdentifier.length - 1]) / 10;
        return rating;
      });

      // Calculate average rating of the store
      let averageRating =
        storeRatingsArray.reduce((acc: number, curr: number) => {
          return acc + curr;
        }, 0) / storeRatingsArray.length;

      averageRating = Math.ceil(averageRating * 2) / 2;

      setAverageOwnerRating(averageRating);
    } catch (error) {
      console.error(error);
    } finally {
      setAverageRatingLoader(false);
    }
  }, [id, name]);

  // Get average owner rating when id and name is available, and only if the storeId is different from the currentViewedStore when it's not your store, or if storeId is different from currentStore when it is your store. Do this to avoid unnecessary QDN calls.
  useEffect(() => {
    if (id && name) {
      getOwnerAverageReview();
    }
  }, [id, name]);

  useEffect(() => {
    if (!atAddress) return;
    checkBalance(atAddress);

    return () => {
      if (intervalBalance?.current) {
        clearInterval(intervalBalance.current);
      }
    };
  }, [checkBalance, atAddress]);

  // Check if the crowdfund has been modified after its creation. If it has, we prevent the user from donating to the Q-Fund and redirect to homepage.
  useEffect(() => {
    if (crowdfundData?.created && crowdfundData?.updated) {
      if (crowdfundData?.created === crowdfundData?.updated) {
        return;
      } else {
        dispatch(
          setNotification({
            msg: "Q-Fund has been modified after its creation. Please be aware of this!",
            alertType: "error",
          })
        );
      }
    }
  }, [crowdfundData?.created, crowdfundData?.updated]);

  if (!crowdfundData) return null;
  return (
    <>
      <NewCrowdfund editId={id} editContent={editContent} />
      <MainContainer container direction={"row"}>
        <span style={{ position: "relative", width: "inherit" }}>
          <CoverImage src={crowdfundData?.coverImage || CoverImageDefault} />
          <BackToHomeButton
            variant="contained"
            onClick={() => {
              navigate("/");
            }}
          >
            Back To Homepage
          </BackToHomeButton>
        </span>
        <MainCol item xs={12} sm={12} md={6} gap={"15px"}>
          <CrowdfundTitleRow>
            {!ownerAvatar ? (
              <AccountCircleSVG
                color={theme.palette.text.primary}
                width="80"
                height="80"
              />
            ) : (
              <img
                src={ownerAvatar}
                alt="User Avatar"
                width="80"
                height="80"
                style={{
                  borderRadius: "50%",
                  color: theme.palette.text.primary,
                }}
              />
            )}
            <CrowdfundPageTitle>{crowdfundData?.title}</CrowdfundPageTitle>
          </CrowdfundTitleRow>
          {averageRatingLoader ? (
            <CircularProgress />
          ) : (
            <RatingContainer
              onClick={() => {
                setOpenQFundOwnerReviews(true);
              }}
            >
              {!averageOwnerRating ? (
                <NoReviewsFont>
                  No reviews yet. Be the first to review this Q-Fund owner!
                </NoReviewsFont>
              ) : (
                <StyledRating
                  precision={0.5}
                  value={averageOwnerRating}
                  readOnly
                />
              )}
            </RatingContainer>
          )}
          {ATLoadingStatus ? (
            // Loader reusable component with status text
            <CrowdfundLoader status={ATLoadingStatus} />
          ) : (
            <CrowdfundStatusRow
              style={{
                color:
                  ATStatus === "Q-Fund Being Deployed"
                    ? "#F2A74B"
                    : ATStatus === "Q-Fund Goal Achieved"
                    ? "#0aba42"
                    : ATStatus === "Q-Fund Goal Not Achieved"
                    ? "#bc0f0f"
                    : "#f8fd65",

                border:
                  ATStatus === "Q-Fund Being Deployed"
                    ? "1px solid #F2A74B"
                    : ATStatus === "Q-Fund Goal Achieved"
                    ? "1px solid #0aba42"
                    : ATStatus === "Q-Fund Goal Not Achieved"
                    ? "1px solid #bc0f0f"
                    : "1px solid #f8fd65",
              }}
            >{`Status: ${ATStatus}`}</CrowdfundStatusRow>
          )}
          <CrowdfundDescriptionRow>
            {crowdfundData?.description}
          </CrowdfundDescriptionRow>
          <AboutMyCrowdfund>About My Q-Fund</AboutMyCrowdfund>
          <CrowdfundInlineContentRow>
            <DisplayHtml html={crowdfundData?.inlineContent} />
          </CrowdfundInlineContentRow>
        </MainCol>
        <MainCol item xs={12} sm={12} md={6} gap={"17px"}>
          {/* Ensure the AT is still active and not being deployed to display the donate button */}
          {ATLoadingStatus ? (
            // Loader reusable component with status text
            <CrowdfundLoader status={ATLoadingStatus} />
          ) : ATStatus === "Q-Fund Being Deployed" || !currentAtInfo ? null : (
            <>
              {crowdfundData?.deployedAT?.goalValue &&
                !isNaN(atAddressBalance) && (
                  <CrowdfundProgress
                    achieved={ATAmount || null}
                    raised={atAddressBalance}
                    goal={crowdfundData?.deployedAT?.goalValue}
                  />
                )}
              <Countdown
                loadingAtInfo={loadingAtInfo}
                endDate={endDate}
                blocksRemaining={blocksRemaining}
                ATCompleted={ATCompleted}
              />
              <Stack direction={"row"} gap={"25px"}>
                <Donate
                  ATDonationPossible={ATDeployed && !ATCompleted}
                  atAddress={crowdfundData?.deployedAT?.aTAddress}
                  onSubmit={() => {
                    return;
                  }}
                  onClose={() => {
                    return;
                  }}
                />
                <DonorInfo rawDonorData={rawDonorData} />
              </Stack>
            </>
          )}
          <CrowdfundSubTitleRow>
            {crowdfundData?.attachments?.length > 0 && (
              <CrowdfundSubTitle>Attachments</CrowdfundSubTitle>
            )}
          </CrowdfundSubTitleRow>
          {crowdfundData?.attachments?.map(attachment => {
            if (attachment?.service === "AUDIO")
              return (
                <AudioPlayer
                  key={attachment.identifier}
                  fullFile={attachment}
                  filename={attachment.filename}
                  name={attachment.name}
                  identifier={attachment.identifier}
                  service="AUDIO"
                  jsonId={crowdfundData?.id}
                  user={crowdfundData?.user}
                />
              );

            return (
              <>
                <PlayerBox
                  sx={{
                    minHeight: "55px",
                  }}
                >
                  <FileAttachmentContainer>
                    <AttachFileIcon
                      sx={{
                        height: "16px",
                        width: "auto",
                      }}
                    ></AttachFileIcon>
                    <FileAttachmentFont>
                      {attachment?.filename}
                    </FileAttachmentFont>
                    <FileElement
                      fileInfo={attachment}
                      title={attachment?.filename}
                      customStyles={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                      }}
                    >
                      <DownloadIcon />
                    </FileElement>
                  </FileAttachmentContainer>
                </PlayerBox>
              </>
            );
          })}
          {name === username && (
            <NewUpdate crowdfundId={id} crowdfundName={name || ""} />
          )}
          <div style={{ width: "90%" }}>
            {updatesList.map(update => {
              return (
                <CrowdfundAccordion key={update.identifier}>
                  <CrowdfundAccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                  >
                    <CrowdfundAccordionFont>
                      Update for {moment(update.created).format("LLL")}
                    </CrowdfundAccordionFont>
                  </CrowdfundAccordionSummary>
                  <CrowdfundAccordionDetails>
                    <Update updateObj={update} />
                  </CrowdfundAccordionDetails>
                </CrowdfundAccordion>
              );
            })}
          </div>
        </MainCol>
      </MainContainer>
      {/* Comments section */}
      <CrowdfundSubTitleRow style={{ marginTop: "85px" }}>
        <CrowdfundSubTitle>Comments</CrowdfundSubTitle>
      </CrowdfundSubTitleRow>
      <CommentSection postId={id || ""} postName={name || ""} />
      <ReusableModalStyled
        id={"qfund-owner-reviews"}
        customStyles={{
          width: "96%",
          maxWidth: 1200,
          height: "95vh",
          backgroundColor:
            theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
          position: "relative",
          padding: "25px 40px",
          borderRadius: "5px",
          outline: "none",
          overflowY: "auto",
          overflowX: "hidden",
        }}
        open={openQFundOwnerReviews}
      >
        <QFundOwnerReviews
          QFundId={id || ""}
          averageOwnerRating={averageOwnerRating || null}
          QFundOwnerRegisteredNumber={ownerRegisteredNumber || null}
          QFundOwner={name || ""}
          QFundOwnerAvatar={ownerAvatar || ""}
          setOpenQFundOwnerReviews={setOpenQFundOwnerReviews}
        />
      </ReusableModalStyled>
    </>
  );
};
