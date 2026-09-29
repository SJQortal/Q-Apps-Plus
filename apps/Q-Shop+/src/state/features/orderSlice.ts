import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../store'
import { Product } from './storeSlice'

interface OrderState {
  hashMapOrders: Record<string, Order>
  orders: Order[]
  isOpen: boolean
}
const initialState: OrderState = {
  hashMapOrders: {},
  orders: [],
  isOpen: false
}
export interface TotalPriceDetails {
  totalPrice: number;
}

export interface ProductDetails {
  product: Product;
  catalogueId: string;
  quantity: number;
  pricePerUnit: number;
  totalProductPrice: number;
}

export type Details = TotalPriceDetails & Record<string, ProductDetails>;

interface Delivery {
  customerName: string
  shippingAddress: {
    streetAddress: string
    city: string
    region?: string
    state?: string
    country: string
    zipCode: string
  }
}

interface Payment {
  total: number
  currency: string
  transactionSignature: string
  arrrAddressUsed?:string
}
enum CommunicationMethod {
  QMail = 'Q-Mail'
}
export interface Order {
  created: number
  updated: number
  version?: number
  details?: Details
  delivery?: Delivery
  payment?: Payment
  communicationMethod?: CommunicationMethod[]
  user: string
  sellerName?: string
  storeName?: string
  id: string
  totalPrice?: number
  status?: string
  note?: string
}

export interface Status {
  status: string
}

export const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    upsertOrders: (state, action) => {
      action.payload.forEach((order: Order) => {
        const index = state.orders.findIndex((p) => p.id === order.id)
        if (index !== -1) {
          state.orders[index] = order
        } else {
          state.orders.push(order)
        }
      })
    },
    addToHashMap: (state, action) => {
      const order = action.payload
      state.hashMapOrders[order.id] = {
        ...order,
        totalPrice: order.details.totalPrice
      }
    },
    resetOrders: (state) => {
      state.orders = []
    },
  }
})

export const { upsertOrders, addToHashMap, resetOrders } = orderSlice.actions

export default orderSlice.reducer
