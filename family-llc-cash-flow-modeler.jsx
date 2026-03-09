import { useState, useMemo } from "react";

const fmt = (v) => {
  if (v === undefined || v === null || isNaN(v)) return "$0.00";
  const neg = v < 0;
  const abs = Math.abs(v);
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `($${str})` : `$${str}`;
};

const pct = (v) => `${(v * 100).toFixed(2)}%`;

const InputField = ({ label, value, onChange, prefix, suffix, min, max, step, note }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a9bb0", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
      {label}
    </label>
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0d1b2a", borderRadius: 8, border: "1px solid #1b3a5c", padding: "8px 12px" }}>
      {prefix && <span style={{ color: "#4a9eff", fontWeight: 700, fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step || 1}
        style={{
          flex: 1, background: "transparent", border: "none", outline: "none",
          color: "#e8f0fe", fontSize: 15, fontWeight: 600, fontFamily: "'DM Mono', monospace",
          width: "100%"
        }}
      />
      {suffix && <span style={{ color: "#8a9bb0", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{suffix}</span>}
    </div>
    {note && <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{note}</div>}
  </div>
);

const MetricCard = ({ label, value, accent, sub }) => (
  <div style={{
    background: "linear-gradient(135deg, #0d1b2a 0%, #132d4a 100%)",
    borderRadius: 12, padding: "18px 20px",
    border: `1px solid ${accent || "#1b3a5c"}22`,
    minWidth: 180, flex: "1 1 200px"
  }}>
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b8ab0", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color: accent || "#e8f0fe", fontFamily: "'DM Mono', monospace", lineHeight: 1.2 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
  </div>
);

export default function FamilyLLCModeler() {
  const [llcValue, setLlcValue] = useState(10000000);
  const [discount, setDiscount] = useState(35);
  const [duration, setDuration] = useState(10);
  const [rate, setRate] = useState(4.72);
  const [returnRate, setReturnRate] = useState(7.5);
  const [annualPayment, setAnnualPayment] = useState(0);
  const [taxRate, setTaxRate] = useState(40);
  const [taxablePortion, setTaxablePortion] = useState(30);

  const purchasePrice = llcValue * (1 - discount / 100);
  const impliedGift = llcValue - purchasePrice;
  const interestRate = rate / 100;
  const investReturn = returnRate / 100;
  const taxRateDec = taxRate / 100;
  const taxablePortionDec = taxablePortion / 100;

  const minPayment = purchasePrice * interestRate;
  const effectivePayment = Math.max(annualPayment || 0, minPayment);
  const isAmortizing = effectivePayment > minPayment + 0.01;

  const cashFlows = useMemo(() => {
    const rows = [];
    let loanBal = purchasePrice;
    let trustAssets = llcValue;

    rows.push({
      year: 0,
      beginTrust: 0,
      investReturn: 0,
      interestDue: 0,
      payment: 0,
      interestPortion: 0,
      principalPortion: 0,
      balloon: 0,
      beginLoan: 0,
      endLoan: purchasePrice,
      endTrust: llcValue,
      grantorTax: 0,
      cumTaxBenefit: 0,
    });

    let cumTax = 0;
    for (let y = 1; y <= duration; y++) {
      const beginTrust = trustAssets;
      const beginLoan = loanBal;
      const invRet = beginTrust * investReturn;
      const intDue = beginLoan * interestRate;
      const pmt = Math.max(effectivePayment, intDue);
      const intPortion = Math.min(pmt, intDue);
      const prinPortion = pmt - intPortion;
      const isFinal = y === duration;
      const balloon = isFinal ? Math.max(0, beginLoan - prinPortion) : 0;

      loanBal = beginLoan - prinPortion - balloon;
      trustAssets = beginTrust + invRet - pmt - balloon;

      const gTax = invRet * taxablePortionDec * taxRateDec;
      cumTax += gTax;

      rows.push({
        year: y,
        beginTrust,
        investReturn: invRet,
        interestDue: intDue,
        payment: pmt,
        interestPortion: intPortion,
        principalPortion: prinPortion,
        balloon,
        beginLoan,
        endLoan: Math.max(0, loanBal),
        endTrust: trustAssets,
        grantorTax: gTax,
        cumTaxBenefit: cumTax,
      });
    }
    return rows;
  }, [llcValue, discount, duration, rate, returnRate, annualPayment, taxRate, taxablePortion, purchasePrice, effectivePayment, interestRate, investReturn, taxRateDec, taxablePortionDec]);

  const finalRow = cashFlows[cashFlows.length - 1];
  const totalPayments = cashFlows.reduce((s, r) => s + r.payment + r.balloon, 0);
  const totalInterest = cashFlows.reduce((s, r) => s + r.interestPortion, 0);
  const totalPrincipal = cashFlows.reduce((s, r) => s + r.principalPortion + r.balloon, 0);
  const netTransfer = finalRow.endTrust;
  const totalTaxBenefit = finalRow.cumTaxBenefit;

  const columns = [
    { key: "year", label: "Year", fmt: (v) => v },
    { key: "beginTrust", label: "Begin Trust Assets", fmt },
    { key: "investReturn", label: "Investment Return", fmt },
    { key: "interestDue", label: "Interest Due", fmt },
    { key: "payment", label: "Payment", fmt },
    { key: "interestPortion", label: "Interest Paid", fmt },
    { key: "principalPortion", label: "Principal Paid", fmt },
    { key: "balloon", label: "Balloon", fmt },
    { key: "beginLoan", label: "Begin Loan Bal", fmt },
    { key: "endLoan", label: "End Loan Bal", fmt },
    { key: "endTrust", label: "End Trust Assets", fmt },
    { key: "grantorTax", label: "Grantor Tax Paid", fmt },
    { key: "cumTaxBenefit", label: "Cum. Tax Benefit", fmt },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #060e18 0%, #0a1628 40%, #0d1b2a 100%)",
      color: "#e8f0fe",
      fontFamily: "'DM Sans', sans-serif",
      padding: 0,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "36px 40px 28px",
        borderBottom: "1px solid #1b3a5c33",
        background: "linear-gradient(135deg, #060e18 0%, #0f2440 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em",
            fontFamily: "'Playfair Display', serif",
            background: "linear-gradient(135deg, #4a9eff 0%, #7bc8ff 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Family LLC Installment Sale
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "#0d1b2a", background: isAmortizing ? "#f0a040" : "#4a9eff",
            padding: "3px 10px", borderRadius: 4,
          }}>
            {isAmortizing ? "Amortizing" : "Interest-Only"}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#6b8ab0", margin: 0, maxWidth: 700 }}>
          Installment sale of discounted nonvoting LLC interests to an Intentionally Defective Grantor Trust (IDGT). Adjust assumptions below.
        </p>
      </div>

      {/* Inputs */}
      <div style={{ padding: "28px 40px", borderBottom: "1px solid #1b3a5c22" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px 24px" }}>
          <InputField label="LLC Asset Value" prefix="$" value={llcValue} onChange={setLlcValue} step={100000} min={0} />
          <InputField label="Valuation Discount" suffix="%" value={discount} onChange={setDiscount} step={1} min={0} max={60} note="Combined lack of control + marketability" />
          <InputField label="Note Duration" suffix="years" value={duration} onChange={setDuration} step={1} min={1} max={30} note={duration > 9 ? "Long-term AFR applies" : duration > 3 ? "Mid-term AFR applies" : "Short-term AFR applies"} />
          <InputField label="AFR Interest Rate" suffix="%" value={rate} onChange={setRate} step={0.01} min={0} max={15} note="March 2026 LT: 4.72% · MT: 3.93%" />
          <InputField
            label="Annual Payment"
            prefix="$"
            value={annualPayment}
            onChange={setAnnualPayment}
            step={10000}
            min={0}
            note={`Min (interest-only): ${fmt(minPayment)}/yr`}
          />
          <InputField label="Investment Return" suffix="%" value={returnRate} onChange={setReturnRate} step={0.1} min={0} max={30} />
          <InputField label="Grantor Tax Rate" suffix="%" value={taxRate} onChange={setTaxRate} step={1} min={0} max={60} note="Fed + state combined rate" />
          <InputField label="Taxable Portion of Return" suffix="%" value={taxablePortion} onChange={setTaxablePortion} step={5} min={0} max={100} note="% of return realized as current-year income" />
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: "28px 40px", borderBottom: "1px solid #1b3a5c22" }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a9eff", marginBottom: 16, marginTop: 0 }}>
          Summary
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <MetricCard label="Purchase Price (Discounted)" value={fmt(purchasePrice)} sub={`${discount}% discount on ${fmt(llcValue)}`} />
          <MetricCard label="Implied Gift (Discount)" value={fmt(impliedGift)} accent="#f0a040" />
          <MetricCard label="Total Payments to Grantor" value={fmt(totalPayments)} sub={`Interest: ${fmt(totalInterest)} · Principal: ${fmt(totalPrincipal)}`} />
          <MetricCard label="Trust Value at Maturity" value={fmt(netTransfer)} accent="#4aefc0" />
          <MetricCard label="Total Grantor Tax Benefit" value={fmt(totalTaxBenefit)} accent="#c084fc" sub={`${taxablePortion}% of return taxed at ${taxRate}%`} />
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: "28px 40px 60px" }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a9eff", marginBottom: 16, marginTop: 0 }}>
          Year-by-Year Cash Flow
        </h2>
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #1b3a5c44" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{
                    padding: "12px 14px", textAlign: c.key === "year" ? "center" : "right",
                    background: "#0a1628", color: "#6b8ab0", fontWeight: 600,
                    fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
                    borderBottom: "2px solid #1b3a5c",
                    position: "sticky", top: 0, zIndex: 1,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashFlows.map((row, i) => (
                <tr key={row.year} style={{
                  background: i % 2 === 0 ? "#0d1b2a" : "#0f2237",
                  transition: "background 0.15s",
                }}>
                  {columns.map((c) => {
                    const val = row[c.key];
                    const isNeg = typeof val === "number" && val < 0;
                    const isYear = c.key === "year";
                    const isBalloon = c.key === "balloon" && val > 0;
                    return (
                      <td key={c.key} style={{
                        padding: "10px 14px",
                        textAlign: isYear ? "center" : "right",
                        color: isNeg ? "#ff6b6b" : isBalloon ? "#f0a040" : isYear ? "#4a9eff" : "#c8d8e8",
                        fontWeight: isYear || isBalloon ? 700 : 400,
                        borderBottom: "1px solid #1b3a5c22",
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

      {/* Disclaimer */}
      <div style={{
        padding: "20px 40px 36px",
        borderTop: "1px solid #1b3a5c22",
      }}>
        <p style={{ fontSize: 10, color: "#3a5a7a", lineHeight: 1.6, maxWidth: 900, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
          This tool is for educational and illustrative purposes only and does not constitute tax, legal, or financial advice. 
          AFR rates shown are based on IRS Rev. Rul. 2026-06 (March 2026) and change monthly. 
          Valuation discounts require a qualified independent appraisal. 
          Consult qualified tax and legal professionals before implementing any estate planning strategy.
        </p>
      </div>
    </div>
  );
}
