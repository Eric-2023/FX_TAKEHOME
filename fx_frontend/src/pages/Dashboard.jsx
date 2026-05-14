import { TrendingUp, Users, Zap, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useGetHealthQuery, useGetTransactionsQuery, useGetRatesQuery, useGetCustomersQuery } from '../services/fxApi'
import { Card, CardHeader, CardBody, StatCard, Badge, Table, Tr, Td } from '../components/ui/index.jsx'
import { formatCurrency, formatDateShort, truncateId } from '../utils/formatters'

const statusVariant = (executed) => executed ? 'success' : 'warning'

export default function Dashboard() {
  const { data: health } = useGetHealthQuery()
  const { data: transactions = [] } = useGetTransactionsQuery()
  const { data: ratesData } = useGetRatesQuery()
  const { data: customers = [] } = useGetCustomersQuery()

  const rates = ratesData?.rates || {}
  const topPairs = Object.entries(rates).slice(0, 3)

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard
          label="Total Customers"
          value={customers.length}
          sub="Active accounts"
          icon={Users}
          accentColor="#00D4FF"
        />
        <StatCard
          label="Total Transactions"
          value={transactions.length}
          sub="All time"
          icon={Zap}
          accentColor="#00C853"
        />
        <StatCard
          label="DB Status"
          value={health?.status === 'ok' ? 'Online' : 'Degraded'}
          sub={health?.status === 'ok' ? 'All systems nominal' : 'Check connection'}
          icon={TrendingUp}
          accentColor={health?.status === 'ok' ? '#00C853' : '#FF3D57'}
        />
        <StatCard
          label="Rates Stale"
          value={health?.rates_stale ? 'Yes' : 'No'}
          sub={`Updated: ${health?.rates_last_updated ? new Date(health.rates_last_updated).toLocaleTimeString() : '—'}`}
          icon={RefreshCw}
          accentColor={health?.rates_stale ? '#FFB300' : '#00C853'}
        />
      </div>

      {/* Two column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Recent transactions */}
        <Card>
          <CardHeader title="Recent Transactions">
            <Badge variant="cyan">Live</Badge>
          </CardHeader>
          <Table headers={['ID', 'Pair', 'Amount', 'Final', 'Date']}>
            {transactions.slice(0, 8).map(tx => (
              <Tr key={tx.transaction_id}>
                <Td mono>{truncateId(tx.transaction_id)}</Td>
                <Td mono>{tx.from_currency}→{tx.to_currency}</Td>
                <Td mono>{formatCurrency(tx.amount, tx.from_currency)}</Td>
                <Td mono>{formatCurrency(tx.final_amount, tx.to_currency)}</Td>
                <Td style={{ color: '#4A6080', fontSize: 11 }}>{formatDateShort(tx.executed_at)}</Td>
              </Tr>
            ))}
            {transactions.length === 0 && (
              <Tr><Td style={{ color: '#4A6080', textAlign: 'center', padding: 32 }} colSpan={5}>No transactions yet</Td></Tr>
            )}
          </Table>
        </Card>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Top pairs */}
          <Card>
            <CardHeader title="Live Rates" />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topPairs.map(([pair, rate]) => (
                  <div key={pair} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#8BA4C7' }}>{pair}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: '#F0F4FF' }}>
                        {parseFloat(rate.sell).toFixed(4)}
                      </div>
                      <div style={{ fontSize: 10, color: '#4A6080' }}>
                        Buy: {parseFloat(rate.buy).toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))}
                {topPairs.length === 0 && (
                  <div style={{ color: '#4A6080', fontSize: 13, textAlign: 'center' }}>No rates loaded</div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Customers */}
          <Card>
            <CardHeader title="Customers" />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {customers.slice(0, 4).map(c => (
                  <div key={c.customer_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                      {c.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: '#C8D8F0', fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: '#4A6080', fontFamily: 'JetBrains Mono, monospace' }}>
                        {truncateId(c.customer_id)}
                      </div>
                    </div>
                  </div>
                ))}
                {customers.length === 0 && (
                  <div style={{ color: '#4A6080', fontSize: 13, textAlign: 'center' }}>No customers yet</div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}