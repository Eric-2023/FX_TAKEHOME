import { configureStore } from '@reduxjs/toolkit'
import { fxApi } from '../services/fxApi'
import customersReducer from '../slices/customersSlice'
import quotesReducer from '../slices/quotesSlice'
import transactionsReducer from '../slices/transactionsSlice'
import ratesReducer from '../slices/ratesSlice'
import uiReducer from '../slices/uiSlice'

export const store = configureStore({
  reducer: {
    [fxApi.reducerPath]: fxApi.reducer,
    customers: customersReducer,
    quotes: quotesReducer,
    transactions: transactionsReducer,
    rates: ratesReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(fxApi.middleware),
})