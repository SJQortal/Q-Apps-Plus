// src/hooks/useIndexedDB.js

import { useState, useEffect } from "react";
import { openDatabase } from "../utils/indexedDB";

const useIndexedDB = () => {
  const [db, setDb] = useState(null);

  useEffect(() => {
    const initializeDB = async () => {
      try {
        const database = await openDatabase();
        setDb(database);
      } catch (error) {
        console.error("Failed to open IndexedDB:", error);
      }
    };
    initializeDB();
  }, []);

  return db;
};

export default useIndexedDB;
