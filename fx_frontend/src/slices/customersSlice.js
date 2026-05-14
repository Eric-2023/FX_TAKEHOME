// customersSlice.js
import { createSlice } from '@reduxjs/toolkit'

const customersSlice = createSlice({
  name: 'customers',
  initialState: { selectedId: null, searchQuery: '' },
  reducers: {
    selectCustomer: (state, action) => { state.selectedId = action.payload },
    setSearchQuery: (state, action) => { state.searchQuery = action.payload },
  },
})

export const { selectCustomer, setSearchQuery } = customersSlice.actions
export default customersSlice.reducer