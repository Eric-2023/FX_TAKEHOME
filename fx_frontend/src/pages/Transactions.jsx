import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { useGetTransactionsQuery, useGetCustomersQuery } from '../services/fxApi'
import { Card, CardHeader, Badge, Button, Table, Tr, Td } from '../components/ui/index.jsx'
import { formatCurrency, formatDate, formatRate, truncateId, CURRENCY_PAIRS } from '../utils/formatters'

function TransactionDetail({ tx, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(2,8,23,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'linear-gradient(135deg, rgba(15,32,64,0.98), rgba(10,22,40,0.98))',
        border: '1px solid rgba(0,212,255,0.15)',
        borderRadius: 20, padding: 28,
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FF' }}>Transaction Detail</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A6080' }}>
            <X size={20} />
          </button>
        </div>

        {/* Pair header */}
        <div style={{
          textAlign: 'center', padding: '20px 0 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00D4FF', marginBottom: 8 }}>
            {tx.from_currency} → {tx.to_currency}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'white', lineHeight: 1, marginBottom: 4 }}>
            {formatCurrency(tx.final_amount, tx.to_currency)}
          </div>
          <div style={{ fontSize: 13, color: '#4A6080', fontFamily: 'JetBrains Mono, monospace' }}>
            for {formatCurrency(tx.amount, tx.from_currency)}
          </div>
        </div>

        {/* Fields */}
        {[
          ['Transaction ID', tx.transaction_id, true],
          ['Quote ID', tx.quote_id, true],
          ['Customer ID', tx.customer_id, true],
          ['Rate', formatRate(tx.rate), true],
          ['Executed At', formatDate(tx.executed_at), false],
        ].map(([label, value, mono]) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ fontSize: 12, color: '#4A6080' }}>{label}</span>
            <span style={{
              fontSize: 12, color: '#8BA4C7', wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%',
              fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Transactions() {
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterPair, setFilterPair] = useState('')
  const [selected, setSelected] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: transactions = [], isLoading } = useGetTransactionsQuery(filterCustomer || undefined)
  const { data: customers = [] } = useGetCustomersQuery()

  const filtered = transactions.filter(tx => {
    if (filterPair) {
      const pair = `${tx.from_currency}/${tx.to_currency}`
      if (pair !== filterPair) return false
    }
    return true
  })

  const selectStyle = {
    padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif',
    background: 'rgba(255,255,255,0.04)', color: '#F0F4FF', outline: 'none',
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: '#8BA4C7' }}>
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={() => setShowFilters(v => !v)}>
          <Filter size={13} /> Filters
        </Button>
        {(filterCustomer || filterPair) && (
          <Button variant="danger" size="sm" onClick={() => { setFilterCustomer(''); setFilterPair('') }}>
            <X size={12} /> Clear
          </Button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 6 }}>Customer</div>
              <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} style={selectStyle}>
                <option value="">All customers</option>
                {customers.map(c => (
                  <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 6 }}>Pair</div>
              <select value={filterPair} onChange={e => setFilterPair(e.target.value)} style={selectStyle}>
                <option value="">All pairs</option>
                {CURRENCY_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        <Table headers={['Transaction ID', 'Pair', 'Amount', 'Final Amount', 'Rate', 'Executed At']}>
          {isLoading ? (
            <Tr><Td style={{ textAlign: 'center', padding: 32, color: '#4A6080' }}>Loading...</Td></Tr>
          ) : filtered.map(tx => (
            <Tr key={tx.transaction_id} onClick={() => setSelected(tx)}>
              <Td mono>{truncateId(tx.transaction_id)}</Td>
              <Td>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                  color: '#00D4FF', background: 'rgba(0,212,255,0.08)',
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {tx.from_currency}→{tx.to_currency}
                </span>
              </Td>
              <Td mono>{formatCurrency(tx.amount, tx.from_currency)}</Td>
              <Td mono>{formatCurrency(tx.final_amount, tx.to_currency)}</Td>
              <Td mono>{formatRate(tx.rate)}</Td>
              <Td style={{ color: '#4A6080', fontSize: 12 }}>{formatDate(tx.executed_at)}</Td>
            </Tr>
          ))}
          {!isLoading && filtered.length === 0 && (
            <Tr><Td style={{ textAlign: 'center', padding: 32, color: '#4A6080' }}>No transactions found</Td></Tr>
          )}
        </Table>
      </Card>

      {selected && <TransactionDetail tx={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}