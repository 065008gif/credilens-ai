import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, BarChart3, Building2, Check, ChevronDown, CircleAlert, Clock3,
  FileText, Gauge, Landmark, LoaderCircle, RefreshCw, ShieldCheck, Sparkles,
  TrendingDown, TrendingUp, WalletCards, ExternalLink, Activity, Database, Newspaper
} from 'lucide-react';
import './styles.css';

type Decision = 'Approve' | 'Review' | 'Reject';

type AnyRecord = Record<string, any>;

type Result = {
  companyName: string;
  symbol: string;
  decision: Decision;
  proposed_exposure: number;
  currency: string;
  overall_confidence: number;
  credit_metrics: {
    financial_health?: number;
    cash_flow?: number;
    repayment_capacity?: number;
    deterministic_score?: number;
    financial_health_score?: number;
    cash_flow_score?: number;
    repayment_capacity_score?: number;
  };
  key_risks: string[];
  mitigating_conditions: string[];
  supporting_evidence: string[];
  committee_rationale?: string;
  committee_fallback?: boolean;
  requested_exposure?: number;
  financials?: AnyRecord;
  ratios?: AnyRecord;
  statements?: AnyRecord;
  derivedRatios?: AnyRecord;
  stressTests?: AnyRecord;
  anomalyFlags?: string[];
  dataQuality?: { missingFields?: string[]; missingCount?: number; completenessScore?: number };
  marketNews?: Array<{ title?: string; publisher?: string; link?: string; publishedAt?: string }>;
  agentAssessments?: AnyRecord;
  generatedAt?: string;
};

const money = (n: number | null | undefined, c = 'INR') => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: c || 'INR',
      maximumFractionDigits: 0
    }).format(Number(n));
  } catch {
    return `₹${Number(n).toLocaleString('en-IN')}`;
  }
};

const number = (n: number | null | undefined, digits = 2) =>
  n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(digits);

const pretty = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase());

const score = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

function unwrapResponse(raw: any): AnyRecord {
  if (Array.isArray(raw)) return raw[0]?.json ?? raw[0] ?? {};
  if (raw?.data && typeof raw.data === 'object') return raw.data;
  if (raw?.body && typeof raw.body === 'object') return raw.body;
  return raw ?? {};
}

function normalizeResult(raw: any, requestedAmount: number): Result {
  const r = unwrapResponse(raw);
  const metrics = r.credit_metrics ?? {};
  const financials = r.financials ?? r.statements ?? {};
  const ratios = r.ratios ?? r.derivedRatios ?? {};

  const fh = score(metrics.financial_health ?? metrics.financial_health_score);
  const cf = score(metrics.cash_flow ?? metrics.cash_flow_score);
  const rp = score(metrics.repayment_capacity ?? metrics.repayment_capacity_score);
  const deterministic = score(metrics.deterministic_score);

  const decision = ['Approve', 'Review', 'Reject'].includes(r.decision) ? r.decision : 'Review';

  return {
    companyName: r.companyName || 'Unknown company',
    symbol: r.symbol || '—',
    decision,
    proposed_exposure: Number(r.proposed_exposure ?? 0),
    currency: r.currency || 'INR',
    overall_confidence: score(r.overall_confidence) ?? 0,
    credit_metrics: {
      financial_health: fh ?? deterministic ?? undefined,
      cash_flow: cf ?? deterministic ?? undefined,
      repayment_capacity: rp ?? deterministic ?? undefined,
      deterministic_score: deterministic ?? undefined
    },
    key_risks: Array.isArray(r.key_risks) ? r.key_risks.filter(Boolean).map(String) : [],
    mitigating_conditions: Array.isArray(r.mitigating_conditions) ? r.mitigating_conditions.filter(Boolean).map(String) : [],
    supporting_evidence: Array.isArray(r.supporting_evidence) ? r.supporting_evidence.filter(Boolean).map(String) : [],
    committee_rationale: r.committee_rationale,
    committee_fallback: Boolean(r.committee_fallback),
    requested_exposure: Number(r.requested_exposure ?? requestedAmount),
    financials,
    ratios,
    stressTests: r.stressTests ?? {},
    anomalyFlags: Array.isArray(r.anomalyFlags) ? r.anomalyFlags.filter(Boolean).map(String) : [],
    dataQuality: r.dataQuality ?? {},
    marketNews: Array.isArray(r.marketNews) ? r.marketNews : [],
    agentAssessments: r.agentAssessments ?? {},
    generatedAt: r.generatedAt
  };
}

async function runAnalysis(company: string, amount: number): Promise<Result> {
  const url = String(import.meta.env.VITE_N8N_WEBHOOK_URL || '').trim();
  if (!url) {
    throw new Error('VITE_N8N_WEBHOOK_URL is not configured. Add it to the frontend .env file and restart Vite.');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 180000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ companyName: company, requestedAmount: amount }),
      signal: controller.signal
    });

    const text = await res.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!res.ok) {
      const detail = typeof data?.message === 'string' ? data.message : `n8n returned HTTP ${res.status}`;
      throw new Error(detail);
    }

    if (data?.raw && typeof data.raw === 'string') {
      throw new Error('n8n returned a non-JSON response. Check the Return Credit Decision node.');
    }

    return normalizeResult(data, amount);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('The analysis timed out after 3 minutes. Check the latest n8n execution.');
    }
    throw e;
  } finally {
    window.clearTimeout(timeout);
  }
}

function App() {
  const [company, setCompany] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    const requested = Number(amount);
    if (!company.trim() || requested <= 0) {
      setError('Enter a company or ticker and a positive requested amount.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      setResult(await runAnalysis(company.trim(), requested));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Check your n8n webhook.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header>
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={18} /></div>
          <span>CrediLens</span><em>AI</em>
        </div>
        <div className="status"><span className="pulse" /> Credit intelligence engine <span className="dot">•</span> Live</div>
      </header>

      <main>
        {!result && !loading ? (
          <section className="hero">
            <div className="eyebrow"><Sparkles size={14} /> AI-ASSISTED UNDERWRITING</div>
            <h1>Know the risk<br /><span>before the capital.</span></h1>
            <p className="hero-copy">
              Turn public financial data into a defensible credit decision in minutes, not hours.
            </p>

            <div className="intake">
              <div className="field">
                <label>Company or ticker</label>
                <div className="input-wrap">
                  <Building2 size={18} />
                  <input
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && analyze()}
                    placeholder="e.g. Infosys or INFY.NS"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="field amount">
                <label>Requested exposure</label>
                <div className="input-wrap">
                  <span className="currency">₹</span>
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && analyze()}
                    placeholder="20,00,00,000"
                  />
                </div>
              </div>
              <button className="analyze" onClick={analyze} disabled={loading}>
                Run analysis <ArrowUpRight size={18} />
              </button>
            </div>

            {error && <div className="error"><CircleAlert size={16} />{error}</div>}

            <div className="trust-row">
              <span><Database size={15} /> Yahoo Finance fundamentals</span>
              <span><Sparkles size={15} /> Groq multi-agent analysis</span>
              <span><Landmark size={15} /> Credit committee decision</span>
            </div>
          </section>
        ) : loading ? (
          <Loading company={company} />
        ) : (
          <Dashboard result={result!} onReset={() => { setResult(null); setCompany(''); setAmount(''); }} />
        )}
      </main>

      <footer><span>CrediLens AI</span><span>Credit intelligence workspace</span><span>v2.0</span></footer>
    </div>
  );
}

function Loading({ company }: { company: string }) {
  const [active, setActive] = useState(0);
  const steps = [
    'Application received',
    'Company identified',
    'Financial statements retrieved',
    'Financial data normalized',
    'Specialist agents assess risk',
    'Credit committee challenges findings',
    'Decision package prepared'
  ];

  useEffect(() => {
    const id = window.setInterval(() => setActive(v => Math.min(v + 1, steps.length - 1)), 3500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="loading">
      <div className="loading-top">
        <div>
          <div className="eyebrow"><LoaderCircle size={14} /> UNDERWRITING IN PROGRESS</div>
          <h2>Analyzing <span>{company}</span></h2>
          <p>CrediLens is cross-checking financial, cash-flow and market signals.</p>
        </div>
        <div className="loading-chip"><span className="mini-pulse" /> LIVE ANALYSIS</div>
      </div>

      <div className="pipeline">
        {steps.map((s, i) => (
          <div className="step" key={s}>
            <div className={'step-icon ' + (i < active ? 'done' : i === active ? 'active' : '')}>
              {i < active ? <Check size={15} /> : i === active ? <LoaderCircle className="spin" size={15} /> : <span>{i + 1}</span>}
            </div>
            <div><b>{s}</b><small>{i < active ? 'Completed' : i === active ? 'Processing now' : 'Queued'}</small></div>
          </div>
        ))}
      </div>

      <div className="scan"><div className="scan-line" /><span>Cross-checking financial signals</span><Activity size={14} /></div>
    </section>
  );
}

function Dashboard({ result: r, onReset }: { result: Result; onReset: () => void }) {
  const scoreValue = r.overall_confidence;
  const decisionClass = r.decision.toLowerCase();
  const ratios = r.ratios ?? {};
  const financials = r.financials ?? {};

  const ratioEntries = Object.entries(ratios).filter(([k]) =>
    ['currentRatio', 'debtToEquity', 'netMargin', 'grossMargin', 'operatingMargin', 'interestCoverage', 'operatingCashFlowToDebt', 'fcfToDebt', 'cashToDebt'].includes(k)
  );

  const statementEntries = Object.entries(financials).filter(([, v]) => typeof v === 'number').slice(0, 10);

  return (
    <section className="dashboard">
      <div className="dash-head">
        <div>
          <div className="eyebrow"><Gauge size={14} /> CREDIT COMMITTEE</div>
          <h2>{r.companyName}</h2>
          <div className="meta"><span>{r.symbol}</span><span>•</span><span>AI underwriting report</span></div>
        </div>
        <button className="ghost" onClick={onReset}><RefreshCw size={16} /> New analysis</button>
      </div>

      <div className="decision-grid">
        <div className={'decision-card ' + decisionClass}>
          <div className="decision-label">FINAL DECISION</div>
          <div className="decision-word">{r.decision}</div>
          <div className="exposure-label">Proposed exposure</div>
          <strong>{money(r.proposed_exposure, r.currency)}</strong>
          <div className="decision-foot"><span>Committee confidence</span><b>{scoreValue}/100</b></div>
          <div className="confidence"><i style={{ width: `${scoreValue}%` }} /></div>
        </div>

        <Metric title="Financial health" value={r.credit_metrics.financial_health} icon={<BarChart3 size={18} />} />
        <Metric title="Cash flow" value={r.credit_metrics.cash_flow} icon={<TrendingUp size={18} />} />
        <Metric title="Repayment capacity" value={r.credit_metrics.repayment_capacity} icon={<WalletCards size={18} />} />
      </div>

      <div className="summary-strip">
        <div><span>Requested exposure</span><b>{money(r.requested_exposure, r.currency)}</b></div>
        <div><span>Data completeness</span><b>{r.dataQuality?.completenessScore != null ? `${r.dataQuality.completenessScore}%` : '—'}</b></div>
        <div><span>Anomaly flags</span><b>{r.anomalyFlags?.length ?? 0}</b></div>
        <div><span>Assessment mode</span><b>{r.committee_fallback ? 'Safeguard fallback' : 'AI committee'}</b></div>
      </div>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <div><span className="panel-kicker">EVIDENCE</span><h3>Credit rationale</h3></div>
            <FileText size={18} />
          </div>

          {r.committee_rationale && (
            <div className="rationale"><span>Committee view</span><p>{r.committee_rationale}</p></div>
          )}

          <div className="list-block">
            <List title="Supporting evidence" items={r.supporting_evidence} icon={<Check />} cls="positive" />
            <List title="Key risks" items={r.key_risks} icon={<CircleAlert />} cls="risk" />
            <List title="Mitigating conditions" items={r.mitigating_conditions} icon={<ShieldCheck />} cls="condition" />
            {r.anomalyFlags?.length ? <List title="Anomaly flags" items={r.anomalyFlags} icon={<TrendingDown />} cls="risk" /> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><span className="panel-kicker">FINANCIAL SNAPSHOT</span><h3>Key signals</h3></div>
            <BarChart3 size={18} />
          </div>

          <div className="signals">
            {ratioEntries.map(([k, v]) => (
              <div className="signal" key={k}>
                <span>{pretty(k)}</span>
                <strong>{formatRatio(k, v)}</strong>
              </div>
            ))}
          </div>

          <div className="statement-title">Latest reported figures</div>
          <div className="signals compact">
            {statementEntries.map(([k, v]) => (
              <div className="signal" key={k}><span>{pretty(k)}</span><strong>{money(Number(v), r.currency)}</strong></div>
            ))}
          </div>
        </section>
      </div>

      <StressPanel stress={r.stressTests ?? {}} />
      <AgentPanel assessments={r.agentAssessments ?? {}} />
      <NewsPanel news={r.marketNews ?? []} />

      <div className="disclaimer">
        <CircleAlert size={15} />
        <span>AI-generated underwriting support. Review source data and applicable credit policy before making a lending decision.</span>
      </div>
    </section>
  );
}

function formatRatio(key: string, value: any) {
  if (value == null || value === '') return 'Not provided';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (key.toLowerCase().includes('margin')) return `${(n * 100).toFixed(1)}%`;
  return n.toFixed(2);
}

function Metric({ title, value, icon }: { title: string; value?: number | null; icon: React.ReactNode }) {
  const v = score(value);
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{title}</span>
      <strong>{v == null ? '—' : v}</strong><small>/ 100</small>
      <div className="bar"><i style={{ width: `${v ?? 0}%` }} /></div>
    </div>
  );
}

function List({ title, items, icon, cls }: { title: string; items: string[]; icon: React.ReactNode; cls: string }) {
  return (
    <div className="list">
      <h4>{title}</h4>
      {items.length ? items.map((x, i) => (
        <div className={'list-item ' + cls} key={i}><span>{icon}</span><p>{x}</p></div>
      )) : <div className="muted">Not provided</div>}
    </div>
  );
}

function StressPanel({ stress }: { stress: AnyRecord }) {
  const entries = Object.entries(stress ?? {}).filter(([, v]) => v != null && v !== '');
  if (!entries.length) return null;

  return (
    <section className="panel full-panel">
      <div className="panel-head"><div><span className="panel-kicker">SCENARIO ANALYSIS</span><h3>Stress tests</h3></div><TrendingDown size={18} /></div>
      <div className="stress-grid">
        {entries.map(([k, v]) => (
          <div className="stress-card" key={k}>
            <span>{pretty(k)}</span>
            {typeof v === 'number' ? (
              <strong>{number(v)}</strong>
            ) : v && typeof v === 'object' ? (
              <div className="stress-detail">
                {v.ebitdaAfterStress != null && <small>EBITDA: {money(v.ebitdaAfterStress)}</small>}
                {v.ocfAfterStress != null && <small>OCF: {money(v.ocfAfterStress)}</small>}
                {v.interestCoverage != null && <small>Interest cover: {Number(v.interestCoverage).toFixed(2)}x</small>}
                {v.debtServiceProxy != null && <small>Debt service: {(Number(v.debtServiceProxy) * 100).toFixed(1)}%</small>}
              </div>
            ) : (
              <strong>{String(v)}</strong>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentPanel({ assessments }: { assessments: AnyRecord }) {
  const entries = Object.entries(assessments ?? {});
  if (!entries.length) return null;

  return (
    <section className="panel full-panel">
      <div className="panel-head"><div><span className="panel-kicker">MULTI-AGENT REVIEW</span><h3>Specialist assessments</h3></div><Sparkles size={18} /></div>
      <div className="agent-grid">
        {entries.map(([key, value]: [string, any]) => (
          <div className="agent-card" key={key}>
            <div className="agent-title">{pretty(key)}</div>
            <div className="agent-score">{score(value?.score) ?? '—'}<small>/100</small></div>
            <span className={`risk-pill ${(String(value?.risk || '—')).toLowerCase()}`}>{value?.risk || 'Not assessed'}</span>
            {Array.isArray(value?.findings) && value.findings.filter(Boolean).slice(0, 2).map((f: any, i: number) => <p key={i}>{String(f)}</p>)}
          </div>
        ))}
      </div>
    </section>
  );
}

function NewsPanel({ news }: { news: Result['marketNews'] }) {
  const items = (news ?? []).filter(n => n.title).slice(0, 4);
  if (!items.length) return null;

  return (
    <section className="panel full-panel">
      <div className="panel-head"><div><span className="panel-kicker">MARKET SIGNALS</span><h3>Recent company & market news</h3></div><Newspaper size={18} /></div>
      <div className="news-list">
        {items.map((n, i) => (
          <div className="news-item" key={i}>
            <div className="news-icon"><Newspaper size={15} /></div>
            <div className="news-copy">
              <b>{n.title}</b>
              <span>{n.publisher || 'Market source'} {n.publishedAt ? `• ${new Date(n.publishedAt).toLocaleDateString('en-IN')}` : ''}</span>
            </div>
            {n.link && <a href={n.link} target="_blank" rel="noreferrer" aria-label="Open source"><ExternalLink size={15} /></a>}
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
