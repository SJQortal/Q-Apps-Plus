import { FC, useEffect, useState } from "react";
import {
  AcceptedCoin,
  AcceptedCoinsRow,
  ExpandDescriptionIcon,
  OpenStoreCard,
  StoreCardDescription,
  StoreCardImage,
  StoreCardImageContainer,
  StoreCardInfo,
  StoreCardOwner,
  StoreCardTitle,
  StoresRow,
  StyledStoreCard,
  StyledTooltip,
  YouOwnIcon,
} from "../../StoreList/StoreList-styles";
import ContextMenuResource from "../../../components/common/ContextMenu/ContextMenuResource";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material";
import { BriefcaseSVG } from "../../../assets/svgs/BriefcaseSVG";
import { useDispatch, useSelector } from "react-redux";
import {
  resetListProducts,
  resetProducts,
} from "../../../state/features/globalSlice";
import { RootState } from "../../../state/store";
import { clearViewedStoreDataContainer } from "../../../state/features/storeSlice";
import QORT from "../../../assets/img/qort.png";
import ARRR from "../../../assets/img/arrr.png";

interface StoreCardProps {
  storeTitle: string;
  storeLogo: string;
  storeDescription: string;
  storeId: string;
  storeOwner: string;
  userName: string;
  supportedCoins: string[];
}

export const StoreCard: FC<StoreCardProps> = ({
  storeTitle,
  storeLogo,
  storeDescription,
  storeId,
  storeOwner,
  userName,
  supportedCoins
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();

  const currentStore = useSelector(
    (state: RootState) => state.global.currentStore
  );
  const currentViewedStore = useSelector(
    (state: RootState) => state.store.currentViewedStore
  );

  const [isEllipsisActive, setIsEllipsisActive] = useState<boolean>(false);
  const [showCompleteStoreDescription, setShowCompleteStoreDescription] =
    useState<boolean>(false);

  const handleStoreCardClick = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if ((e.target as HTMLElement)?.id === `expand-icon-${storeId}`) {
      return;
    }
    // When visiting a new story, reset the products and listProducts state to prevent the previous store's products from showing. We do this depending on whether the user is the store owner or not. We don't need to worry about them coming directly from a url link because the redux store will be empty in that case
    if (userName === storeOwner && currentStore?.id !== storeId) {
      dispatch(resetProducts());
      dispatch(resetListProducts());
    } else if (userName !== storeOwner && currentViewedStore?.id !== storeId) {
      dispatch(resetProducts());
      dispatch(clearViewedStoreDataContainer());
    }
    // Setting storeOwner and storeId into the url params which can then be used in the Store component
    navigate(`/${storeOwner}/${storeId}`);
  };

  const limitCharFunc = (str: string, limit = 50) => {
    return str.length > limit ? `${str.slice(0, limit)}...` : str;
  };

  useEffect(() => {
    if (storeDescription.length >= 50) {
      setIsEllipsisActive(true);
    }
  }, [storeDescription]);

  return (
    <StoresRow item xs={12} sm={6} md={6} lg={3} key={storeId}>
      <ContextMenuResource
        name={storeOwner}
        service="STORE"
        identifier={storeId}
        link={`qortal://APP/Q-Store/${storeOwner}/${storeId}`}
      >
        <StyledStoreCard
          container
          onClick={handleStoreCardClick}
          showCompleteStoreDescription={
            showCompleteStoreDescription ? true : false
          }
        >
          <StoreCardImageContainer>
            <StoreCardImage src={storeLogo} alt={storeTitle} />
            <OpenStoreCard>Open</OpenStoreCard>
          </StoreCardImageContainer>
          <StoreCardInfo item>
            <StoreCardTitle>{storeTitle}</StoreCardTitle>
            <StoreCardDescription>
              {showCompleteStoreDescription
                ? storeDescription
                : limitCharFunc(storeDescription)}
            </StoreCardDescription>
            {isEllipsisActive && (
              <ExpandDescriptionIcon
                id={`expand-icon-${storeId}`}
                width={"20"}
                height={"20"}
                color={theme.palette.text.primary}
                onClickFunc={(e: React.MouseEvent<any>) => {
                  e.stopPropagation();
                  setShowCompleteStoreDescription(prevState => !prevState);
                }}
                showCompleteStoreDescription={
                  showCompleteStoreDescription ? true : false
                }
              />
            )}
          </StoreCardInfo>
          <AcceptedCoinsRow>
            <AcceptedCoin src={QORT} alt="QORT-logo" />
            {supportedCoins?.includes('ARRR') && (
             <AcceptedCoin src={ARRR} alt="ARRR-logo" />
            )}
          </AcceptedCoinsRow>
          <StoreCardOwner>{storeOwner}</StoreCardOwner>
          {storeOwner === userName && (
            <StyledTooltip placement="top" title="You own this store">
              <YouOwnIcon>
                <BriefcaseSVG
                  color={theme.palette.secondary.main}
                  width={"23"}
                  height={"23"}
                />
              </YouOwnIcon>
            </StyledTooltip>
          )}
        </StyledStoreCard>
      </ContextMenuResource>
    </StoresRow>
  );
};
