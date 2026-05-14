import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Clock, Zap, ArrowLeftRight, CheckCircle } from 'lucide-react'
import {
  useGetCustomersQuery, useGetCustomerBalancesQuery,
  useGenerateQuoteMutation, useExecuteQuoteMutation,
} from '../services/fxApi'
import { setActiveQuote, clearActiveQuote } from '../slices/quotesSlice'
import { showToast, clearToast } from '../slices/uiSlice'
import { Card, CardHeader, CardBody, Button, Badge, Table, Tr, Td } from '../components/ui/index.jsx'
import { formatCurrency, formatRate, SUPPORTED_CURRENCIES, getCurrencyFlag } from '../utils/formatters'

export default function Trading() {
  const dispatch = useDispatch()
  const { activeQuote, timerSeconds } = useSelector(s => s.quotes)
  const [customerId, setCustomerId] = useState('')
  const [fromCcy, setFromCcy] = useState('USD')
  const [toCcy, setToCcy] = useState('KES')
  const [amount, setAmount] = useState('100')
  const [executed, setExecuted] = useState(false)

  const { data: customers = [] } = useGetCustomersQuery()
  const { data: balancesData } = useGetCustomerBalancesQuery(customerId, { skip: !customerId })
  const [generateQuote, { isLoading: generating }] = useGenerateQuoteMutation()
  const [executeQuote, { isLoading: executing }] = useExecuteQuoteMutation()

  const balances = balancesData?.balances || {}

  // Timer
  useEffect(() => {
    if (!activeQuote || timerSeconds <= 0) return
    const id = setTimeout(() => dispatch({ type: 'quotes/tickTimer' }), 1000)
    return () => clearTimeout(id)
  }, [activeQuote, timerSeconds, dispatch])

  const isExpired = timerSeconds <= 0
  const timerPct = Math.max(0, (timerSeconds / 60) * 100)
  const isUrgent = timerSeconds <= 15 && timerSeconds > 0

  const handleGenerate = async () => {
    if (!customerId || !amount || fromCcy === toCcy) return
    try {
      const result = await generateQuote({
        customer_id: customerId,
        from_currency: fromCcy,
        to_currency: toCcy,
        amount: parseFloat(amount),
      }).unwrap()
      dispatch(setActiveQuote(result))
      setExecuted(false)
      dispatch(showToast({ message: 'Quote generated — 60 seconds to execute', type: 'success' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    } catch (err) {
      dispatch(showToast({ message: err?.data?.detail || 'Failed to generate quote', type: 'danger' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    }
  }

  const handleExecute = async () => {
    if (!activeQuote || isExpired) return
    try {
      await executeQuote({
        quoteId: activeQuote.quote_id,
        customerId,
        idempotencyKey: `exec-${activeQuote.quote_id}`,
      }).unwrap()
      setExecuted(true)
      dispatch(clearActiveQuote())
      dispatch(showToast({ message: 'Trade executed — balances updated', type: 'success' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    } catch (err) {
      dispatch(showToast({ message: err?.data?.detail || 'Execution failed', type: 'danger' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    background: 'rgba(255,255,255,0.04)',
    color: '#F0F4FF', outline: 'none',
    transition: 'all 0.2s',
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#4A6080', marginBottom: 6, display: 'block',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* LEFT — Quote form */}
      <div>
        <Card style={{ marginBottom: 16 }}>
          <CardHeader title="Generate Quote" />
          <CardBody>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Customer</label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.name} — {c.customer_id.substring(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>From</label>
                <select value={fromCcy} onChange={e => setFromCcy(e.target.value)} style={inputStyle}>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c} value={c}>{getCurrencyFlag(c)} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <select value={toCcy} onChange={e => setToCcy(e.target.value)} style={inputStyle}>
                  {SUPPORTED_CURRENCIES.filter(c => c !== fromCcy).map(c => (
                    <option key={c} value={c}>{getCurrencyFlag(c)} {c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Amount ({fromCcy})</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                style={inputStyle}
              />
            </div>

            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!customerId || !amount || fromCcy === toCcy || generating}
              style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
            >
              <Zap size={14} />
              {generating ? 'Generating...' : 'Generate Quote'}
            </Button>
          </CardBody>
        </Card>

        {/* Balances */}
        {customerId && (
          <Card>
            <CardHeader title="Customer Balances" />
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {SUPPORTED_CURRENCIES.map(ccy => (
                  <div key={ccy} style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A6080', marginBottom: 4 }}>
                      {getCurrencyFlag(ccy)} {ccy}
                    </div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 500, color: '#F0F4FF' }}>
                      {formatCurrency(balances[ccy] || '0', ccy)}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      {/* RIGHT — Quote result */}
      <div>
        {activeQuote ? (
          <div style={{
            background: 'linear-gradient(135deg, #0A1628, #0F2040)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 16, padding: 24, marginBottom: 16,
            boxShadow: '0 0 40px rgba(0,212,255,0.08)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow orb */}
            <div style={{
              position: 'absolute', top: -40, right: -40, width: 140, height: 140,
              borderRadius: '50%', background: 'rgba(0,212,255,0.06)', pointerEvents: 'none',
            }} />

            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00D4FF', marginBottom: 8 }}>
              {activeQuote.from_currency} → {activeQuote.to_currency}
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'white', lineHeight: 1.1, marginBottom: 4, letterSpacing: '-0.5px' }}>
              {formatCurrency(activeQuote.final_amount, activeQuote.to_currency)}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              for {formatCurrency(activeQuote.amount, activeQuote.from_currency)}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 18 }}>
              Rate: {formatRate(activeQuote.rate)} · Spread: 50bps
            </div>

            {/* Timer */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Clock size={13} color={isUrgent ? '#FF3D57' : 'rgba(255,255,255,0.5)'} />
                <span style={{ fontSize: 12, color: isUrgent ? '#FF3D57' : 'rgba(255,255,255,0.5)' }}>
                  {isExpired ? 'Quote expired' : `Expires in ${timerSeconds}s`}
                </span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  width: `${timerPct}%`,
                  background: isUrgent ? '#FF3D57' : '#00D4FF',
                  transition: 'width 1s linear, background 0.3s',
                }} />
              </div>
            </div>

            <button
              onClick={handleExecute}
              disabled={isExpired || executing}
              style={{
                width: '100%', padding: '12px',
                borderRadius: 10, border: 'none',
                background: isExpired ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
                color: isExpired ? '#4A6080' : 'white',
                fontSize: 14, fontWeight: 600, cursor: isExpired ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                boxShadow: isExpired ? 'none' : '0 4px 20px rgba(0,212,255,0.3)',
              }}
            >
              {executing ? 'Executing...' : isExpired ? 'Quote Expired' : 'Execute Trade'}
            </button>
          </div>
        ) : executed ? (
          <Card style={{ padding: 32, textAlign: 'center', marginBottom: 16 }}>
            <CheckCircle size={40} color="#00C853" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FF', marginBottom: 6 }}>Trade Executed</div>
            <div style={{ fontSize: 13, color: '#8BA4C7' }}>Balances have been updated</div>
          </Card>
        ) : (
          <Card style={{ padding: 40, textAlign: 'center', marginBottom: 16 }}>
            <ArrowLeftRight size={36} color="#2A3F65" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, color: '#4A6080' }}>Generate a quote to see details here</div>
          </Card>
        )}

        {/* Quote ID info */}
        {activeQuote && (
          <Card>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Quote ID', activeQuote.quote_id?.substring(0, 16) + '...'],
                  ['Customer', activeQuote.customer_id?.substring(0, 16) + '...'],
                  ['Expires', new Date(activeQuote.expires_at).toLocaleTimeString()],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#4A6080' }}>{k}</span>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#8BA4C7' }}>{v}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}