import { useState, useEffect } from "react";
import { Product } from "../state/features/storeSlice";
import { RootState } from "../state/store";
import { useSelector } from "react-redux";

export const useProductsToSaveLocalStorage = () => {
  const { currentStore } = useSelector((state: RootState) => state.global);

  const [productsToSaveLS, setProductsToSaveLS] = useState(() => {
    // Retrieve the productsToSave object from local storage or initialize as an empty object
    const storedProductsToSave = localStorage.getItem("productsToSave");
    return storedProductsToSave ? JSON.parse(storedProductsToSave) : {};
  });

  useEffect(() => {
    // Store the productsToSave object in local storage whenever it changes
    localStorage.setItem("productsToSave", JSON.stringify(productsToSaveLS));
  }, [productsToSaveLS]);

  const saveProductsToLocalStorage = (newProductsToSave: any) => {
    // Update the productsToSave state
    setProductsToSaveLS(newProductsToSave);
  };

  return { productsToSaveLS, saveProductsToLocalStorage };
};
