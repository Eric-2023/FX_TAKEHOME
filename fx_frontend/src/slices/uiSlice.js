import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
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

export const { showToast, clearToast, toggleSidebar, openModal, closeModal } = uiSlice.actions
export default uiSlice.reducer