import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { tickTimer, clearActiveQuote } from '../slices/quotesSlice'

export function useQuoteTimer() {
  const dispatch = useDispatch()
  const { activeQuote, timerSeconds } = useSelector((s) => s.quotes)

  useEffect(() => {
    if (!activeQuote || timerSeconds <= 0) return
    const id = setInterval(() => {
      dispatch(tickTimer())
    }, 1000)
    return () => clearInterval(id)
  }, [activeQuote, timerSeconds, dispatch])

  const isExpired = timerSeconds <= 0
  const pct = (timerSeconds / 60) * 100
  const isUrgent = timerSeconds <= 15

  return { timerSeconds, isExpired, pct, isUrgent }
}