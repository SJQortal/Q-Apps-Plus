import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { Avatar, Grid, Skeleton, useTheme } from "@mui/material";
import { useFetchCrowdfunds } from "../../hooks/useFetchCrowdfunds";
import LazyLoad from "../../components/common/LazyLoad";
import ResponsiveImage from "../../components/ResponsiveImage";
import { formatDate } from "../../utils/time";
import {
  BottomWrapper,
  CardContainer,
  ChannelCard,
  CrowdfundContainer,
  CrowdfundDescription,
  CrowdfundGoal,
  CrowdfundGoalRow,
  CrowdfundImageContainer,
  CrowdfundListHeader,
  CrowdfundListTitle,
  CrowdfundOwner,
  CrowdfundText,
  CrowdfundTitle,
  CrowdfundTitleCard,
  DonateButton,
  NameContainer,
} from "./Home-styles";
import {
  CrowdfundListWrapper,
  CrowdfundUploadDate,
} from "../../components/Crowdfund/Crowdfund-styles";
import CoverImageDefault from "../../assets/images/CoverImageDefault.webp";
import { Crowdfund } from "../../state/features/crowdfundSlice";
import { QortalSVG } from "../../assets/svgs/QortalSVG";

export const CrowdfundList = () => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const firstFetch = useRef(false);
  const afterFetch = useRef(false);
  const isFetching = useRef(false);
  const hashMapCrowdfunds = useSelector(
    (state: RootState) => state.crowdfund.hashMapCrowdfunds
  );

  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );

  const globalCrowdfunds = useSelector(
    (state: RootState) => state.crowdfund.crowdfunds
  );
  const navigate = useNavigate();
  const { getCrowdfunds } = useFetchCrowdfunds();

  const getCrowdfundsHandler = React.useCallback(async () => {
    if (!firstFetch.current || !afterFetch.current) return;
    if (isFetching.current) return;
    isFetching.current = true;
    await getCrowdfunds();
    isFetching.current = false;
  }, [getCrowdfunds]);

  const getCrowdfundHandlerMount = React.useCallback(async () => {
    if (firstFetch.current) return;
    firstFetch.current = true;
    setIsLoading(true);

    await getCrowdfunds();
    afterFetch.current = true;
    setIsLoading(false);
  }, [getCrowdfunds]);

  const crowdfunds = globalCrowdfunds;

  useEffect(() => {
    if (!firstFetch.current && globalCrowdfunds.length === 0) {
      isFetching.current = true;
      getCrowdfundHandlerMount();
    } else {
      firstFetch.current = true;
      afterFetch.current = true;
    }
  }, [getCrowdfundHandlerMount, globalCrowdfunds]);

  const filteredCrowdfunds = useMemo(() => {
    return crowdfunds.filter((crowdfund: Crowdfund) => hashMapCrowdfunds[crowdfund.id]?.isValid);
  }, [crowdfunds, hashMapCrowdfunds]);

  return (
    <CrowdfundListWrapper>
      <CrowdfundListHeader>
        <CrowdfundListTitle>Most Recent Q-Funds</CrowdfundListTitle>
      </CrowdfundListHeader>
      <CrowdfundContainer container spacing={3} direction={"row"}>
        {filteredCrowdfunds.map((crowdfund: Crowdfund) => {
          const existingCrowdfund = hashMapCrowdfunds[crowdfund.id];
          let hasHash = false;
          let crowdfundObj = crowdfund;
          if (existingCrowdfund) {
            crowdfundObj = existingCrowdfund;
            hasHash = true;
          }
          let avatarUrl = "";
          if (userAvatarHash[crowdfundObj?.user]) {
            avatarUrl = userAvatarHash[crowdfundObj?.user];
          }
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={3} key={crowdfund.id}>
              <CardContainer
                onClick={() => {
                  navigate(
                    `/crowdfund/${crowdfundObj.user}/${crowdfundObj.id}`
                  );
                }}
              >
                <CrowdfundImageContainer>
                  {!hasHash ? (
                    <Skeleton variant="rectangular" width={100} height={250} />
                  ) : (
                    <ResponsiveImage
                      src={crowdfundObj?.coverImage || CoverImageDefault}
                      width={100}
                      height={150}
                      styles={{
                        maxHeight: "250px",
                        minHeight: "250px",
                        objectFit: "cover",
                      }}
                    />
                  )}
                  <CrowdfundTitleCard>
                    {!hasHash ? (
                      <Skeleton variant="text" sx={{ fontSize: "20px" }} />
                    ) : (
                      <>
                        <CrowdfundTitle>{crowdfundObj?.title}</CrowdfundTitle>
                        <NameContainer>
                          <Avatar
                            sx={{ height: 30, width: 30 }}
                            src={avatarUrl}
                            alt={`${crowdfundObj.user}'s avatar`}
                          />
                          <CrowdfundOwner>
                            by {crowdfundObj?.user}
                          </CrowdfundOwner>
                        </NameContainer>
                      </>
                    )}
                  </CrowdfundTitleCard>
                </CrowdfundImageContainer>
                {!hasHash ? (
                  <Skeleton variant="rectangular" width={"100%"} height={250} />
                ) : (
                  <ChannelCard key={crowdfundObj.id}>
                    <CrowdfundDescription>
                      {crowdfundObj?.description}
                    </CrowdfundDescription>
                    <CrowdfundGoalRow>
                      <CrowdfundText>Campaign Goal:</CrowdfundText>
                      <CrowdfundGoal>
                        <QortalSVG
                          height={"22"}
                          width={"22"}
                          color={theme.palette.text.primary}
                        />
                        {crowdfundObj?.deployedAT?.goalValue}
                      </CrowdfundGoal>
                    </CrowdfundGoalRow>
                    <BottomWrapper>
                      {crowdfundObj?.created && (
                        <CrowdfundUploadDate>
                          {formatDate(crowdfundObj.created)}
                        </CrowdfundUploadDate>
                      )}
                      <DonateButton>Back this project</DonateButton>
                    </BottomWrapper>
                  </ChannelCard>
                )}
              </CardContainer>
            </Grid>
          );
        })}
      </CrowdfundContainer>
      <LazyLoad
        onLoadMore={getCrowdfundsHandler}
        isLoading={isLoading}
      ></LazyLoad>
    </CrowdfundListWrapper>
  );
};
