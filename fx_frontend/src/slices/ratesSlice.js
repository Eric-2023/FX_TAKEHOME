import { createSlice } from '@reduxjs/toolkit'

const ratesSlice = createSlice({
  name: 'rates',
  initialState: { lastRefreshed: null, isStale: false },
  reducers: {
    setLastRefreshed: (state, action) => { state.lastRefreshed = action.payload },
    setStale: (state, action) => { state.isStale = action.payload },
  },
})

export const { setLastRefreshed, setStale } = ratesSlice.actions
export default ratesSlice.reducer