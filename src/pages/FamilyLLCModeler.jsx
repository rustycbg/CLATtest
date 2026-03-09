import { useState, useMemo } from "react";

const fmt = (v) => {
  if (v === undefined || v === null || isNaN(v)) return "$0.00";
  const neg = v < 0;
  const abs = Math.abs(v);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `($${str})` : `$${str}`;
};

// ── Shared design tokens (mirrors clat.css :root) ──
const T = {
  navy:    "#1e3a5f",
  navyDk:  "#152d4a",
  blue:    "#2563eb",
  bg:      "#f1f5f9",
  card:    "#ffffff",
  text:    "#0f172a",
  muted:   "#64748b",
  green:   "#16a34a",
  orange:  "#d97706",
  red:     "#dc2626",
  border:  "#e2e8f0",
  shadow:  "0 1px 3px rgba(0,0,0,.07), 0 4px 16px rgba(0,0,0,.04)",
  radius:  12,
};

const InputField = ({ label, value, onChange, prefix, suffix, min, max, step, note }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{
      fontSize: ".72rem", fontWeight: 700, color: T.muted,
      textTransform: "uppercase", letterSpacing: ".06em",
    }}>
      {label}
    </label>
    <div style={{ position: "relative" }}>
      {prefix && (
        <span style={{
          position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
          color: T.muted, fontSize: ".88rem", pointerEvents: "none", userSelect: "none",
        }}>
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min} max={max} step={step || 1}
        style={{
          width: "100%",
          padding: `9px ${suffix ? "28px" : "12px"} 9px ${prefix ? "26px" : "12px"}`,
          border: `1.5px solid ${T.border}`,
          borderRadius: 8,
          fontSize: ".95rem",
          fontWeight: 500,
          color: T.text,
          background: "#fafcff",
          outline: "none",
          MozAppearance: "textfield",
          fontFamily: "inherit",
        }}
      />
      {suffix && (
        <span style={{
          position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
          color: T.muted, fontSize: ".88rem", pointerEvents: "none", userSelect: "none",
        }}>
          {suffix}
        </span>
      )}
    </div>
    {note && <div style={{ fontSize: ".7rem", color: T.muted, lineHeight: 1.4 }}>{note}</div>}
  </div>
);

// variant: "navy" | "green" | "orange"
const MetricCard = ({ label, value, sub, variant = "navy" }) => {
  const bg =
    variant === "green"  ? "linear-gradient(135deg, #15803d, #22c55e)" :
    variant === "orange" ? "linear-gradient(135deg, #b45309, #f59e0b)" :
    T.navy;
  return (
    <div style={{
      background: bg, borderRadius: T.radius, padding: "20px 22px",
      color: "white", flex: "1 1 200px", minWidth: 180,
    }}>
      <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", opacity: .65, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.65rem", fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: ".7rem", opacity: .6, marginTop: 5 }}>{sub}</div>}
    </div>
  );
};

export default function FamilyLLCModeler() {
  const [llcValue,       setLlcValue]       = useState(10000000);
  const [discount,       setDiscount]       = useState(35);
  const [duration,       setDuration]       = useState(10);
  const [rate,           setRate]           = useState(4.72);
  const [returnRate,     setReturnRate]     = useState(7.5);
  const [annualPayment,  setAnnualPayment]  = useState(0);
  const [taxRate,        setTaxRate]        = useState(40);
  const [taxablePortion, setTaxablePortion] = useState(30);

  const purchasePrice      = llcValue * (1 - discount / 100);
  const impliedGift        = llcValue - purchasePrice;
  const interestRate       = rate / 100;
  const investReturn       = returnRate / 100;
  const taxRateDec         = taxRate / 100;
  const taxablePortionDec  = taxablePortion / 100;
  const minPayment         = purchasePrice * interestRate;
  const effectivePayment   = Math.max(annualPayment || 0, minPayment);
  const isAmortizing       = effectivePayment > minPayment + 0.01;

  const cashFlows = useMemo(() => {
    const rows = [];
    let loanBal    = purchasePrice;
    let trustAssets = llcValue;

    rows.push({
      year: 0, beginTrust: 0, investReturn: 0, interestDue: 0, payment: 0,
      interestPortion: 0, principalPortion: 0, balloon: 0, beginLoan: 0,
      endLoan: purchasePrice, endTrust: llcValue, grantorTax: 0, cumTaxBenefit: 0,
    });

    let cumTax = 0;
    for (let y = 1; y <= duration; y++) {
      const beginTrust  = trustAssets;
      const beginLoan   = loanBal;
      const invRet      = beginTrust * investReturn;
      const intDue      = beginLoan * interestRate;
      const pmt         = Math.max(effectivePayment, intDue);
      const intPortion  = Math.min(pmt, intDue);
      const prinPortion = pmt - intPortion;
      const isFinal     = y === duration;
      const balloon     = isFinal ? Math.max(0, beginLoan - prinPortion) : 0;

      loanBal     = beginLoan - prinPortion - balloon;
      trustAssets = beginTrust + invRet - pmt - balloon;

      const gTax = invRet * taxablePortionDec * taxRateDec;
      cumTax += gTax;

      rows.push({
        year: y, beginTrust, investReturn: invRet, interestDue: intDue, payment: pmt,
        interestPortion: intPortion, principalPortion: prinPortion, balloon, beginLoan,
        endLoan: Math.max(0, loanBal), endTrust: trustAssets, grantorTax: gTax, cumTaxBenefit: cumTax,
      });
    }
    return rows;
  }, [llcValue, discount, duration, rate, returnRate, annualPayment, taxRate, taxablePortion,
      purchasePrice, effectivePayment, interestRate, investReturn, taxRateDec, taxablePortionDec]);

  const finalRow       = cashFlows[cashFlows.length - 1];
  const totalPayments  = cashFlows.reduce((s, r) => s + r.payment + r.balloon, 0);
  const totalInterest  = cashFlows.reduce((s, r) => s + r.interestPortion, 0);
  const totalPrincipal = cashFlows.reduce((s, r) => s + r.principalPortion + r.balloon, 0);
  const netTransfer    = finalRow.endTrust;
  const totalTaxBenefit = finalRow.cumTaxBenefit;

  const columns = [
    { key: "year",             label: "Year",               fmt: (v) => v },
    { key: "beginTrust",       label: "Begin Trust Assets", fmt },
    { key: "investReturn",     label: "Investment Return",  fmt },
    { key: "interestDue",      label: "Interest Due",       fmt },
    { key: "payment",          label: "Payment",            fmt },
    { key: "interestPortion",  label: "Interest Paid",      fmt },
    { key: "principalPortion", label: "Principal Paid",     fmt },
    { key: "balloon",          label: "Balloon",            fmt },
    { key: "beginLoan",        label: "Begin Loan Bal",     fmt },
    { key: "endLoan",          label: "End Loan Bal",       fmt },
    { key: "endTrust",         label: "End Trust Assets",   fmt },
    { key: "grantorTax",       label: "Grantor Tax Paid",   fmt },
    { key: "cumTaxBenefit",    label: "Cum. Tax Benefit",   fmt },
  ];

  // ── Shared card styles (matches CLAT .card) ──
  const cardStyle = {
    background: T.card,
    borderRadius: T.radius,
    boxShadow: T.shadow,
    border: `1px solid ${T.border}`,
    overflow: "hidden",
  };
  const cardHeaderStyle = {
    padding: "16px 28px",
    borderBottom: `1px solid ${T.border}`,
    display: "flex",
    alignItems: "center",
    gap: 10,
  };
  const cardTitleStyle = {
    fontSize: ".82rem", fontWeight: 700, color: T.navy,
    textTransform: "uppercase", letterSpacing: ".06em", margin: 0,
  };
  const cardBodyStyle = { padding: "24px 28px" };

  return (
    <div style={{
      background: T.bg, color: T.text, minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: 15, lineHeight: 1.5,
    }}>

      {/* ── Header (matches CLAT .app-header) ── */}
      <header style={{
        background: T.navy, color: "white",
        padding: "22px 40px",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 700, letterSpacing: "-.02em", margin: 0 }}>
            Family LLC Installment Sale
          </h1>
          <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".85rem", marginTop: 2, margin: 0 }}>
            Installment sale of discounted nonvoting LLC interests to an IDGT
          </p>
        </div>
        <div style={{
          marginLeft: "auto",
          background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 8, padding: "8px 16px",
          fontSize: ".78rem", color: "rgba(255,255,255,.8)", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          AFR (Mar 2026) &nbsp;|&nbsp;
          <strong style={{ color: "white" }}>LT: 4.72%</strong> &nbsp;·&nbsp;
          MT: 3.93% &nbsp;·&nbsp;
          <span style={{
            background: isAmortizing ? T.orange : T.blue,
            color: "white", fontSize: ".7rem", fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase",
            padding: "2px 9px", borderRadius: 4,
          }}>
            {isAmortizing ? "Amortizing" : "Interest-Only"}
          </span>
        </div>
      </header>

      {/* ── Main container ── */}
      <div style={{
        maxWidth: 1160, margin: "0 auto",
        padding: "28px 20px 56px",
        display: "flex", flexDirection: "column", gap: 20,
      }}>

        {/* ── Inputs card ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{
              background: T.navy, color: "white",
              fontSize: ".62rem", fontWeight: 700, padding: "2px 8px",
              borderRadius: 10, letterSpacing: ".05em",
            }}>
              INPUTS
            </div>
            <h2 style={cardTitleStyle}>Deal Parameters</h2>
          </div>
          <div style={cardBodyStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 20 }}>
              <InputField label="LLC Asset Value"            prefix="$"     value={llcValue}       onChange={setLlcValue}       step={100000} min={0} />
              <InputField label="Valuation Discount"         suffix="%"     value={discount}       onChange={setDiscount}       step={1}   min={0}  max={60}  note="Combined lack of control + marketability" />
              <InputField label="Note Duration"              suffix="years" value={duration}       onChange={setDuration}       step={1}   min={1}  max={30}  note={duration > 9 ? "Long-term AFR applies" : duration > 3 ? "Mid-term AFR applies" : "Short-term AFR applies"} />
              <InputField label="AFR Interest Rate"          suffix="%"     value={rate}           onChange={setRate}           step={0.01} min={0} max={15}  note="March 2026 LT: 4.72% · MT: 3.93%" />
              <InputField label="Annual Payment"             prefix="$"     value={annualPayment}  onChange={setAnnualPayment}  step={10000} min={0}          note={`Min (interest-only): ${fmt(minPayment)}/yr`} />
              <InputField label="Investment Return"          suffix="%"     value={returnRate}     onChange={setReturnRate}     step={0.1}  min={0}  max={30} />
              <InputField label="Grantor Tax Rate"           suffix="%"     value={taxRate}        onChange={setTaxRate}        step={1}   min={0}  max={60}  note="Fed + state combined rate" />
              <InputField label="Taxable Portion of Return"  suffix="%"     value={taxablePortion} onChange={setTaxablePortion} step={5}   min={0}  max={100} note="% of return realized as current-year income" />
            </div>
          </div>
        </div>

        {/* ── Metric cards (matches CLAT .metrics-row) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <MetricCard
            label="Purchase Price (Discounted)"
            value={fmt(purchasePrice)}
            sub={`${discount}% discount on ${fmt(llcValue)}`}
          />
          <MetricCard
            label="Implied Gift (Discount)"
            value={fmt(impliedGift)}
            variant="orange"
            sub="Embedded transfer at sale"
          />
          <MetricCard
            label="Total Payments to Grantor"
            value={fmt(totalPayments)}
            sub={`Interest: ${fmt(totalInterest)} · Principal: ${fmt(totalPrincipal)}`}
          />
          <MetricCard
            label="Trust Value at Maturity"
            value={fmt(netTransfer)}
            variant="green"
            sub="Passes gift/estate-tax free"
          />
          <MetricCard
            label="Total Grantor Tax Benefit"
            value={fmt(totalTaxBenefit)}
            sub={`${taxablePortion}% of return taxed at ${taxRate}%`}
          />
        </div>

        {/* ── Cash flow table card ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Year-by-Year Cash Flow</h2>
          </div>
          <div style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse",
                fontSize: ".86rem", minWidth: 900,
              }}>
                <thead>
                  <tr style={{ background: T.navy, color: "white" }}>
                    {columns.map((c) => (
                      <th key={c.key} style={{
                        padding: "12px 14px",
                        textAlign: c.key === "year" ? "center" : "right",
                        fontSize: ".7rem", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: ".05em",
                        whiteSpace: "nowrap",
                      }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashFlows.map((row, i) => (
                    <tr key={row.year} style={{
                      borderBottom: `1px solid ${T.border}`,
                      background: i === 0 ? "#f8fafc" : "white",
                    }}>
                      {columns.map((c) => {
                        const val       = row[c.key];
                        const isNeg     = typeof val === "number" && val < 0;
                        const isYear    = c.key === "year";
                        const isBalloon = c.key === "balloon" && val > 0;
                        const isGrowth  = c.key === "investReturn" && val > 0;
                        const isBenefit = c.key === "cumTaxBenefit" && val > 0;
                        const isEndTrust = c.key === "endTrust" && val > 0;
                        const color =
                          isNeg     ? T.red    :
                          isBalloon ? T.orange :
                          isYear    ? T.navy   :
                          isGrowth || isBenefit || isEndTrust ? T.green :
                          T.text;
                        return (
                          <td key={c.key} style={{
                            padding: "10px 14px",
                            textAlign: isYear ? "center" : "right",
                            color,
                            fontWeight: isYear || isBalloon ? 700 : 400,
                          }}>
                            {c.fmt(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{
          background: T.card, borderRadius: T.radius,
          boxShadow: T.shadow, border: `1px solid ${T.border}`,
          padding: "20px 28px",
        }}>
          <p style={{ fontSize: ".83rem", color: T.muted, lineHeight: 1.6, margin: 0 }}>
            This tool is for educational and illustrative purposes only and does not constitute tax, legal, or financial advice.
            AFR rates shown are based on IRS Rev. Rul. 2026-06 (March 2026) and change monthly.
            Valuation discounts require a qualified independent appraisal.
            Consult qualified tax and legal professionals before implementing any estate planning strategy.
          </p>
        </div>

      </div>
    </div>
  );
}
