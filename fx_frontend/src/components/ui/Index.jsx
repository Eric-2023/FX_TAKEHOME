// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderTopColor: 'rgba(255,255,255,0.14)',
      borderRadius: 16,
      boxShadow: glow
        ? '0 8px 32px rgba(0,0,0,0.4), 0 0 20px rgba(0,212,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)'
        : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action, children }) {
  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {title && <span style={{ fontSize: 14, fontWeight: 600, color: '#F0F4FF' }}>{title}</span>}
      {children}
      {action}
    </div>
  )
}

export function CardBody({ children, style = {} }) {
  return <div style={{ padding: '20px', ...style }}>{children}</div>
}

// ── Badge ──────────────────────────────────────────────────────────────────────
const BADGE_STYLES = {
  success: { bg: 'rgba(0,200,83,0.12)', color: '#00C853', border: 'rgba(0,200,83,0.3)' },
  danger:  { bg: 'rgba(255,61,87,0.12)', color: '#FF3D57', border: 'rgba(255,61,87,0.3)' },
  warning: { bg: 'rgba(255,179,0,0.12)', color: '#FFB300', border: 'rgba(255,179,0,0.3)' },
  cyan:    { bg: 'rgba(0,212,255,0.12)', color: '#00D4FF', border: 'rgba(0,212,255,0.3)' },
  blue:    { bg: 'rgba(30,111,217,0.15)', color: '#3B82F6', border: 'rgba(30,111,217,0.3)' },
  muted:   { bg: 'rgba(255,255,255,0.06)', color: '#8BA4C7', border: 'rgba(255,255,255,0.1)' },
}

export function Badge({ children, variant = 'muted' }) {
  const s = BADGE_STYLES[variant] || BADGE_STYLES.muted
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', onClick, disabled, style = {}, size = 'md' }) {
  const sizes = { sm: '6px 14px', md: '9px 18px', lg: '12px 24px' }
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #1E6FD9, #00D4FF)',
      color: 'white', border: 'none',
      boxShadow: '0 4px 16px rgba(0,212,255,0.25)',
    },
    secondary: {
      background: 'transparent', color: '#00D4FF',
      border: '1px solid rgba(0,212,255,0.35)',
    },
    danger: {
      background: 'rgba(255,61,87,0.15)', color: '#FF3D57',
      border: '1px solid rgba(255,61,87,0.35)',
    },
    ghost: {
      background: 'rgba(255,255,255,0.05)', color: '#8BA4C7',
      border: '1px solid rgba(255,255,255,0.08)',
    },
  }
  const v = variants[variant] || variants.primary
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: sizes[size], borderRadius: 8,
        fontSize: 13, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.2s',
        fontFamily: 'Inter, sans-serif',
        ...v, ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, subColor, icon: Icon, accentColor = '#00D4FF' }) {
  return (
    <Card style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4A6080', marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#F0F4FF', lineHeight: 1, letterSpacing: '-0.5px' }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: subColor || '#8BA4C7', marginTop: 5 }}>
              {sub}
            </div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={accentColor} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ headers, children }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: '#4A6080',
                padding: '10px 16px', textAlign: 'left',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Tr({ children, onClick }) {
  return (
    <tr
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'rgba(0,212,255,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </tr>
  )
}

export function Td({ children, mono, style = {} }) {
  return (
    <td style={{
      padding: '11px 16px', fontSize: 13,
      color: '#C8D8F0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
      fontSize: mono ? 12 : 13,
      ...style,
    }}>
      {children}
    </td>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export default function Toast({ message, type = 'success' }) {
  const colors = {
    success: { border: '#00C853', icon: '✓' },
    danger:  { border: '#FF3D57', icon: '✕' },
    warning: { border: '#FFB300', icon: '!' },
    info:    { border: '#00D4FF', icon: 'i' },
  }
  const c = colors[type] || colors.info
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: 'rgba(10,22,40,0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderLeft: `3px solid ${c.border}`,
      borderRadius: 12,
      padding: '12px 18px',
      fontSize: 13, color: '#C8D8F0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideIn 0.3s ease',
      maxWidth: 320,
    }}>
      <span style={{ color: c.border, fontWeight: 700 }}>{c.icon}</span>
      {message}
    </div>
  )
}