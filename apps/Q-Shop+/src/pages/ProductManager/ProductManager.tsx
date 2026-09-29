import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { Box, Grid, useTheme } from "@mui/material";
import LazyLoad from "../../components/common/LazyLoad";
import { NewProduct } from "./NewProduct/NewProduct";
import { ShowOrder } from "./ShowOrder/ShowOrder";
import { SimpleTable } from "./ProductTable/ProductTable";
import { setNotification } from "../../state/features/notificationsSlice";
import { objectToBase64 } from "../../utils/toBase64";
import ShortUniqueId from "short-unique-id";
import {
  Catalogue,
  CatalogueDataContainer,
  DataContainer,
  clearAllProductsToSave,
  removeFromProductsToSave,
  setDataContainer,
  setProducts,
  updateCatalogueHashMap,
} from "../../state/features/globalSlice";
import { Price, Product } from "../../state/features/storeSlice";
import { useFetchOrders } from "../../hooks/useFetchOrders";
import { AVAILABLE } from "../../constants/product-status";
import {
  TabsContainer,
  StyledTabs,
  StyledTab,
  ProductsToSaveCard,
  ProductToSaveCard,
  CardHeader,
  Bulletpoints,
  TimesIcon,
  CardButtonRow,
  AddMoreButton,
  MinimizeIcon,
  DockedMinimizeIcon,
  DockedProductsToSaveCard,
  ProductManagerContainer,
  ProductsCol,
} from "./ProductManager-styles";
import { OrderTable } from "./OrderTable/OrderTable";
import { BackToStorefrontButton } from "../Store/Store/Store-styles";
import { QortalSVG } from "../../assets/svgs/QortalSVG";
import { CategorySVG } from "../../assets/svgs/CategorySVG";
import { LoyaltySVG } from "../../assets/svgs/LoyaltySVG";
import useConfirmationModal from "../../hooks/useConfirmModal";
import { CreateButton } from "../../components/modals/CreateStoreModal-styles";
// import { useProductsToSaveLocalStorage } from "../../hooks/useProductsToSaveLocalStorage";
import { ReusableModal } from "../../components/modals/ReusableModal";
import { useParams } from "react-router-dom";
import { useLocation } from "react-router-dom";
import {
  CATALOGUE_BASE,
  DATA_CONTAINER_BASE,
  STORE_BASE,
} from "../../constants/identifiers";
import { resetOrders } from "../../state/features/orderSlice";
import { useModal } from "../../components/common/useModal";
import { MultiplePublish } from "../../components/common/MultiplePublish/MultiplePublish";

const uid = new ShortUniqueId({ length: 10 });

export const ProductManager = () => {
  const {isShow, onCancel, onOk, show} = useModal()
  const [publishes, setPublishes] = useState<any>(null);

  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Get store id from url
  const { store } = useParams();

  const user = useSelector((state: RootState) => state.auth.user);
  const productsToSave = useSelector(
    (state: RootState) => state.global.productsToSave
  );
  const currentStore = useSelector(
    (state: RootState) => state.global.currentStore
  );
  const dataContainer = useSelector(
    (state: RootState) => state.global.dataContainer
  );
  const orders = useSelector((state: RootState) => state.order.orders);
  const listProducts = useSelector(
    (state: RootState) => state.global.listProducts
  );
  // Products to map
  const products = useSelector((state: RootState) => state.global.products);

  const { products: dataContainerProducts } = listProducts;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [order, setOrder] = useState<any>(null);
  const [valueTab, setValueTab] = React.useState(0);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [openAddProduct, setOpenAddProduct] = useState<boolean>(false);
  const [dockProductsToSave, setDockProductsToSave] = useState<boolean>(false);

  // Get authenticated user's name
  const userName = useMemo(() => {
    if (!user?.name) return "";
    return user.name;
  }, [user]);

  // get and set productsToSave from local storage
  // const { productsToSaveLS, saveProductsToLocalStorage } =
  //   useProductsToSaveLocalStorage();

  // Redirect to Store page if they're hot reloading

  // Get productsToSave from Redux store and set them in local storage
  // useEffect(() => {
  //   if (Object.keys(productsToSave).length > 0) {
  //     saveProductsToLocalStorage(productsToSave);
  //   }
  // }, [productsToSave]);

  // Publish productsToSave to QDN
  async function publishQDNResource() {
    let address: string = "";
    let name: string = "";
    let errorMsg = "";

    address = user?.address || "";
    name = user?.name || "";

    // Validation
    if (!address) {
      errorMsg = "Cannot send: your address isn't available";
    }
    if (!name) {
      errorMsg = "Cannot send a message without a access to your name";
    }

    if (!currentStore) {
      errorMsg = "Cannot create a product without having a store";
    }

    if (!dataContainer) {
      errorMsg = "Cannot create a product without having a data-container";
    }

    // Add validation to make sure the dataContainer has the same store id as the current store
    if (currentStore?.id !== dataContainer?.storeId) {
      errorMsg = "Cannot create a product without having a data-container";
    }

    if (errorMsg) {
      dispatch(
        setNotification({
          msg: errorMsg,
          alertType: "error",
        })
      );
      throw new Error(errorMsg);
    }

    if (!currentStore?.id) throw new Error("Cannot find store id");
    if (!dataContainer?.products)
      throw new Error("Cannot find data-container products");

    try {
      const storeId: string = currentStore?.id;
      if (!storeId) throw new Error("Could not find your store");
      const parts = storeId.split(`${STORE_BASE}-`);
      const shortStoreId = parts[1];

      if (!currentStore) throw new Error("Could not find your store");
      // Get last index catalogue inside data container catalogues array
      const lastCatalogue: CatalogueDataContainer | undefined =
        dataContainer?.catalogues?.at(-1);
      let catalogue = null;
      const listOfCataloguesToPublish: Catalogue[] = [];
      // Initialize dataContainer to publish
      const dataContainerToPublish: DataContainer = {
        ...dataContainer,
        products: structuredClone(dataContainer.products),
        catalogues: structuredClone(dataContainer.catalogues),
      };

      if (lastCatalogue && Object.keys(lastCatalogue?.products)?.length < 10) {
        // fetch last catalogue on QDN
        const catalogueResponse = await qortalRequest({
          action: "FETCH_QDN_RESOURCE",
          name: name,
          service: "DOCUMENT",
          identifier: lastCatalogue.id,
        });
        if (catalogueResponse && !catalogueResponse?.error)
          catalogue = catalogueResponse;
      }
      // If catalogue was found on QDN, add it to the list of catalogues to publish when it has less than 10 products
      if (catalogue) listOfCataloguesToPublish.push(catalogue);

      // Loop through productsToSave and add them to the catalogue if it has less than 10 products, otherwise create a new catalogue. Also add new products to global redux store.
      Object.keys(productsToSave)
        .filter(item => !productsToSave[item]?.isUpdate)
        .forEach(key => {
          const product = productsToSave[key];
          const priceInQort = product?.price?.find(
            (item: Price) => item?.currency === "qort"
          )?.value;
          if (!priceInQort)
            throw new Error("Cannot find price for one of your products");
          const lastCatalogueInList = listOfCataloguesToPublish.at(-1);
          if (
            lastCatalogueInList &&
            Object.keys(lastCatalogueInList?.products)?.length < 10
          ) {
            const copyLastCatalogue = { ...lastCatalogueInList };
            // Add catalogueId to the product here (!important)
            copyLastCatalogue.products[key] = {
              ...product,
              catalogueId: copyLastCatalogue.id,
            };
            dataContainerToPublish.products[key] = {
              created: product.created,
              priceQort: priceInQort,
              category: product?.category || "",
              catalogueId: copyLastCatalogue.id,
              status: AVAILABLE,
            };
            if (!dataContainerToPublish.catalogues)
              dataContainerToPublish.catalogues = [];
            // Determine if data container's catalogue has products
            const findCatalogueInDataContainer =
              dataContainerToPublish.catalogues.findIndex(
                item => item.id === copyLastCatalogue.id
              );
            if (findCatalogueInDataContainer >= 0) {
              dataContainerToPublish.catalogues[
                findCatalogueInDataContainer
              ].products[key] = true;
            } else {
              dataContainerToPublish.catalogues = [
                ...dataContainerToPublish.catalogues,
                {
                  id: copyLastCatalogue.id,
                  products: {
                    [key]: true,
                  },
                },
              ];
            }
          } else {
            // Create new catalogue
            const uidGenerator = uid();
            const catalogueId = `${CATALOGUE_BASE}-${shortStoreId}-${uidGenerator}`;
            // Add catalogueId to the product here (!important)
            listOfCataloguesToPublish.push({
              id: catalogueId,
              products: {
                [key]: { ...product, catalogueId: catalogueId },
              },
            });
            try {
              dataContainerToPublish.products[key] = {
                created: product.created,
                priceQort: priceInQort,
                category: product?.category || "",
                catalogueId,
                status: AVAILABLE,
              };
            } catch (error) {
              console.error(error);
            }

            if (!dataContainerToPublish.catalogues)
              dataContainerToPublish.catalogues = [];

            const findCatalogueInDataContainer =
              dataContainerToPublish.catalogues.findIndex(
                item => item.id === catalogueId
              );
            // Determine if data container's catalogue has products
            if (findCatalogueInDataContainer >= 0) {
              dataContainerToPublish.catalogues[
                findCatalogueInDataContainer
              ].products[key] = true;
            } else {
              dataContainerToPublish.catalogues = [
                ...dataContainerToPublish.catalogues,
                {
                  id: catalogueId,
                  products: {
                    [key]: true,
                  },
                },
              ];
            }
          }
        });
      // Update products when sending productsToSave inside existing data container
      const productsToUpdate = Object.keys(productsToSave)
        .filter(item => !!productsToSave[item]?.isUpdate)
        .map(key => productsToSave[key]);
      for (const product of productsToUpdate) {
        const priceInQort = product?.price?.find(
          (item: Price) => item?.currency === "qort"
        )?.value;
        if (!priceInQort)
          throw new Error("Cannot find price for one of your products");
        if (priceInQort <= 0)
          throw new Error("Price cannot be less than or equal to 0");
        dataContainerToPublish.products[product.id] = {
          created: product.created,
          priceQort: priceInQort,
          category: product?.category || "",
          catalogueId: product.catalogueId,
          status: product?.status || "",
        };
        // Replace product from listOfCataloguesToPublish with updated product
        const findCatalogueFromExistingList =
          listOfCataloguesToPublish.findIndex(
            cat => cat.id === product.catalogueId
          );
        if (findCatalogueFromExistingList >= 0) {
          listOfCataloguesToPublish[findCatalogueFromExistingList].products[
            product.id
          ] = product;
        } else {
          // Otherwise fetch catalogue from QDN and add product to it
          const catalogueResponse = await qortalRequest({
            action: "FETCH_QDN_RESOURCE",
            name: name,
            service: "DOCUMENT",
            identifier: product.catalogueId,
          });
          if (catalogueResponse && !catalogueResponse?.error) {
            const copiedCatalogue = structuredClone(catalogueResponse);
            copiedCatalogue.products[product.id] = product;
            listOfCataloguesToPublish.push(copiedCatalogue);
          }
        }
      }

      if (!currentStore) return;
      let publishMultipleCatalogues = [];
      // Loop through listOfCataloguesToPublish and publish the base64 converted object to QDN
      for (const catalogue of listOfCataloguesToPublish) {
        const catalogueToBase64 = await objectToBase64(catalogue);
        const publish = {
          name,
          service: "DOCUMENT",
          identifier: catalogue.id,
          filename: "catalogue.json",
          data64: catalogueToBase64,
        };
        publishMultipleCatalogues.push(publish);
      }
      // Convert dataContainer being published to base64
      const dataContainerToBase64 = await objectToBase64(
        dataContainerToPublish
      );
      const publishDataContainer = {
        name,
        service: "DOCUMENT",
        identifier: dataContainerToPublish.id,
        filename: "datacontainer.json",
        data64: dataContainerToBase64,
      };
      // Publish the catalogues and the data container to QDN. Remember that there can be multiple catalogues because each catalogue holds a maximum of 10 products. Therefore, if you're publishing multiple products, you will possibly fill up the last catalogue, before then creating a new one.
      const multiplePublish = {
        action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
        resources: [...publishMultipleCatalogues, publishDataContainer],
      };
      setPublishes(multiplePublish)
      await show()
      // await qortalRequest(multiplePublish);

      // Clear productsToSave from Redux store
      dispatch(clearAllProductsToSave());

      // Replace dataContainer in the store
      dispatch(
        setDataContainer({
          ...dataContainerToPublish,
          id: `${storeId}-${DATA_CONTAINER_BASE}`,
        })
      );

      const newProductsArray = Object.keys(dataContainerToPublish.products).map(
        key => {
          const product = dataContainerToPublish.products[key];
          return {
            ...product,
            id: key,
          };
        }
      );

      // Reset products to first 20 in the array of listProducts
      dispatch(setProducts(newProductsArray));

      const newCatalogueHashMapFunc = () => {
        let newCatalogueHashMap: Record<string, Catalogue> = {};

        listOfCataloguesToPublish.forEach(catalogue => {
          newCatalogueHashMap[catalogue.id] = catalogue;
        });
        return newCatalogueHashMap;
      };

      const catalogueHashMapToDispatch = newCatalogueHashMapFunc();
      dispatch(updateCatalogueHashMap(catalogueHashMapToDispatch));

      // Toast
      dispatch(
        setNotification({
          msg: "Products saved",
          alertType: "success",
        })
      );

      // Error handling
    } catch (error: any) {
      let notificationObj = null;
      if (typeof error === "string") {
        notificationObj = {
          msg: error || "Failed to send message",
          alertType: "error",
        };
      } else if (typeof error?.error === "string") {
        notificationObj = {
          msg: error?.error || "Failed to send message",
          alertType: "error",
        };
      } else {
        notificationObj = {
          msg: error?.message || "Failed to send message",
          alertType: "error",
        };
      }
      if (!notificationObj) return;
      dispatch(setNotification(notificationObj));

      throw new Error("Failed to send message");
    } finally {
      setPublishes(null)
    }
  }

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValueTab(newValue);
  };

  // Confirmation to delete product from productsToSave
  const { Modal, showModal } = useConfirmationModal({
    title: "Remove Product from List To Save to the Shop",
    message: "Are you sure you want to proceed?",
  });

  const handleRemoveConfirmation = async (key: string) => {
    const userConfirmed = await showModal();
    if (userConfirmed) {
      // User confirmed action
      dispatch(removeFromProductsToSave(key));
    }
  };

  // Get products & orders from Redux
  const { getOrders, getProducts } = useFetchOrders();

  const handleGetOrders = React.useCallback(async () => {
    await getOrders();
  }, [getOrders]);

  const handleGetProducts = React.useCallback(async () => {
    await getProducts();
  }, [getProducts]);

  // Fetch products from hashMap if listProducts changes
  useEffect(() => {
    handleGetProducts();
  }, [dataContainerProducts]);

  useEffect(() => {
    if (
      (!dataContainer || Object.keys(dataContainer).length === 0) &&
      userName
    ) {
      navigate(`/${userName}/${store}`);
    } else {
      return;
    }
  }, [userName, dataContainer]);

  // Cleanup orders when they leave ProductManager
  useEffect(() => {
    return () => {
      dispatch(resetOrders());
    }
  }, [])

  return (
    <ProductManagerContainer>
      <TabsContainer>
        <BackToStorefrontButton
          onClick={() => {
            navigate(`/${userName}/${currentStore?.id}`);
          }}
        >
          Back To Storefront
        </BackToStorefrontButton>
        <StyledTabs
          value={valueTab}
          onChange={handleChange}
          aria-label="basic tabs example"
        >
          <StyledTab
            sx={{
              "&.Mui-selected": {
                color: theme.palette.text.primary,
                fontWeight: theme.typography.fontWeightMedium,
              },
            }}
            label="Products"
          />
          <StyledTab
            sx={{
              "&.Mui-selected": {
                color: theme.palette.text.primary,
                fontWeight: theme.typography.fontWeightMedium,
              },
            }}
            label="Orders"
          />
        </StyledTabs>
      </TabsContainer>

      {/* productsToSave card inside Product Manager */}
      {dockProductsToSave ? (
        <DockedProductsToSaveCard>
          Products Ready To Be Listed
          <DockedMinimizeIcon
            color={theme.palette.text.primary}
            height={"22"}
            width={"22"}
            onClickFunc={() => {
              setDockProductsToSave(false);
            }}
          />
        </DockedProductsToSaveCard>
      ) : (
        <ReusableModal
          customStyles={{ top: "5%", backgroundColor: "transparent" }}
          open={Object.keys(productsToSave).length > 0}
        >
          <ProductsToSaveCard>
            <ProductsCol container spacing={1}>
              {Object.keys(productsToSave).map((key: string) => {
                const product = productsToSave[key];
                const { id } = product;
                return (
                  <Grid
                    style={{ maxWidth: "100%", flexGrow: 1 }}
                    item
                    xs={12}
                    sm={3}
                    key={product?.id}
                  >
                    <ProductToSaveCard>
                      <CardHeader>{product?.title}</CardHeader>
                      <Bulletpoints>
                        <QortalSVG
                          color={"#000000"}
                          height={"22"}
                          width={"22"}
                        />{" "}
                        Price: {product?.price && product?.price[0].value} QORT
                      </Bulletpoints>
                      <Bulletpoints>
                        <LoyaltySVG
                          color={"#000000"}
                          height={"22"}
                          width={"22"}
                        />
                        Type: {product?.type}
                      </Bulletpoints>
                      <Bulletpoints>
                        <CategorySVG
                          color={"#000000"}
                          height={"22"}
                          width={"22"}
                        />
                        Category: {product?.category}
                      </Bulletpoints>
                      <TimesIcon
                        onClickFunc={() => handleRemoveConfirmation(id)}
                        color={"#000000"}
                        height={"22"}
                        width={"22"}
                      />
                    </ProductToSaveCard>
                  </Grid>
                );
              })}
            </ProductsCol>
            <CardButtonRow>
              <AddMoreButton onClick={() => setOpenAddProduct(true)}>
                Add Another Product
              </AddMoreButton>
              <CreateButton onClick={publishQDNResource}>
                Save Products
              </CreateButton>
            </CardButtonRow>
            <MinimizeIcon
              color={theme.palette.text.primary}
              height={"22"}
              width={"22"}
              onClickFunc={() => {
                setDockProductsToSave(true);
              }}
            />
          </ProductsToSaveCard>
        </ReusableModal>
      )}
      <TabPanel value={valueTab} index={0}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <NewProduct
            editProduct={productToEdit}
            onClose={() => {
              setProductToEdit(null);
            }}
            openAddProduct={openAddProduct}
            setOpenAddProduct={(val: boolean) => setOpenAddProduct(val)}
          />
        </Box>
        <SimpleTable
          // editProduct gets changed here, as what comes from the ProductManager only contains id, status, created, user & catalogueId. After this you'll have all the metadata as well.
          openProduct={product => {
            setProductToEdit(product);
          }}
          data={products}
        ></SimpleTable>
        <LazyLoad onLoadMore={handleGetProducts}></LazyLoad>
      </TabPanel>
      <TabPanel value={valueTab} index={1}>
        <ShowOrder
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          order={order}
          from="ProductManager"
        />
        <OrderTable
          openOrder={order => {
            setOrder(order);
            setIsOpen(true);
          }}
          data={orders}
          from="ProductManager"
        ></OrderTable>
        <LazyLoad onLoadMore={handleGetOrders}></LazyLoad>
      </TabPanel>

      {/* Confirm Remove Product from productsToSave in global state */}
      <Modal />
      {isShow && (
        <MultiplePublish
          isOpen={isShow}
          onError={(messageNotification)=> {
            onCancel()
          }}
          onSubmit={() => {
            onOk()
          }}
          publishes={publishes}
        />
      )}
    </ProductManagerContainer>
  );
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`mail-tabs-${index}`}
      aria-labelledby={`mail-tabs-${index}`}
      {...other}
      style={{
        width: "100%",
      }}
    >
      {value === index && children}
    </div>
  );
}
