export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tradeDB", 3); // Increment version to trigger upgrade

    request.onupgradeneeded = (event) => {
      const db = (event.target as any).result;

      // Create the 'transactions' object store if it doesn't exist
      if (!db.objectStoreNames.contains("transactions")) {
        const transactionStore = db.createObjectStore("transactions", { keyPath: "qortalAtAddress" });
        transactionStore.createIndex("updatedAt", "updatedAt", { unique: false });
        transactionStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Create a new 'temporarySellOrders' object store if it doesn't exist
      if (!db.objectStoreNames.contains("temporarySellOrders")) {
        const temporarySellOrderStore = db.createObjectStore("temporarySellOrders", { keyPath: "atAddress" }); 
        temporarySellOrderStore.createIndex("createdAt", "createdAt", { unique: false });
        temporarySellOrderStore.createIndex("qortAddress", "qortAddress", { unique: false }); // New index for qortAddress
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
