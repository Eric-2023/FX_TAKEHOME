import { useState } from 'react'
import { RefreshCw, Activity, Zap, RotateCcw, AlertCircle, CheckCircle, Database } from 'lucide-react'
import { useGetHealthQuery, useGetMetricsQuery, useRefreshRatesMutation } from '../services/fxApi'
import { Card, CardHeader, CardBody, Button, Badge } from '../components/ui/index.jsx'

// Parse Prometheus text format
function parsePrometheus(text) {
  if (!text) return {}
  const result = {}
  const lines = text.split('\n').filter(l => !l.startsWith('#') && l.trim())
  for (const line of lines) {
    const match = line.match(/^(\w+)\s+([\d.e+]+)/)
    if (match) result[match[1]] = parseFloat(match[2])
  }
  return result
}

function MetricCard({ label, value, icon: Icon, color = '#00D4FF', description }) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A6080', marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#F0F4FF', lineHeight: 1, letterSpacing: '-0.5px' }}>
            {value !== undefined ? value.toLocaleString() : '—'}
          </div>
          {description && (
            <div style={{ fontSize: 11, color: '#4A6080', marginTop: 5 }}>{description}</div>
          )}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </Card>
  )
}

function HealthRow({ label, value, ok }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {ok
          ? <CheckCircle size={14} color="#00C853" />
          : <AlertCircle size={14} color="#FF3D57" />
        }
        <span style={{ fontSize: 13, color: '#C8D8F0' }}>{label}</span>
      </div>
      <span style={{
        fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
        color: ok ? '#00C853' : '#FF3D57',
      }}>
        {value}
      </span>
    </div>
  )
}

const MOCK_LOGS = [
  { time: '03:16:24', level: 'INFO',  event: 'quote_executed', detail: 'tx_id=0c0c71e6 USD->KES amount=100 final=13014.75 cid=req-003' },
  { time: '03:16:08', level: 'INFO',  event: 'quote_generated', detail: 'quote_id=a868a91d USD->KES amount=100 rate=130.1475 cid=req-002' },
  { time: '03:16:31', level: 'INFO',  event: 'idempotent_hit', detail: 'key=exec-a868a91d cid=req-004' },
  { time: '03:12:35', level: 'INFO',  event: 'customer_created', detail: 'id=a79d0eef cid=req-001' },
  { time: '03:01:13', level: 'ERROR', event: 'rate_refresh_failed', detail: 'age=0s error=HTTP 429 Too Many Requests — serving last known rates' },
  { time: '03:01:12', level: 'INFO',  event: 'fx_engine_started', detail: 'db=ok rates=seed_fallback' },
]

const levelColor = { INFO: '#00D4FF', ERROR: '#FF3D57', WARN: '#FFB300' }

export default function Observability() {
  const [metricsView, setMetricsView] = useState('cards')
  const { data: health } = useGetHealthQuery(undefined, { pollingInterval: 15000 })
  const { data: metricsRaw } = useGetMetricsQuery(undefined, { pollingInterval: 30000 })
  const [refreshRates] = useRefreshRatesMutation()

  const metrics = typeof metricsRaw === 'string' ? parsePrometheus(metricsRaw) : {}

  return (
    <div>
      {/* Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card>
          <CardHeader title="System Health" />
          <CardBody>
            <HealthRow label="API" value={health?.status === 'ok' ? 'Online' : 'Degraded'} ok={health?.status === 'ok'} />
            <HealthRow label="Database" value={health?.db === 'ok' ? 'Connected' : 'Disconnected'} ok={health?.db === 'ok'} />
            <HealthRow label="Rates" value={health?.rates_stale ? 'Stale' : 'Fresh'} ok={!health?.rates_stale} />
            <HealthRow label="Rate Source" value="exchangeratesapi.io" ok={true} />
            {health?.rates_last_updated && (
              <HealthRow
                label="Last Updated"
                value={new Date(health.rates_last_updated).toLocaleTimeString()}
                ok={!health.rates_stale}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="secondary" onClick={() => refreshRates()} style={{ justifyContent: 'center' }}>
                <RefreshCw size={13} /> Refresh Rates
              </Button>
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 12, color: '#4A6080',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                GET /metrics — Prometheus text format<br/>
                GET /healthz — DB + rate staleness
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FF' }}>Prometheus Metrics</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['cards', 'raw'].map(v => (
            <Button
              key={v} variant={metricsView === v ? 'primary' : 'ghost'}
              size="sm" onClick={() => setMetricsView(v)}
            >
              {v === 'cards' ? 'Cards' : 'Raw'}
            </Button>
          ))}
        </div>
      </div>

      {metricsView === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          <MetricCard label="Quotes Generated" value={metrics.fx_quotes_generated_total} icon={Zap} color="#00D4FF" description="Total since startup" />
          <MetricCard label="Quotes Executed" value={metrics.fx_quotes_executed_total} icon={Activity} color="#00C853" description="Successful executions" />
          <MetricCard label="Idempotent Hits" value={metrics.fx_idempotent_hits_total} icon={RotateCcw} color="#FFB300" description="Retries safely handled" />
          <MetricCard label="Rate Refreshes" value={metrics.fx_rate_refreshes_total} icon={RefreshCw} color="#00D4FF" description="Successful refreshes" />
          <MetricCard label="Refresh Failures" value={metrics.fx_rate_refresh_failures_total} icon={AlertCircle} color="#FF3D57" description="API failures caught" />
          <MetricCard label="Rates Stale" value={metrics.fx_rates_stale} icon={Database} color={metrics.fx_rates_stale ? '#FFB300' : '#00C853'} description={metrics.fx_rates_stale ? 'Older than 1 hour' : 'Within threshold'} />
        </div>
      ) : (
        <div style={{
          background: 'rgba(2,8,23,0.8)', borderRadius: 12, padding: 20,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
          color: 'rgba(255,255,255,0.6)', lineHeight: 2, marginBottom: 24,
          border: '1px solid rgba(255,255,255,0.06)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {typeof metricsRaw === 'string' ? metricsRaw : 'Loading metrics...'}
        </div>
      )}

      {/* Log viewer */}
      <div style={{ fontSize: 16, fontWeight: 600, color: '#F0F4FF', marginBottom: 16 }}>
        Structured Logs
      </div>
      <Card>
        <div style={{
          background: 'rgba(2,8,23,0.6)', borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Log header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 50px 160px 1fr',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#4A6080',
          }}>
            <span>Time</span><span>Level</span><span>Event</span><span>Detail</span>
          </div>
          {MOCK_LOGS.map((log, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '80px 50px 160px 1fr',
              padding: '9px 16px', alignItems: 'center',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              <span style={{ fontSize: 11, color: '#4A6080' }}>{log.time}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: levelColor[log.level] }}>{log.level}</span>
              <span style={{ fontSize: 11, color: '#00D4FF' }}>{log.event}</span>
              <span style={{ fontSize: 11, color: '#8BA4C7', wordBreak: 'break-all' }}>{log.detail}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}