
import React, { createContext, useContext } from "react";
import useIndexedDB from "../hooks/useIndexedDB";

const IndexedDBContext = createContext(null);

export const IndexedDBProvider = ({ children }) => {
  const db = useIndexedDB();

  return (
    <IndexedDBContext.Provider value={db}>
      {children}
    </IndexedDBContext.Provider>
  );
};

export const useIndexedDBContext = () => {
  return useContext(IndexedDBContext);
};
