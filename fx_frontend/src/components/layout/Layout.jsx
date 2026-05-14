import { NavLink, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  LayoutDashboard, Users, ArrowLeftRight, FileText,
  TrendingUp, Activity, Zap, Circle,
} from 'lucide-react'
import { useGetHealthQuery } from '../../services/fxApi'
import Toast from '../ui/Toast'

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/trading',       icon: ArrowLeftRight,  label: 'FX Trading' },
  { to: '/customers',     icon: Users,           label: 'Customers' },
  { to: '/transactions',  icon: FileText,        label: 'Transactions' },
  { to: '/rates',         icon: TrendingUp,      label: 'Live Rates' },
  { to: '/observability', icon: Activity,        label: 'Observability' },
]

const styles = {
  layout: {
    display: 'flex', minHeight: '100vh',
  },
  sidebar: {
    width: 220, flexShrink: 0,
    background: 'linear-gradient(180deg, #0A1628 0%, #020817 100%)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', flexDirection: 'column',
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
  },
  logoWrap: {
    padding: '22px 20px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  logoTop: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  logoIcon: {
    width: 32, height: 32, borderRadius: 8,
    background: 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 16px rgba(0,212,255,0.3)',
  },
  logoName: {
    fontSize: 15, fontWeight: 600, color: '#F0F4FF', letterSpacing: '-0.2px',
  },
  logoSub: {
    fontSize: 10, color: '#4A6080', letterSpacing: '0.15em',
    textTransform: 'uppercase', marginTop: 2,
  },
  nav: { padding: '14px 12px', flex: 1 },
  navSection: {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
    textTransform: 'uppercase', color: '#4A6080',
    padding: '0 8px', margin: '14px 0 6px',
  },
  bottom: {
    padding: '14px 12px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  userPill: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
  },
  avatar: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0,
  },
  userName: { fontSize: 12, fontWeight: 600, color: '#C8D8F0' },
  userRole: { fontSize: 10, color: '#4A6080' },
  main: { marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' },
  topbar: {
    position: 'sticky', top: 0, zIndex: 40,
    background: 'rgba(2,8,23,0.85)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '14px 28px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  content: { flex: 1, padding: '28px', overflowY: 'auto' },
}

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none' }}>
      {({ isActive }) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8, marginBottom: 2,
          cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 500 : 400,
          color: isActive ? '#00D4FF' : 'rgba(255,255,255,0.5)',
          background: isActive ? 'rgba(0,212,255,0.08)' : 'transparent',
          borderLeft: isActive ? '2px solid #00D4FF' : '2px solid transparent',
          transition: 'all 0.2s',
        }}>
          <Icon size={15} />
          {label}
        </div>
      )}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { data: health } = useGetHealthQuery(undefined, { pollingInterval: 30000 })
  const toast = useSelector(s => s.ui.toast)
  const location = useLocation()

  const pageTitle = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'FX Engine'

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logoWrap}>
          <div style={styles.logoTop}>
            <div style={styles.logoIcon}>
              <Zap size={16} color="white" />
            </div>
            <div>
              <div style={styles.logoName}>FX Engine</div>
              <div style={styles.logoSub}>GoHiTech v1.0</div>
            </div>
          </div>
        </div>

        <nav style={styles.nav}>
          <div style={styles.navSection}>Main</div>
          {NAV.slice(0, 4).map(n => <NavItem key={n.to} {...n} />)}
          <div style={styles.navSection}>System</div>
          {NAV.slice(4).map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div style={styles.bottom}>
          <div style={styles.userPill}>
            <div style={styles.avatar}>EM</div>
            <div>
              <div style={styles.userName}>Eric Musembi</div>
              <div style={styles.userRole}>Administrator</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={styles.main}>
        <header style={styles.topbar}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#F0F4FF' }}>{pageTitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Health indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 99,
              background: health?.status === 'ok'
                ? 'rgba(0,200,83,0.1)' : 'rgba(255,61,87,0.1)',
              border: `1px solid ${health?.status === 'ok'
                ? 'rgba(0,200,83,0.3)' : 'rgba(255,61,87,0.3)'}`,
              fontSize: 12, fontWeight: 500,
              color: health?.status === 'ok' ? '#00C853' : '#FF3D57',
            }}>
              <Circle size={7} fill="currentColor" />
              {health?.status === 'ok' ? 'API Online' : 'API Degraded'}
            </div>

            {/* Rates stale */}
            {health?.rates_stale && (
              <div style={{
                padding: '5px 12px', borderRadius: 99,
                background: 'rgba(255,179,0,0.1)',
                border: '1px solid rgba(255,179,0,0.3)',
                fontSize: 12, color: '#FFB300',
              }}>
                Rates Stale
              </div>
            )}
          </div>
        </header>

        <main style={styles.content}>
          {children}
        </main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}