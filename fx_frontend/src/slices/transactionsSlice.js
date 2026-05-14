import { createSlice } from '@reduxjs/toolkit'

// ── Transactions ─────────────────────────────────────────────────────────────
export const transactionsSlice = createSlice({
  name: 'transactions',
  initialState: { filterCustomerId: null, filterPair: null, dateRange: null },
  reducers: {
    setFilterCustomerId: (state, action) => { state.filterCustomerId = action.payload },
    setFilterPair: (state, action) => { state.filterPair = action.payload },
    setDateRange: (state, action) => { state.dateRange = action.payload },
    clearFilters: (state) => { state.filterCustomerId = null; state.filterPair = null; state.dateRange = null },
  },
})

// ── Rates ─────────────────────────────────────────────────────────────────────
export const ratesSlice = createSlice({
  name: 'rates',
  initialState: { lastRefreshed: null, isStale: false },
  reducers: {
    setLastRefreshed: (state, action) => { state.lastRefreshed = action.payload },
    setStale: (state, action) => { state.isStale = action.payload },
  },
})

// ── UI ─────────────────────────────────────────────────────────────────────────
export const uiSlice = createSlice({
  name: 'ui',
  initialState: { toast: null, sidebarOpen: true, modal: null },
  reducers: {
    showToast: (state, action) => { state.toast = action.payload },
    clearToast: (state) => { state.toast = null },
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen },
    openModal: (state, action) => { state.modal = action.payload },
    closeModal: (state) => { state.modal = null },
  },
})

export default transactionsSlice.reducer