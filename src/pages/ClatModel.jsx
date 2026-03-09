import { useState, useMemo, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import '../clat.css';

// ── Formatting ──────────────────────────────────────────
function fmtC(n) {
  if (!isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
}

function fmtPct(n, d = 2) {
  return n.toFixed(d) + '%';
}

// ── Core Math ──────────────────────────────────────────
function annuityFactor(r, n) {
  if (r === 0) return n;
  return (1 - Math.pow(1 + r, -n)) / r;
}

function runModel(capital, retRate, payment, taxRate, rate, term) {
  const rows = [];
  let bal = capital;
  let cumCharity = 0;
  const balHist = [capital];
  const charityHist = [0];

  for (let y = 1; y <= term; y++) {
    const open   = bal;
    const growth = open * retRate;
    const taxes  = growth * taxRate;
    const pvTax  = taxes / Math.pow(1 + retRate, y);
    const end    = open + growth - payment;
    cumCharity  += payment;
    bal          = end;
    rows.push({ year: y, open, growth, charity: payment, taxes, pvTax, end });
    balHist.push(end);
    charityHist.push(cumCharity);
  }
  return { rows, remainder: bal, balHist, charityHist };
}

// ── Component ──────────────────────────────────────────
export default function ClatModel() {
  const [rateVal,    setRateVal]    = useState(4.60);
  const [termVal,    setTermVal]    = useState(10);
  const [capitalVal, setCapitalVal] = useState(1000000);
  const [retRateVal, setRetRateVal] = useState(7.00);
  const [taxRateVal, setTaxRateVal] = useState(37);
  const [currentPct, setCurrentPct] = useState(100);

  const chartRef     = useRef(null);
  const chartInstRef = useRef(null);

  // ── Derived state ──
  const result = useMemo(() => {
    const rate    = rateVal    / 100;
    const term    = Math.max(1, Math.round(termVal));
    const capital = capitalVal;
    const retRate = retRateVal / 100;
    const taxRate = taxRateVal / 100;

    if (!isFinite(rate) || !isFinite(term) || !isFinite(capital) ||
        !isFinite(retRate) || !isFinite(taxRate)) return null;
    if (rate <= 0 || term < 1 || capital <= 0) return null;

    const af           = annuityFactor(rate, term);
    const minPayment   = capital / af;
    const pvCharity    = minPayment * af;
    const actualPayment = minPayment * (currentPct / 100);
    const model        = runModel(capital, retRate, actualPayment, taxRate, rate, term);

    return { rate, term, capital, retRate, taxRate, af, minPayment, pvCharity, actualPayment, ...model };
  }, [rateVal, termVal, capitalVal, retRateVal, taxRateVal, currentPct]);

  // ── Chart: update when result changes ──
  useEffect(() => {
    if (!result || !chartRef.current) return;

    const { balHist, charityHist } = result;
    const labels = balHist.map((_, i) => (i === 0 ? 'Start' : `Yr ${i}`));

    if (chartInstRef.current) {
      chartInstRef.current.data.labels              = labels;
      chartInstRef.current.data.datasets[0].data   = balHist;
      chartInstRef.current.data.datasets[1].data   = charityHist;
      chartInstRef.current.update('none');
    } else {
      const ctx = chartRef.current.getContext('2d');
      chartInstRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Trust Balance',
              data: balHist,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37,99,235,.09)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#2563eb',
            },
            {
              label: 'Cumulative Charitable Giving',
              data: charityHist,
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22,163,74,.07)',
              borderWidth: 2.5,
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: '#16a34a',
              borderDash: [6, 4],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { size: 12 }, usePointStyle: true, pointStyleWidth: 18 },
            },
            tooltip: {
              padding: 12,
              callbacks: { label: (ctx) => `  ${ctx.dataset.label}: ${fmtC(ctx.parsed.y)}` },
            },
          },
          scales: {
            y: {
              ticks: {
                callback: (v) => {
                  const a = Math.abs(v);
                  const s = v < 0 ? '-' : '';
                  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1) + 'M';
                  if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'K';
                  return s + '$' + a;
                },
                font: { size: 11 },
              },
              grid: { color: 'rgba(0,0,0,.05)' },
            },
            x: {
              ticks: { font: { size: 11 } },
              grid: { color: 'rgba(0,0,0,.05)' },
            },
          },
        },
      });
    }
  }, [result]);

  // ── Chart: destroy on unmount ──
  useEffect(() => {
    return () => {
      chartInstRef.current?.destroy();
      chartInstRef.current = null;
    };
  }, []);

  // ── Handlers ──
  const handleCustomInput = (value) => {
    if (!result) return;
    const payment = parseFloat(value);
    if (isNaN(payment) || payment <= 0) return;
    setCurrentPct((payment / result.minPayment) * 100);
  };

  const exportCSV = () => {
    if (!result) return;
    const { rows, af, minPayment, pvCharity, remainder, actualPayment,
            capital, rate, retRate, taxRate, term } = result;

    const lines = [
      ['CLAT Financial Model Export'],
      [],
      ['Parameters'],
      ['IRS §7520 Rate',           fmtPct(rate    * 100)],
      ['Trust Term (years)',        term],
      ['Capital Contributed',       Math.round(capital)],
      ['Investment Return',         fmtPct(retRate * 100)],
      ['Grantor Marginal Tax Rate', fmtPct(taxRate * 100)],
      [],
      ['Key Metrics'],
      ['Annuity Factor',             af.toFixed(6)],
      ['Min Annual Charity Payment', Math.round(minPayment)],
      ['PV of Charitable Interest',  Math.round(pvCharity)],
      ['Annual Contribution Used',   Math.round(actualPayment)],
      ['Projected Remainder',        Math.round(remainder)],
      [],
      ['Annual Cash Flow'],
      ['Year', 'Opening Balance', 'Investment Growth', 'Charitable Contribution',
       'Taxes Due (Grantor)', 'PV of Taxes Due', 'Ending Balance'],
      ...rows.map((r) => [
        r.year, Math.round(r.open), Math.round(r.growth),
        Math.round(r.charity), Math.round(r.taxes), Math.round(r.pvTax), Math.round(r.end),
      ]),
      ['REMAINDER', '', '', '', '', '', Math.round(remainder)],
    ];

    const csv  = lines.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'CLAT_Model.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!result) return null;

  const { rate, term, capital, retRate, taxRate,
          af, minPayment, pvCharity, actualPayment, remainder, rows } = result;

  // ── Explanation values ──
  const deduction  = actualPayment * af;
  const taxSavings = deduction * taxRate;
  const excessBps  = ((retRate - rate) * 100).toFixed(2);
  const beating    = retRate > rate;

  // ── Slider gradient ──
  const sliderFrac = ((Math.min(150, Math.max(50, currentPct)) - 50) / 100) * 100;
  const sliderBg   = `linear-gradient(to right, #2563eb ${sliderFrac}%, #e2e8f0 ${sliderFrac}%)`;

  // ── Status badge ──
  const diff = actualPayment - minPayment;
  let badgeCls, badgeText;
  if (Math.abs(diff) < 0.50) {
    badgeCls  = 'badge-zeroed';
    badgeText = '✓ Zeroed-Out CLAT — Zero Gift Tax on Remainder Interest';
  } else if (actualPayment < minPayment) {
    const taxableGift = capital - (actualPayment * af);
    badgeCls  = 'badge-taxable';
    badgeText = `⚠ Below Minimum — Taxable Gift on Remainder ≈ ${fmtC(taxableGift)}`;
  } else {
    badgeCls  = 'badge-above';
    badgeText = `↑ ${Math.abs(((actualPayment / minPayment - 1) * 100)).toFixed(1)}% above minimum — Larger charitable gift, smaller remainder to heirs`;
  }

  // ── Sensitivity rows ──
  const sensPcts = [75, 90, 100, 110, 125, 150];

  // ── Cash flow totals ──
  const totGrowth  = rows.reduce((s, r) => s + r.growth,  0);
  const totCharity = rows.reduce((s, r) => s + r.charity, 0);
  const totTaxes   = rows.reduce((s, r) => s + r.taxes,   0);
  const totPvTax   = rows.reduce((s, r) => s + r.pvTax,   0);

  return (
    <div className="clat-page">

      {/* ── Header ── */}
      <header className="app-header">
        <div>
          <h1>CLAT Financial Model</h1>
          <p className="subtitle">Grantor Charitable Lead Annuity Trust — Interactive Tax Planning Tool</p>
        </div>
        <div className="irs-rates">
          §7520 Rate &nbsp;|&nbsp;
          <strong>Feb 2026: 4.60%</strong> &nbsp;·&nbsp;
          Jan 2026: 4.60% &nbsp;·&nbsp;
          Mar 2026: 4.80%
        </div>
      </header>

      <div className="container">

        {/* ── STEP 1: Trust Parameters ── */}
        <div className="card">
          <div className="card-header">
            <div className="step-pill">STEP 1</div>
            <h2>Trust Parameters</h2>
          </div>
          <div className="card-body">
            <div className="inputs-grid">

              <div className="field">
                <label>IRS §7520 Rate</label>
                <div className="input-wrap with-right">
                  <input
                    type="number" value={rateVal} step="0.01" min="0.01" max="20"
                    onChange={(e) => { const v = e.target.valueAsNumber; if (!isNaN(v)) setRateVal(v); }}
                  />
                  <span className="adorn right">%</span>
                </div>
                <div className="field-hint">Hurdle rate used for PV calculations. You may elect either of the two preceding months.</div>
              </div>

              <div className="field">
                <label>Trust Term</label>
                <div className="input-wrap with-right">
                  <input
                    type="number" value={termVal} step="1" min="1" max="40"
                    onChange={(e) => { const v = e.target.valueAsNumber; if (!isNaN(v)) setTermVal(v); }}
                  />
                  <span className="adorn right">yrs</span>
                </div>
                <div className="field-hint">Number of years charity receives annuity payments</div>
              </div>

              <div className="field">
                <label>Capital Contributed</label>
                <div className="input-wrap with-left">
                  <span className="adorn left">$</span>
                  <input
                    type="number" value={capitalVal} step="50000" min="1"
                    onChange={(e) => { const v = e.target.valueAsNumber; if (!isNaN(v)) setCapitalVal(v); }}
                  />
                </div>
                <div className="field-hint">Initial trust funding amount</div>
              </div>

              <div className="field">
                <label>Investment Return</label>
                <div className="input-wrap with-right">
                  <input
                    type="number" value={retRateVal} step="0.25" min="0" max="30"
                    onChange={(e) => { const v = e.target.valueAsNumber; if (!isNaN(v)) setRetRateVal(v); }}
                  />
                  <span className="adorn right">%</span>
                </div>
                <div className="field-hint">Annual assumed growth rate of trust assets</div>
              </div>

              <div className="field">
                <label>Grantor Marginal Tax Rate</label>
                <div className="input-wrap with-right">
                  <input
                    type="number" value={taxRateVal} step="1" min="0" max="65"
                    onChange={(e) => { const v = e.target.valueAsNumber; if (!isNaN(v)) setTaxRateVal(v); }}
                  />
                  <span className="adorn right">%</span>
                </div>
                <div className="field-hint">For estimating annual income taxes owed by grantor on trust income</div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="metrics-row">
          <div className="metric">
            <div className="metric-label">Annuity Factor</div>
            <div className="metric-value">{af.toFixed(6)}</div>
            <div className="metric-desc">PV of $1/yr at §7520 rate for {term} yrs</div>
          </div>
          <div className="metric">
            <div className="metric-label">Min. Annual Charity Payment</div>
            <div className="metric-value">{fmtC(minPayment)}</div>
            <div className="metric-desc">Required for a zeroed-out CLAT (zero gift tax)</div>
          </div>
          <div className="metric">
            <div className="metric-label">PV of Charitable Interest</div>
            <div className="metric-value">{fmtC(pvCharity)}</div>
            <div className="metric-desc">= Capital contributed when zeroed-out; also your income tax deduction</div>
          </div>
          <div className="metric green">
            <div className="metric-label">Projected Remainder to Heirs</div>
            <div className="metric-value">{fmtC(remainder)}</div>
            <div className="metric-desc">Trust balance at end of term; passes gift/estate-tax free</div>
          </div>
        </div>

        {/* ── Explanation ── */}
        <div className="explanation">
          Paying <strong>{fmtC(actualPayment)}/year</strong> to charity for <strong>{term} years</strong>{' '}
          gives the IRS an annuity stream valued at <strong>{fmtC(deduction)}</strong>{' '}
          {Math.abs(deduction - capital) < 1
            ? <>— equal to your full contribution, resulting in <strong>zero gift tax</strong> on the remainder interest.</>
            : <>({fmtC(Math.abs(deduction - capital))} {deduction >= capital ? 'above' : 'below'} your contribution).</>
          }{' '}
          The grantor claims an upfront income tax deduction of <strong>{fmtC(deduction)}</strong>,{' '}
          potentially saving <strong>{fmtC(taxSavings)}</strong> in federal income taxes{' '}
          (at the {fmtPct(taxRate * 100)} marginal rate), subject to AGI limitations.{' '}
          {beating
            ? <>
                Your <strong>{fmtPct(retRate * 100)}</strong> return exceeds the §7520 hurdle rate of{' '}
                <strong>{fmtPct(rate * 100)}</strong> by <strong>{excessBps} bps</strong> —{' '}
                excess growth of <strong>{fmtC(remainder)}</strong> passes to remainder beneficiaries gift/estate-tax free.
              </>
            : <>
                Note: your assumed return of <strong>{fmtPct(retRate * 100)}</strong> is at or below{' '}
                the §7520 hurdle rate of <strong>{fmtPct(rate * 100)}</strong>;{' '}
                the trust may not produce a meaningful remainder for heirs.
              </>
          }
        </div>

        {/* ── STEP 3: Contribution Mode & Sensitivity ── */}
        <div className="card">
          <div className="card-header">
            <div className="step-pill">STEP 3</div>
            <h2>Contribution Mode &amp; Sensitivity Analysis</h2>
          </div>
          <div className="card-body">

            <div className="custom-row">
              <div className="field" style={{ flex: '0 0 220px' }}>
                <label>Annual Charity Payment</label>
                <div className="input-wrap with-left">
                  <span className="adorn left">$</span>
                  <input
                    type="number" value={Math.round(actualPayment)} step="1000"
                    onChange={(e) => handleCustomInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="slider-field">
                <label>Adjust vs. minimum payment</label>
                <input
                  type="range" min="50" max="150" step="1"
                  value={Math.min(150, Math.max(50, currentPct))}
                  style={{ background: sliderBg }}
                  onChange={(e) => setCurrentPct(parseFloat(e.target.value))}
                />
                <div className="slider-labels">
                  <span>50%</span><span>75%</span><span>100%</span><span>125%</span><span>150%</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 2 }}>
                <div className="slider-pct">
                  {Math.abs(currentPct - 100) < 0.01
                    ? '100% of minimum — Zeroed-Out'
                    : currentPct.toFixed(1) + '% of minimum'}
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setCurrentPct(100)}>
                  Reset to Minimum
                </button>
              </div>
            </div>

            <div>
              <div className={`status-badge ${badgeCls}`}>{badgeText}</div>
            </div>

            <div className="sens-section-label">Sensitivity: Remainder vs. Annual Payment Level</div>
            <table className="sens-table">
              <thead>
                <tr>
                  <th>% of Min. Payment</th>
                  <th>Annual Payment</th>
                  <th>Cumul. Charitable Giving</th>
                  <th>Projected Remainder</th>
                  <th>Gift Tax Status</th>
                </tr>
              </thead>
              <tbody>
                {sensPcts.map((pct) => {
                  const payment = minPayment * (pct / 100);
                  const { remainder: rem } = runModel(capital, retRate, payment, taxRate, rate, term);
                  const cumCharity = payment * term;
                  const isActive   = Math.abs(payment - actualPayment) < 0.50;
                  let statusText, statusColor;
                  if (pct === 100) {
                    statusText  = 'Zeroed-Out';
                    statusColor = '#15803d';
                  } else if (pct < 100) {
                    const taxableGift = capital - (payment * af);
                    statusText  = `Taxable gift ≈ ${fmtC(taxableGift)}`;
                    statusColor = '#b91c1c';
                  } else {
                    statusText  = 'Extra charitable gift';
                    statusColor = '#92400e';
                  }
                  return (
                    <tr key={pct} className={isActive ? 'sens-active' : ''}>
                      <td>{pct === 100 ? <strong>100% (Minimum)</strong> : `${pct}%`}</td>
                      <td>{fmtC(payment)}</td>
                      <td>{fmtC(cumCharity)}</td>
                      <td style={rem < 0 ? { color: 'var(--red)' } : {}}>{fmtC(rem)}</td>
                      <td><span style={{ color: statusColor, fontWeight: 700 }}>{statusText}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 8 }}>
              Highlighted row = current contribution. Contributions below the minimum create a taxable gift; above the minimum increase the charitable gift and reduce the remainder.
            </div>

          </div>
        </div>

        {/* ── STEP 4: Cash Flow Table ── */}
        <div className="card">
          <div className="card-header">
            <div className="step-pill">STEP 4</div>
            <h2>Annual Cash Flow Projection</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="cf-wrap">
              <table className="cf-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Opening Balance</th>
                    <th>Investment Growth</th>
                    <th>Charitable Contribution</th>
                    <th>Taxes Due (Grantor)*</th>
                    <th>PV of Taxes Due*</th>
                    <th>Ending Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.year}>
                      <td>{r.year}</td>
                      <td>{fmtC(r.open)}</td>
                      <td className="c-pos">{fmtC(r.growth)}</td>
                      <td className="c-neg">({fmtC(r.charity)})</td>
                      <td className="c-warn">{fmtC(r.taxes)}</td>
                      <td className="c-warn">{fmtC(r.pvTax)}</td>
                      <td className={r.end < 0 ? 'c-neg' : ''}>{fmtC(r.end)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="c-rem">Total / Remainder</td>
                    <td></td>
                    <td className="c-pos">{fmtC(totGrowth)}</td>
                    <td className="c-neg">({fmtC(totCharity)})</td>
                    <td className="c-warn">{fmtC(totTaxes)}</td>
                    <td className="c-warn">{fmtC(totPvTax)}</td>
                    <td className="c-rem">{fmtC(remainder)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 20px', fontSize: '.72rem', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
              * Taxes Due shown for grantor cash-flow planning only. Taxes are paid by the grantor from personal funds — trust balance is <strong>not reduced</strong>. PV of Taxes Due discounts each year's tax liability back to today using the investment return rate, reflecting the opportunity cost of funds needed to cover those taxes.
            </div>
          </div>
        </div>

        {/* ── Chart ── */}
        <div className="card">
          <div className="card-header">
            <h2>Trust Balance vs. Cumulative Charitable Giving</h2>
          </div>
          <div className="card-body">
            <div className="chart-wrap">
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
        </div>

        {/* ── Assumptions ── */}
        <div className="card">
          <div className="card-header">
            <h2>Key Assumptions &amp; Disclosures</h2>
          </div>
          <div className="card-body">
            <ul className="assumptions">
              <li>Annual annuity payments are made at the <strong>end of each year</strong></li>
              <li>Investment growth is applied to the <strong>opening balance</strong> for the year</li>
              <li>The grantor pays income taxes <strong>outside the trust</strong> — trust balance is unaffected (key benefit of grantor CLAT structure)</li>
              <li>The §7520 rate is the rate in effect at trust creation; grantor may elect either of the two preceding months' rates</li>
              <li>The model assumes a <strong>fixed investment return</strong> each year with no market volatility</li>
              <li>The upfront income tax deduction equals the PV of the charitable annuity stream, subject to 30%/60% of AGI limits with a 5-year carryforward (IRC §170)</li>
              <li>Governed by IRC §2055(e)(2)(B) for gift/estate tax treatment and IRC §170 for grantor income tax deduction</li>
              <li>This tool is for <strong>educational and planning purposes only</strong> — not legal or tax advice. Consult a qualified estate planning attorney and CPA.</li>
            </ul>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="actions-row">
          <button className="btn btn-outline" onClick={exportCSV}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
        </div>

      </div>
    </div>
  );
}
