import { useDispatch } from 'react-redux'
import { RefreshCw, AlertTriangle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { useGetRatesQuery, useRefreshRatesMutation } from '../services/fxApi'
import { showToast, clearToast } from '../slices/uiSlice'
import { Card, CardHeader, CardBody, Button, Badge, Table, Tr, Td } from '../components/ui/index.jsx'
import { formatRate } from '../utils/formatters'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// Mock historical data for chart
const mockHistory = [
  { time: '00:00', rate: 128.2 },
  { time: '04:00', rate: 129.1 },
  { time: '08:00', rate: 130.5 },
  { time: '10:00', rate: 129.8 },
  { time: '12:00', rate: 131.2 },
  { time: '14:00', rate: 130.1 },
  { time: '16:00', rate: 130.8 },
  { time: 'Now',   rate: 130.15 },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(0,212,255,0.2)',
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
      }}>
        <div style={{ color: '#4A6080' }}>{label}</div>
        <div style={{ color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {payload[0].value.toFixed(4)}
        </div>
      </div>
    )
  }
  return null
}

export default function Rates() {
  const dispatch = useDispatch()
  const { data: ratesData, isLoading } = useGetRatesQuery(undefined, { pollingInterval: 60000 })
  const [refreshRates, { isLoading: refreshing }] = useRefreshRatesMutation()

  const rates = ratesData?.rates || {}
  const isStale = ratesData?.stale
  const lastUpdated = ratesData?.last_updated

  const handleRefresh = async () => {
    try {
      await refreshRates().unwrap()
      dispatch(showToast({ message: 'Rates refreshed successfully', type: 'success' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    } catch {
      dispatch(showToast({ message: 'Rate refresh failed — serving seed rates', type: 'warning' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    }
  }

  const spread = (buy, sell) => {
    const mid = (parseFloat(buy) + parseFloat(sell)) / 2
    const pct = ((parseFloat(sell) - parseFloat(buy)) / mid * 100).toFixed(2)
    return `${pct}%`
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          {lastUpdated && (
            <div style={{ fontSize: 12, color: '#4A6080', fontFamily: 'JetBrains Mono, monospace' }}>
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
        {isStale && (
          <Badge variant="warning">
            <AlertTriangle size={11} style={{ marginRight: 4 }} /> Stale
          </Badge>
        )}
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh Rates'}
        </Button>
      </div>

      {/* Chart — USD/KES */}
      <Card style={{ marginBottom: 20 }}>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF' }}>USD/KES — Today</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#00D4FF' }}>
              {rates['USD/KES'] ? formatRate(rates['USD/KES']?.sell) : '—'}
            </span>
            <span style={{ fontSize: 11, color: '#00C853' }}>▲ 0.46%</span>
          </div>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={mockHistory}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#4A6080' }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#4A6080' }} axisLine={false} tickLine={false} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone" dataKey="rate"
                stroke="#00D4FF" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#00D4FF' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* All rates table */}
      <Card>
        <CardHeader title="All Currency Pairs" />
        <Table headers={['Pair', 'Buy Rate', 'Sell Rate', 'Spread', 'Mid Rate']}>
          {isLoading ? (
            <Tr><Td style={{ textAlign: 'center', padding: 32, color: '#4A6080' }}>Loading rates...</Td></Tr>
          ) : Object.entries(rates).map(([pair, rate]) => {
            const mid = ((parseFloat(rate.buy) + parseFloat(rate.sell)) / 2)
            return (
              <Tr key={pair}>
                <Td>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
                    fontWeight: 600, color: '#00D4FF',
                  }}>
                    {pair}
                  </span>
                </Td>
                <Td mono style={{ color: '#00C853' }}>{formatRate(rate.buy)}</Td>
                <Td mono style={{ color: '#FF3D57' }}>{formatRate(rate.sell)}</Td>
                <Td>
                  <Badge variant="muted">{spread(rate.buy, rate.sell)}</Badge>
                </Td>
                <Td mono style={{ color: '#8BA4C7' }}>{formatRate(mid)}</Td>
              </Tr>
            )
          })}
          {!isLoading && Object.keys(rates).length === 0 && (
            <Tr><Td style={{ textAlign: 'center', padding: 32, color: '#4A6080' }}>No rates available</Td></Tr>
          )}
        </Table>
      </Card>
    </div>
  )
}