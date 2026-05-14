import { useDispatch } from 'react-redux'
import { showToast, clearToast } from '../slices/uiSlice'

export function useToast() {
  const dispatch = useDispatch()

  const toast = (message, type = 'success') => {
    dispatch(showToast({ message, type }))
    setTimeout(() => dispatch(clearToast()), 3500)
  }

  return { toast }
}