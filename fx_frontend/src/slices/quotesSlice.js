import { createSlice } from '@reduxjs/toolkit'

const quotesSlice = createSlice({
  name: 'quotes',
  initialState: {
    activeQuote: null,
    timerSeconds: 0,
    filterCustomerId: null,
  },
  reducers: {
    setActiveQuote: (state, action) => {
      state.activeQuote = action.payload
      state.timerSeconds = 60
    },
    clearActiveQuote: (state) => {
      state.activeQuote = null
      state.timerSeconds = 0
    },
    tickTimer: (state) => {
      if (state.timerSeconds > 0) state.timerSeconds -= 1
    },
    setFilterCustomerId: (state, action) => {
      state.filterCustomerId = action.payload
    },
  },
})

export const { setActiveQuote, clearActiveQuote, tickTimer, setFilterCustomerId } = quotesSlice.actions
export default quotesSlice.reducer