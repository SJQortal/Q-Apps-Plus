import { useCallback, useEffect, useRef, useState } from "react";

export const useFetchCrowdfundStatus = (
  crowdfundData: any,
  atAddress: string,
  blocksRemainingZero: boolean
) => {
  const [ATDeployed, setATDeployed] = useState<boolean>(false);
  const [ATCompleted, setATCompleted] = useState<boolean>(false);
  const [ATLoadingStatus, setATLoadingStatus] = useState<string>(
    "Verifying Deployment Status..."
  );
  const [ATStatus, setATStatus] = useState<string>("");
  const [ATAmount, setATAmount] = useState<number | null>(null);
  const [ATEnded, setATEnded] = useState<boolean>(false);
  const [checkedATEnded, setCheckedATEnded] = useState<boolean>(false);

  const interval = useRef<any>(null);

  // First check if the crowdfund has been deployed.
  // If it has, check if the AT is still active by making an API request with transaction/search, type AT and looking for property called "amount". If no response, then AT is still active. If there is a response, it is completed.
  // We also need a useEffect in case the Q-Fund goes from in progress to completed. We do this by having a
  // If it is completed, check if amount value is greater than or equal to the goal value. If it is, then the goal has been achieved. If it isn't, then the goal has not been achieved.

  // Fetch AT Deployment Status using the AT Address
  const fetchQFundDeploymentStatus = useCallback(async () => {
    try {
      if (!atAddress) return;
      const res = await qortalRequest({
        action: "SEARCH_TRANSACTIONS",
        txType: ["DEPLOY_AT"],
        confirmationStatus: "CONFIRMED",
        address: atAddress,
        limit: 1,
        reverse: true,
      });
      if (res?.length > 0) {
        // Check if AT is sleeping and isn't finished yet
        const url = `/at/${atAddress}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (response.status === 200) {
          const responseDataSearch = await response.json();
          // if we get a 200 response from /at/address, as well as the sleepUntilHeight property and !isFinished, then AT is deployed and we can check if it's in progress, achieved, or not achieved.
          if (
            responseDataSearch?.sleepUntilHeight &&
            !responseDataSearch?.isFinished
          ) {
            setATDeployed(true);
            setATLoadingStatus("Verifying Q-Fund Completion Status...");
            return res;
            // if we get a 200 response from /at/address, but we're missing both the sleepUntilHeight property and isFinished, then AT is still being deployed
          } else if (
            !responseDataSearch?.sleepUntilHeight &&
            !responseDataSearch?.isFinished
          ) {
            setATDeployed(false);
            setATStatus("Q-Fund Being Deployed");
            return [];
            // if we get a 200 response from /at/address, and we're missing the sleepUntilHeight property, but isFinished is true, then the AT is completed.
          } else if (
            !responseDataSearch.sleepUntilHeight &&
            responseDataSearch.isFinished
          ) {
            setATDeployed(true);
            setATLoadingStatus("Verifying Q-Fund Completion Status...");
            return res;
          }
          // if we get a 204 response from /at/address, then AT is not deployed yet because we still don't have the sleepUntilHeight property
        } else {
          setATStatus("Q-Fund Being Deployed");
          setATDeployed(false);
          return [];
        }
      } else {
        setATStatus("Q-Fund Being Deployed");
        setATDeployed(false);
        return [];
      }
    } catch (error) {
      console.error(error);
      setATLoadingStatus("Error when fetching Q-Fund Deployment Status");
    }
  }, [atAddress]);

  // useEffect that checks whether a Q-Fund is currently in deployment or not. If it is, we prevent the user from donating to the Q-Fund. We do polling every 30 seconds.
  useEffect(() => {
    if (atAddress) {
      let intervalId: NodeJS.Timeout | undefined;
      const checkDeploymentStatus = async () => {
        const checkStatus = async () => {
          const ATFound = await fetchQFundDeploymentStatus();
          if (ATFound?.length > 0) {
            clearInterval(intervalId); // Stop the polling if AT becomes available
          } else {
            setATDeployed(false);
            setATLoadingStatus("");
          }
        };
        checkStatus();
        intervalId = setInterval(checkStatus, 30000);
        // Clear the interval when the component unmounts
        return () => {
          if (intervalId) clearInterval(intervalId);
        };
      };
      checkDeploymentStatus();
    }
  }, [atAddress, fetchQFundDeploymentStatus]);

  // See if AT is completed
  const fetchQFundCompletionStatus = useCallback(async () => {
    try {
      if (!atAddress) return;
      const res = await qortalRequest({
        action: "SEARCH_TRANSACTIONS",
        txType: ["AT"],
        confirmationStatus: "CONFIRMED",
        address: atAddress,
        limit: 0,
        reverse: true,
      });
      if (res?.length > 0 && ATEnded) {
        const totalAmount: number = res.reduce(
          (total: number, transaction) =>
            total + parseFloat(transaction.amount),
          0
        );
        setATCompleted(true);
        setATLoadingStatus("");
        setATAmount(totalAmount);
        // Check if AT is achieved or not achieved
        if (totalAmount >= crowdfundData?.deployedAT?.goalValue) {
          setATStatus("Q-Fund Goal Achieved");
        } else {
          setATStatus("Q-Fund Goal Not Achieved");
        }
      } else if (res?.length === 0 && ATEnded) {
        setATCompleted(true);
        setATLoadingStatus("");
        setATStatus(
          "Q-Fund Completed! Check back later to see the achievement status."
        );
      } else if (res.length > 0 && !ATEnded) {
        setATCompleted(true);
        setATLoadingStatus("");
        setATAmount(res[0]?.amount);
        // Check if AT is achieved or not achieved
        if (res[0]?.amount >= crowdfundData?.deployedAT?.goalValue) {
          setATStatus("Q-Fund Goal Achieved");
        } else {
          setATStatus("Q-Fund Goal Not Achieved");
        }
      } else {
        setATCompleted(false);
        setATLoadingStatus("");
        setATStatus("Q-Fund In Progress");
      }
    } catch (error) {
      console.error(error);
      setATLoadingStatus("Error when fetching Q-Fund Completion Status");
    }
  }, [atAddress, ATEnded]);

  // useEffect that check if AT is completed or not. If it is completed, we then check if it is achieved or not achieved based on the amount value. If it receives an ATEnded prop, recall the useEffect to see the achievement status of the AT.
  useEffect(() => {
    if (ATDeployed && atAddress) {
      const checkCompletionStatus = async () => {
        await fetchQFundCompletionStatus();
      };
      checkCompletionStatus();
    }
  }, [ATDeployed, atAddress, fetchQFundCompletionStatus, checkedATEnded]);

  // Check if the crowdfund has ended by checking /at/address for isFinished property inside the response object
  const hasQFundEnded = useCallback(async (atAddress: string) => {
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
        if (
          Object.keys(responseDataSearch).length > 0 &&
          responseDataSearch?.isFinished
        ) {
          setATEnded(true);
          setCheckedATEnded(true);
          return responseDataSearch;
        } else {
          setATEnded(false);
          setCheckedATEnded(true);
          return responseDataSearch;
        }
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  // Poll every 5 seconds to check if the crowdfund has ended when blocksRemaining is 0
  useEffect(() => {
    if (blocksRemainingZero && !checkedATEnded) {
      let isCalling = false;
      interval.current = setInterval(async () => {
        if (isCalling) return;
        isCalling = true;
        const response = await hasQFundEnded(atAddress);

        if (response) {
          clearInterval(interval.current);
        }

        isCalling = false;
      }, 5000);
    }
    return () => {
      if (interval.current) {
        clearInterval(interval.current);
      }
    };
  }, [blocksRemainingZero]);

  return {
    ATDeployed,
    ATCompleted,
    ATLoadingStatus,
    ATStatus,
    ATAmount,
  };
};
