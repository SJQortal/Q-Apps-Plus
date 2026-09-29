import React, { useEffect, useState } from "react";
import { Box, FormControl, SelectChangeEvent, useTheme } from "@mui/material";
import ImageUploader from "../../../components/common/ImageUploader";
import { PublishProductParams } from "../NewProduct/NewProduct";
import { Price, Product } from "../../../state/features/storeSlice";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import {
  AddLogoButton,
  AddLogoIcon,
  ButtonRow,
  CancelButton,
  CreateButton,
  CustomInputField,
  CustomNumberField,
  LogoPreviewRow,
  StoreLogoPreview,
} from "../../../components/modals/CreateStoreModal-styles";
import {
  AddButton,
  CategoryRow,
  CloseIcon,
  CustomMenuItem,
  CustomSelect,
  InputFieldCustomLabel,
  MaximumImagesRow,
  ProductImagesRow,
} from "../NewProduct/NewProduct-styles";
import { setNotification } from "../../../state/features/notificationsSlice";
import { addProductsToSaveCategory } from "../../../state/features/globalSlice";
import { Variant } from "../../../components/common/NumericTextFieldQshop";
import { CoinFilter } from "../../Store/Store/Store";

interface ProductFormProps {
  onSubmit: (product: PublishProductParams) => void;
  onClose?: () => void;
  editProduct?: Product | null;
}
interface ProductObj {
  title?: string;
  description?: string;
  price: number;
  images: string[];
  category?: string;
  priceARRR?: number;
  priceQORT?: number;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  onClose,
  onSubmit,
  editProduct,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const categories = useSelector(
    (state: RootState) => state.global.listProducts.categories
  );
  const productsToSaveCategories = useSelector(
    (state: RootState) => state.global.productsToSaveCategories
  );

  const [product, setProduct] = useState<ProductObj>({
    title: "",
    description: "",
    price: 0,
    images: [],
  });
  const currentStore = useSelector(
    (state: RootState) => state.global.currentStore
  );
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("digital");
  const [images, setImages] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("AVAILABLE");
  const [newCategory, setNewCategory] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>("");

  const editProductQortPrice =
    editProduct?.price?.find((item: Price) => item?.currency === "qort")
      ?.value || product.price;
      const editProductARRRPrice =
      editProduct?.price?.find((item: Price) => item?.currency === CoinFilter.arrr)
        ?.value || "";

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProduct({
      ...product,
      [event.target.name]: event.target.value as string | number,
    });
  };

  const handleProductPriceChange = (value: string) => {
    const price = Number(value);
    setProduct({ ...product, price: price });
  };
  const handleProductPriceChangeForeign = (value: string, coin:string) => {
    const price = Number(value);
    setProduct({ ...product, [`price${coin}`]: price });
  };

  const handleSelectChange = (event: SelectChangeEvent<string | null>) => {
    const optionId = event.target.value;
    const selectedOption = categoryList.find(option => option === optionId);
    setSelectedCategory(selectedOption || null);
  };

  const handleNewCategory = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategory(event.target.value);
  };

  const handleSubmit = () => {
    if (!selectedType || !selectedCategory) {
      dispatch(
        setNotification({
          msg: "Please select type and category",
          alertType: "error",
        })
      );
      return;
    }

    if (isNaN(product.price)) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Price must be a number!",
        })
      );
      return;
    }

    let price = []
    price.push({
      currency: "qort",
      value: product.price,
    })

    for (const value of Object.values(CoinFilter)) {
      if(product[`price${value}`]){
        price.push(
          {
            currency: value,
            value: +(product[`price${value}`] || 0),
          },
        )
      }
    }

    onSubmit({
      title: product.title,
      description: product.description,
      type: selectedType,
      images,
      category: selectedCategory,
      status: selectedStatus,
      price: price,
      mainImageIndex: 0,
    });
  };

  const addNewCategoryToList = () => {
    if (!newCategory) return;
    setSelectedCategory(newCategory);
    setCategoryList(prev => [...prev, newCategory]);
    setNewCategory("");
    dispatch(addProductsToSaveCategory(newCategory));
  };

  useEffect(() => {
    if (categories || productsToSaveCategories) {
      const existingCategories = [...categories, ...productsToSaveCategories];
      setCategoryList(existingCategories);
    }
  }, [categories, productsToSaveCategories]);

  useEffect(() => {
    if (editProduct) {
      try {
        const { title, description, images, type, category, status } =
          editProduct;

        setProduct({
          title,
          description,
          images: [],
          price: editProductQortPrice,
        });
        if (images) {
          setImages(images);
        }
        if (type) {
          setSelectedType(type);
        }
        if (category) {
          setSelectedCategory(category);
        }
        if (status) {
          setSelectedStatus(status);
        }
      } catch (error) {
        console.log({ error });
      }
    }
  }, [editProduct]);

  return (
    <>
      {images.length > 0 && (
        <ProductImagesRow>
          {images.map((img, index) => (
            <LogoPreviewRow>
              <Box style={{ position: "relative" }}>
                <StoreLogoPreview src={img} alt={`product-img-${index}`} />
                <CloseIcon
                  color={theme.palette.text.primary}
                  onClickFunc={() => {
                    setImages(prev => prev.filter(item => item !== img));
                  }}
                  height={"22"}
                  width={"22"}
                ></CloseIcon>
              </Box>
            </LogoPreviewRow>
          ))}
        </ProductImagesRow>
      )}
      {(images.length === 0 || images.length < 3) && (
        <ImageUploader
          onPick={(img: string) => setImages(prev => [...prev, img])}
        >
          <AddLogoButton>
            Add Product Image
            <AddLogoIcon
              sx={{
                height: "25px",
                width: "auto",
              }}
            ></AddLogoIcon>
          </AddLogoButton>
        </ImageUploader>
      )}
      {images.length > 0 && (
        <MaximumImagesRow>*Maximum 3 images</MaximumImagesRow>
      )}
      <CustomInputField
        name="title"
        label="Title"
        variant="filled"
        value={product.title}
        onChange={handleInputChange}
        inputProps={{ maxLength: 180 }}
        required
      />
      <CustomInputField
        name="description"
        label="Description"
        value={product.description}
        variant="filled"
        onChange={handleInputChange}
        required
      />
      <CustomNumberField
        name="price"
        label="Price in QORT"
        variant={Variant.filled}
        initialValue={editProductQortPrice.toString()}
        addIconButtons={false}
        minValue={0}
        maxValue={Number.MAX_SAFE_INTEGER}
        allowDecimals={true}
        onChangeFunc={handleProductPriceChange}
        required={true}
      />
      {currentStore?.supportedCoins?.includes(CoinFilter.arrr) && (
         <CustomNumberField
         name="arrr-price"
         label="Price in ARRR"
         variant={Variant.filled}
         initialValue={editProductARRRPrice.toString()}
         addIconButtons={false}
         minValue={0}
         maxValue={Number.MAX_SAFE_INTEGER}
         allowDecimals={true}
         onChangeFunc={(val)=>handleProductPriceChangeForeign(val, CoinFilter.arrr)}
         required={false}
       />
      )}
     
      <Box>
        <FormControl fullWidth>
          <InputFieldCustomLabel id="product-type-label">
            Product Type
          </InputFieldCustomLabel>
          <CustomSelect
            labelId="product-type-label"
            label="Product Type"
            variant="filled"
            value={selectedType}
            onChange={event => {
              setSelectedType(event.target.value as string);
            }}
            required
            fullWidth
          >
            <CustomMenuItem value="digital">Digital</CustomMenuItem>
            <CustomMenuItem value="physical">Physical</CustomMenuItem>
          </CustomSelect>
        </FormControl>
      </Box>
      <CategoryRow style={{ marginBottom: "10px" }}>
        <FormControl style={{ width: "60%" }}>
          <InputFieldCustomLabel shrink={true} id="product-category-label">
            Category
          </InputFieldCustomLabel>
          <CustomSelect
            notched={true}
            labelId="product-category-label"
            label="Category"
            value={selectedCategory}
            displayEmpty={true}
            onChange={event => {
              handleSelectChange(event as SelectChangeEvent<string | null>);
            }}
            required
            fullWidth
          >
            <CustomMenuItem value="">
              <em>Add a Category</em>
            </CustomMenuItem>
            {categoryList.map(category => (
              <CustomMenuItem value={category}>{category}</CustomMenuItem>
            ))}
          </CustomSelect>
        </FormControl>
        <CategoryRow style={{ gap: "20px" }}>
          <CustomInputField
            style={{ flexGrow: 1 }}
            name="newCategory"
            label="New Category"
            variant="filled"
            value={newCategory}
            onChange={handleNewCategory}
          />
          <AddButton variant="contained" onClick={addNewCategoryToList}>
            Add
          </AddButton>
        </CategoryRow>
      </CategoryRow>
      {editProduct && (
        <FormControl style={{ width: "60%" }}>
          <InputFieldCustomLabel shrink={true} id="product-status">
            Product Status
          </InputFieldCustomLabel>
          <CustomSelect
            notched={true}
            labelId="product-status"
            name="status"
            label="Product Status"
            value={selectedStatus}
            onChange={event => setSelectedStatus(event.target.value as string)}
            required
            fullWidth
          >
            <CustomMenuItem value="AVAILABLE">Available</CustomMenuItem>
            <CustomMenuItem value="RETIRED">Retired</CustomMenuItem>
            <CustomMenuItem value="OUT_OF_STOCK">Out of stock</CustomMenuItem>
          </CustomSelect>
        </FormControl>
      )}
      <ButtonRow>
        <CancelButton variant="outlined" color="error" onClick={onClose}>
          Cancel
        </CancelButton>
        <CreateButton onClick={handleSubmit} variant="contained">
          {editProduct ? "Edit Product" : "Add Product"}
        </CreateButton>
      </ButtonRow>
    </>
  );
};
