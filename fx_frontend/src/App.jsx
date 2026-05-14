import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Trading from './pages/Trading'
import Transactions from './pages/Transactions'
import Rates from './pages/Rates'
import Observability from './pages/Observability'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/observability" element={<Observability />} />
      </Routes>
    </Layout>
  )
}