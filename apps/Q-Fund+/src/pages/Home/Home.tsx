import React, { useEffect } from 'react';
import { NewCrowdfund } from '../../components/Crowdfund/NewCrowdfund';
import { CrowdfundList } from './CrowdfundList';
import {
  HomePageContainer,
  HomePageSubContainer,
  HomepageDescription,
  HomepageTitle,
  HomepageTitleRow,
  Logo,
  StepCol,
  StepDescription,
  StepIcon,
  StepTitle,
  StepsContainer,
} from './Home-styles';
import NavBar from '../../components/layout/Navbar/Navbar';
import { useDispatch, useSelector } from 'react-redux';
import { addUser } from '../../state/features/authSlice';
import { RootState } from '../../state/store';
import { ExploreSVG } from '../../assets/svgs/ExploreSVG';
import { DonateSVG } from '../../assets/svgs/DonateSVG';
import { TrackSVG } from '../../assets/svgs/TrackSVG';
import QFundLogo from '../../assets/images/QFundDarkLogo.png';
interface Props {
  setTheme: (val: string) => void;
}

export const Home: React.FC<Props> = ({ setTheme }) => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  async function getNameInfo(address: string) {
    const response = await qortalRequest({
      action: 'GET_ACCOUNT_NAMES',
      address: address,
    });
    const nameData = response;

    if (nameData?.length > 0) {
      return nameData[0].name;
    } else {
      return '';
    }
  }

  const askForAccountInformation = React.useCallback(async () => {
    try {
      const account = await qortalRequest({
        action: 'GET_USER_ACCOUNT',
      });

      const name = await getNameInfo(account.address);
      dispatch(addUser({ ...account, name }));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (user?.name) return;
    askForAccountInformation();
  }, [user]);

  return (
    <>
      <HomePageContainer>
        <NavBar
          fixed={false}
          setTheme={(val: string) => setTheme(val)}
          authenticate={askForAccountInformation}
          isAuthenticated={!!user?.name}
        />
        <HomePageSubContainer>
          <HomepageTitleRow>
            <Logo src={QFundLogo} alt="logo" />
            <HomepageTitle>Q-Fund</HomepageTitle>
          </HomepageTitleRow>
          <HomepageDescription>
            Q-Fund is a decentralized crowdfunding platform built on the Qortal
            blockchain. It allows users to create and contribute to crowdfunding
            campaigns that are stored on the blockchain.
          </HomepageDescription>
          <StepsContainer>
            <StepCol>
              <StepIcon>
                <ExploreSVG color={'white'} height={'50px'} width={'50px'} />
              </StepIcon>
              <StepTitle>Explore Qortal Initiatives</StepTitle>
              <StepDescription>
                Read into new Q-Fund initiatives and learn about the projects
                that are being proposed in the community.
              </StepDescription>
            </StepCol>
            <StepCol>
              <StepIcon>
                <DonateSVG color={'white'} height={'50px'} width={'50px'} />
              </StepIcon>
              <StepTitle>Contribute</StepTitle>
              <StepDescription>
                Donate QORT to campaigns you want to support.
              </StepDescription>
            </StepCol>
            <StepCol>
              <StepIcon>
                <TrackSVG color={'white'} height={'50px'} width={'50px'} />
              </StepIcon>
              <StepTitle>Track Your Support</StepTitle>
              <StepDescription>
                Track the progress of the Q-Funds you've donated to, and keep
                track of other people's comments and the latest updates from the
                campaign owner.
              </StepDescription>
            </StepCol>
          </StepsContainer>
          <NewCrowdfund />
        </HomePageSubContainer>
      </HomePageContainer>
      <CrowdfundList />
    </>
  );
};
