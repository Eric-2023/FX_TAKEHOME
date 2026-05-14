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
      maxWidth: 320,
    }}>
      <span style={{ color: c.border, fontWeight: 700 }}>{c.icon}</span>
      {message}
    </div>
  )
}