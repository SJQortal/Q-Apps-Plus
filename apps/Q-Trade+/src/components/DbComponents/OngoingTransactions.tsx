// src/hooks/useGetOngoingTransactions.js

import { useEffect, useState, useCallback } from "react";
import { useIndexedDBContext } from "../../contexts/indexedDBContext";

const fetchTradeInfo = async (qortalAtAddress) => {

  const checkIfOfferingRes = await fetch(`/crosschain/trade/${qortalAtAddress}`)
  const data = await checkIfOfferingRes.json()
   return data
};

export const useGetOngoingTransactions = ({ qortAddress }) => {
  const db = useIndexedDBContext();
  const [transactions, setTransactions] = useState([]);
  const [sellOrders, setSellOrders] = useState([]);
  const [sellOrderAts, setSellOrderAts] = useState([]);

  // Fetch transactions updated within the last 22 minutes
  const fetchOngoingTransactions = useCallback(async () => {
    if (!db || !qortAddress) return;

    try {
      const transactionStore = db.transaction("transactions", "readonly").objectStore("transactions");
      const index = transactionStore.index("updatedAt");
      const now = Date.now() - 1440 * 60 * 1000; // 1 day

      const results: any[] = await new Promise((resolve, reject) => {
        const data = [];
        index.openCursor(IDBKeyRange.lowerBound(now)).onsuccess = async (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const transaction = cursor.value;
            if (transaction.qortAddress === qortAddress) {
              data.push(transaction);
            }
            cursor.continue();
          } else {
            const results = [];
            for (const transaction of data || []) {
              const tradeData = await fetchTradeInfo(transaction.qortalAtAddress);
              if(tradeData.qortalPartnerReceivingAddress && tradeData.qortalPartnerReceivingAddress !== qortAddress) continue
              let newStatus = transaction.status
              if(tradeData.qortalPartnerReceivingAddress && tradeData.qortalPartnerReceivingAddress === qortAddress){
                newStatus = tradeData.mode.toLowerCase()
              }
              results.push({...transaction, tradeInfo: tradeData, status: newStatus});
            }
            resolve(results);
          }
        };
        index.openCursor().onerror = (event) => reject(event.target.error);
      });

      setTransactions(results.sort((a, b) => b.createdAt - a.createdAt)); // Sort by createdAt descending
    } catch (error) {
      console.error("Error fetching ongoing transactions:", error);
    }
  }, [db, qortAddress]);

  // Upsert transactions into IndexedDB
  const updateTransactionInDB = useCallback(async ({
    qortalAtAddresses,
    qortAddress,
    node,
    status,
    message = '',
    encryptedMessageToBase58 = undefined,
    chatSignature = '',
    sender = '',
    senderPublicKey = '',
    reference = ''
  }: any) => {
    if (!db || !qortalAtAddresses || !qortAddress) return;

    try {
      return new Promise((resolve, reject) => {
        const transactionStore = db.transaction("transactions", "readwrite").objectStore("transactions");
        const updatedTransactions = [];

        qortalAtAddresses.forEach((qortalAtAddress) => {
          const request = transactionStore.get(qortalAtAddress);

          request.onsuccess = (event) => {
            const existingTransaction = event.target.result;

            // Prepare the new or updated transaction object
            const newTransaction = {
              qortalAtAddress,
              qortAddress,
              node,
              status,
              message,
              encryptedMessageToBase58,
              chatSignature,
              sender,
              senderPublicKey,
              reference,
              updatedAt: Date.now(),
              createdAt: existingTransaction ? existingTransaction.createdAt : Date.now(), // Preserve createdAt if it exists
            };

            transactionStore.put(newTransaction); // Upsert: create if not exists, update if exists
            updatedTransactions.push(newTransaction);
          };

          request.onerror = (event) => {
            console.error("Error fetching transaction:", event.target.error);
          };
        });

        transactionStore.transaction.oncomplete = () => resolve(updatedTransactions);
        transactionStore.transaction.onerror = (error) => reject(error);
      });
    } catch (error) {
      console.error("Error updating transactions:", error);
    }
  }, [db, qortAddress]);


  // Fetch transactions with a specific status and signature
  const fetchTemporarySellOrders = useCallback(async () => {
    if (!db || !qortAddress) return;
  
    try {
      const transactionStore = db.transaction("temporarySellOrders", "readonly").objectStore("temporarySellOrders");
  
      const result = await new Promise((resolve, reject) => {
        const data = [];
        const request = transactionStore.openCursor();
  
        request.onsuccess = (event) => {
          const cursor = event.target.result;
  
          if (cursor) {
            const transaction = cursor.value;
            // Manually filter by qortAddress
            if (transaction.qortAddress === qortAddress) {
              data.push(transaction);
            }
            
            cursor.continue();
          } else {
            // Deduplicate transactions by atAddress, prioritizing non-temporary ones
            const uniqueTransactions = new Map();
            [...sellOrderAts, ...data].forEach((transaction) => {
              const key = transaction.atAddress;
  
              if (uniqueTransactions.has(key)) {
                const existingTransaction = uniqueTransactions.get(key);
  
                // Keep the transaction that does not have 'isTemp' set to true
                if (!existingTransaction.isTemp) return;
              }
  
              uniqueTransactions.set(key, transaction);
            });
  
            // Sort by createdAt in descending order and update the state
            setSellOrders(
              Array.from(uniqueTransactions.values()).sort((a, b) => b.createdAt - a.createdAt)
            );
  
            resolve(Array.from(uniqueTransactions.values())); // Return deduplicated results
          }
        };
  
        request.onerror = (event) => reject(event.target.error);
      });
  
      return result;
    } catch (error) {
      console.error("Error fetching transactions by qortAddress:", error);
    }
  }, [db, sellOrderAts, qortAddress]);
  
  


const updateTemporaryFailedTradeBots = useCallback(async ({
  atAddress,
  status,
  qortAddress,
  ...props
}) => {
  if (!db || !atAddress || !qortAddress) return;

  try {
    return new Promise((resolve, reject) => {
      const transactionStore = db.transaction("temporarySellOrders", "readwrite").objectStore("temporarySellOrders");

      const request = transactionStore.get(atAddress);

      request.onsuccess = (event) => {
        const existingTransaction = event.target.result;

        // Prepare the new or updated transaction object
        const newTransaction = {
          atAddress,
          status,
          isTemp: true,
          createdAt: existingTransaction ? existingTransaction.createdAt : Date.now(),
          qortAddress,
          ...props
        };

        transactionStore.put(newTransaction); // Upsert
      };

      request.onerror = (event) => {
        console.error("Error fetching transaction:", event.target.error);
        reject(event.target.error);
      };

      transactionStore.transaction.oncomplete = () => {
        resolve(true)
      };
      transactionStore.transaction.onerror = (error) => reject(error);
    });
  } catch (error) {
    console.error("Error updating transaction in IndexedDB:", error);
  }
}, [db, qortAddress]);

const deleteTemporarySellOrder = useCallback(async (atAddress) => {
  if (!db || !atAddress) return;

  try {
    return new Promise((resolve, reject) => {
      const transactionStore = db.transaction("temporarySellOrders", "readwrite").objectStore("temporarySellOrders");

      const request = transactionStore.delete(atAddress);

      request.onsuccess = () => {
        resolve(true); // Resolve with success
      };

      request.onerror = (event) => {
        console.error("Error deleting transaction:", event.target.error);
        reject(event.target.error); // Reject with error
      };
    });
  } catch (error) {
    console.error("Error deleting transaction:", error);
  }
}, [db, qortAddress]);


  useEffect(() => {


    fetchOngoingTransactions();
  }, [fetchOngoingTransactions]);

  useEffect(()=> {
    fetchTemporarySellOrders()
  }, [fetchTemporarySellOrders])


  return { onGoingTrades: transactions, fetchOngoingTransactions, updateTransactionInDB, deleteTemporarySellOrder, updateTemporaryFailedTradeBots, fetchTemporarySellOrders, sellOrders };
};
