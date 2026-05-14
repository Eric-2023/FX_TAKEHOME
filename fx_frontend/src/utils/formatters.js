const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', KES: 'KSh ', NGN: '₦' }
const CURRENCY_NAMES = {
  USD: 'US Dollar', EUR: 'Euro',
  KES: 'Kenyan Shilling', NGN: 'Nigerian Naira',
}

export const formatCurrency = (amount, currency) => {
  const symbol = CURRENCY_SYMBOLS[currency] || ''
  const num = parseFloat(amount || 0)
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const formatRate = (rate) => {
  const num = parseFloat(rate || 0)
  if (num < 0.01) return num.toFixed(6)
  if (num < 1) return num.toFixed(4)
  return num.toFixed(4)
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-KE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export const truncateId = (id) => id ? id.substring(0, 8) : '—'

export const getCurrencyName = (code) => CURRENCY_NAMES[code] || code

export const getCurrencyFlag = (code) => {
  const flags = { USD: '🇺🇸', EUR: '🇪🇺', KES: '🇰🇪', NGN: '🇳🇬' }
  return flags[code] || '🌍'
}

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'KES', 'NGN']

export const CURRENCY_PAIRS = [
  'USD/KES', 'USD/NGN', 'USD/EUR',
  'EUR/KES', 'EUR/NGN', 'EUR/USD',
  'KES/NGN', 'KES/USD', 'KES/EUR',
  'NGN/KES', 'NGN/USD', 'NGN/EUR',
]