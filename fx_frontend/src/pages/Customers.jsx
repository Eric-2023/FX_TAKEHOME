import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Search, Plus, X, ChevronRight } from 'lucide-react'
import {
  useGetCustomersQuery,
  useCreateCustomerMutation,
  useGetCustomerBalancesQuery,
  useCreditBalanceMutation,
  useGetTransactionsQuery,
} from '../services/fxApi'
import { showToast, clearToast } from '../slices/uiSlice'
import { Card, CardHeader, CardBody, Button, Badge, Table, Tr, Td } from '../components/ui/index.jsx'
import { formatCurrency, formatDateShort, truncateId, SUPPORTED_CURRENCIES, getCurrencyFlag } from '../utils/formatters'

function CustomerDetail({ customer, onClose }) {
  const dispatch = useDispatch()
  const { data: balancesData } = useGetCustomerBalancesQuery(customer.customer_id)
  const { data: transactions = [] } = useGetTransactionsQuery(customer.customer_id)
  const [creditBalance] = useCreditBalanceMutation()
  const [creditForm, setCreditForm] = useState({ currency: 'USD', amount: '' })
  const [showCredit, setShowCredit] = useState(false)

  const balances = balancesData?.balances || {}

  const handleCredit = async () => {
    try {
      await creditBalance({
        customerId: customer.customer_id,
        currency: creditForm.currency,
        amount: parseFloat(creditForm.amount),
      }).unwrap()
      dispatch(showToast({ message: `Credited ${creditForm.amount} ${creditForm.currency}`, type: 'success' }))
      setTimeout(() => dispatch(clearToast()), 3500)
      setShowCredit(false)
      setCreditForm({ currency: 'USD', amount: '' })
    } catch (err) {
      dispatch(showToast({ message: err?.data?.detail || 'Credit failed', type: 'danger' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    }
  }

  const inputStyle = {
    padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif',
    background: 'rgba(255,255,255,0.04)', color: '#F0F4FF', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(2,8,23,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 700,
        background: 'linear-gradient(135deg, rgba(15,32,64,0.98), rgba(10,22,40,0.98))',
        border: '1px solid rgba(0,212,255,0.15)',
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.06)',
        maxHeight: '85vh', overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'white',
              boxShadow: '0 0 20px rgba(0,212,255,0.3)',
            }}>
              {customer.name?.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: '#F0F4FF' }}>{customer.name}</div>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#4A6080' }}>
                {customer.customer_id}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A6080' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Balances */}
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A6080', marginBottom: 12 }}>
            Balances
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {SUPPORTED_CURRENCIES.map(ccy => (
              <div key={ccy} style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A6080', marginBottom: 4 }}>
                  {getCurrencyFlag(ccy)} {ccy}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: '#F0F4FF' }}>
                  {formatCurrency(balances[ccy] || '0', ccy)}
                </div>
              </div>
            ))}
          </div>

          {/* Credit form */}
          {showCredit ? (
            <div style={{
              padding: 16, borderRadius: 12, marginBottom: 20,
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.15)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#00D4FF', marginBottom: 12 }}>Credit Balance</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 6 }}>Currency</div>
                  <select value={creditForm.currency} onChange={e => setCreditForm(p => ({ ...p, currency: e.target.value }))} style={inputStyle}>
                    {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 6 }}>Amount</div>
                  <input
                    type="number" value={creditForm.amount}
                    onChange={e => setCreditForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00" style={{ ...inputStyle, width: '100%' }}
                  />
                </div>
                <Button variant="primary" onClick={handleCredit} disabled={!creditForm.amount}>Credit</Button>
                <Button variant="ghost" onClick={() => setShowCredit(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setShowCredit(true)} style={{ marginBottom: 20 }}>
              <Plus size={13} /> Credit Balance
            </Button>
          )}

          {/* Transaction history */}
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A6080', marginBottom: 12 }}>
            Transaction History
          </div>
          <Card>
            <Table headers={['ID', 'Pair', 'Amount', 'Final', 'Date']}>
              {transactions.slice(0, 10).map(tx => (
                <Tr key={tx.transaction_id}>
                  <Td mono>{truncateId(tx.transaction_id)}</Td>
                  <Td mono>{tx.from_currency}→{tx.to_currency}</Td>
                  <Td mono>{formatCurrency(tx.amount, tx.from_currency)}</Td>
                  <Td mono>{formatCurrency(tx.final_amount, tx.to_currency)}</Td>
                  <Td style={{ color: '#4A6080', fontSize: 11 }}>{formatDateShort(tx.executed_at)}</Td>
                </Tr>
              ))}
              {transactions.length === 0 && (
                <Tr><Td style={{ color: '#4A6080', textAlign: 'center', padding: 24 }}>No transactions yet</Td></Tr>
              )}
            </Table>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function Customers() {
  const dispatch = useDispatch()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const { data: customers = [], isLoading } = useGetCustomersQuery()
  const [createCustomer, { isLoading: creating }] = useCreateCustomerMutation()

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createCustomer({ name: newName.trim() }).unwrap()
      dispatch(showToast({ message: `Customer "${newName}" created`, type: 'success' }))
      setTimeout(() => dispatch(clearToast()), 3500)
      setNewName('')
      setShowCreate(false)
    } catch (err) {
      dispatch(showToast({ message: err?.data?.detail || 'Failed to create customer', type: 'danger' }))
      setTimeout(() => dispatch(clearToast()), 3500)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Search size={15} color="#4A6080" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customers..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#F0F4FF', fontFamily: 'Inter, sans-serif' }}
          />
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> New Customer
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 6 }}>Customer Name</div>
              <input
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Full name"
                style={{ width: '100%', padding: '9px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(255,255,255,0.04)', color: '#F0F4FF', outline: 'none', fontFamily: 'Inter, sans-serif' }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card>
        <Table headers={['Customer', 'ID', 'Joined', '']}>
          {isLoading ? (
            <Tr><Td style={{ textAlign: 'center', padding: 32, color: '#4A6080' }}>Loading...</Td></Tr>
          ) : filtered.map(c => (
            <Tr key={c.customer_id} onClick={() => setSelected(c)}>
              <Td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {c.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 500, color: '#C8D8F0' }}>{c.name}</span>
                </div>
              </Td>
              <Td mono>{truncateId(c.customer_id)}</Td>
              <Td style={{ color: '#4A6080', fontSize: 12 }}>{formatDateShort(c.created_at)}</Td>
              <Td><ChevronRight size={15} color="#4A6080" /></Td>
            </Tr>
          ))}
          {!isLoading && filtered.length === 0 && (
            <Tr><Td style={{ textAlign: 'center', padding: 32, color: '#4A6080' }}>No customers found</Td></Tr>
          )}
        </Table>
      </Card>

      {selected && <CustomerDetail customer={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}