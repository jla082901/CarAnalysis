import { useState } from "react";

const MAKES = ["Acura","Audi","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","Ford","GMC","Honda","Hyundai","Infiniti","Jeep","Kia","Lexus","Lincoln","Mazda","Mercedes-Benz","Nissan","Ram","Subaru","Tesla","Toyota","Volkswagen","Volvo","Other"];

const BASE_VALUES = {
  "Toyota": 1.08, "Honda": 1.06, "Subaru": 1.05, "Mazda": 1.04, "Lexus": 1.07,
  "Ford": 1.0, "Chevrolet": 0.98, "GMC": 0.99, "Ram": 1.01, "Jeep": 0.97,
  "BMW": 1.05, "Mercedes-Benz": 1.04, "Audi": 1.03, "Volvo": 1.01,
  "Hyundai": 1.0, "Kia": 1.0, "Nissan": 0.97, "Infiniti": 1.0,
  "Tesla": 1.06, "Acura": 1.03, "Cadillac": 0.99, "Lincoln": 0.98,
  "Buick": 0.97, "Chrysler": 0.95, "Dodge": 0.96, "Volkswagen": 1.0, "Other": 1.0
};

function analyzeDeal({ make, year, mileage, askingPrice, condition, carType }) {
  const currentYear = 2026;
  const age = currentYear - parseInt(year);
  const brandMult = BASE_VALUES[make] || 1.0;

  // Base MSRP estimate by type
  const baseMSRP = { sedan: 28000, suv: 36000, truck: 42000, coupe: 32000, hatchback: 26000, minivan: 38000, convertible: 40000 }[carType] || 30000;

  // Depreciation: ~15% yr1, ~13% yr2, ~10% yr3-5, ~7% yr6+
  let value = baseMSRP * brandMult;
  for (let i = 0; i < age; i++) {
    const rate = i === 0 ? 0.15 : i === 1 ? 0.13 : i < 5 ? 0.10 : 0.07;
    value *= (1 - rate);
  }

  // Mileage adjustment (avg 12k/yr)
  const avgMiles = age * 12000;
  const mileDiff = parseInt(mileage) - avgMiles;
  value -= mileDiff * 0.06; // ~$0.06/mile over/under average

  // Condition adjustment
  const condAdj = { excellent: 1.10, good: 1.0, fair: 0.88, poor: 0.74 }[condition] || 1.0;
  value *= condAdj;
  value = Math.max(value, 2000);

  const fairMin = value * 0.95;
  const fairMax = value * 1.08;
  const asking = parseFloat(askingPrice);
  const diff = asking - value;
  const pctOff = ((asking - value) / value) * 100;

  let verdict, color, emoji, advice;
  if (asking < fairMin * 0.93) {
    verdict = "STEAL"; color = "#00e676"; emoji = "🔥";
    advice = "This is priced well below market — move fast before someone else grabs it. Verify history with a Carfax and get a pre-purchase inspection before committing.";
  } else if (asking <= fairMax) {
    verdict = "FAIR DEAL"; color = "#69f0ae"; emoji = "✅";
    advice = "This is priced fairly for the market. You can try negotiating $200–$500 off, but don't walk away over small differences. Focus on getting a good rate on financing.";
  } else if (asking <= fairMax * 1.08) {
    verdict = "SLIGHTLY HIGH"; color = "#ffd740"; emoji = "⚠️";
    advice = `This is about $${Math.abs(Math.round(diff)).toLocaleString()} over fair market. Negotiate down — start by offering the fair value and meet in the middle. Dealers expect to haggle.`;
  } else {
    verdict = "OVERPRICED"; color = "#ff5252"; emoji = "🚨";
    advice = `This car is priced about $${Math.abs(Math.round(diff)).toLocaleString()} over what it's worth. Either walk away or make a firm offer at $${Math.round(value).toLocaleString()}. Don't let them pressure you.`;
  }

  // Monthly payment estimate (5yr @ 7% APR)
  const monthlyPayment = (asking * (0.07 / 12)) / (1 - Math.pow(1 + 0.07 / 12, -60));
  const totalCost = monthlyPayment * 60;
  const totalInterest = totalCost - asking;

  return {
    fairValue: Math.round(value),
    fairMin: Math.round(fairMin),
    fairMax: Math.round(fairMax),
    verdict, color, emoji, advice,
    diff: Math.round(diff),
    pctOff: pctOff.toFixed(1),
    monthlyPayment: Math.round(monthlyPayment),
    totalInterest: Math.round(totalInterest),
    totalCost: Math.round(totalCost),
  };
}

export default function App() {
  const [form, setForm] = useState({ make: "", year: "", mileage: "", askingPrice: "", condition: "good", carType: "sedan" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiTips, setAiTips] = useState("");
  const [loadingTips, setLoadingTips] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const analyze = () => {
    if (!form.make || !form.year || !form.mileage || !form.askingPrice) return;
    setLoading(true);
    setResult(null);
    setAiTips("");
    setTimeout(() => {
      setResult(analyzeDeal(form));
      setLoading(false);
    }, 900);
  };

  const getAITips = async (res) => {
    setLoadingTips(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a car buying expert. A buyer is looking at a ${form.year} ${form.make} (${form.carType}) with ${parseInt(form.mileage).toLocaleString()} miles in ${form.condition} condition. The dealer is asking $${parseInt(form.askingPrice).toLocaleString()} and the fair market value is about $${res.fairValue.toLocaleString()}. The deal verdict is: ${res.verdict}.

Give 4 sharp, specific negotiation tips for this exact situation. Be direct and practical — like advice from a friend who works at a dealership. No fluff. Format as a numbered list.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      setAiTips(text);
    } catch (e) {
      setAiTips("Could not load tips. Please try again.");
    }
    setLoadingTips(false);
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", background: "#111", border: "1px solid #2a2a2a",
    borderRadius: "8px", color: "#fff", fontSize: "15px", outline: "none",
    fontFamily: "inherit", boxSizing: "border-box", appearance: "none"
  };
  const labelStyle = { display: "block", color: "#888", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", padding: "0 0 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        select option { background: #111; }
        input::placeholder { color: #444; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .slide-in { animation: slideIn 0.4s ease forwards; }
        @keyframes slideIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .btn-main { background: #fff; color: #000; border: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; transition: all 0.2s; font-family: inherit; letter-spacing: 0.02em; }
        .btn-main:hover { background: #e0e0e0; transform: translateY(-1px); }
        .btn-main:disabled { background: #2a2a2a; color: #555; cursor: not-allowed; transform: none; }
        .btn-ai { background: transparent; color: #fff; border: 1px solid #333; padding: 11px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .btn-ai:hover { background: #1a1a1a; border-color: #555; }
        .meter-fill { transition: width 1s ease; }
        input:focus, select:focus { border-color: #444 !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "20px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: 32, height: 32, background: "#fff", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🚗</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px", letterSpacing: "-0.01em" }}>CarDeal Analyzer</div>
          <div style={{ color: "#555", fontSize: "11px" }}>Know what a car is really worth</div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 0" }}>

        {/* Form */}
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontSize: "13px", color: "#555", marginBottom: "20px", letterSpacing: "0.05em", textTransform: "uppercase" }}>Car Details</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>Make</label>
              <select value={form.make} onChange={e => set("make", e.target.value)} style={inputStyle}>
                <option value="">Select...</option>
                {MAKES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <select value={form.year} onChange={e => set("year", e.target.value)} style={inputStyle}>
                <option value="">Select...</option>
                {Array.from({length: 20}, (_, i) => 2025 - i).map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.carType} onChange={e => set("carType", e.target.value)} style={inputStyle}>
                {["sedan","suv","truck","coupe","hatchback","minivan","convertible"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Condition</label>
              <select value={form.condition} onChange={e => set("condition", e.target.value)} style={inputStyle}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
            <div>
              <label style={labelStyle}>Mileage</label>
              <input type="number" placeholder="e.g. 45000" value={form.mileage} onChange={e => set("mileage", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Asking Price ($)</label>
              <input type="number" placeholder="e.g. 22500" value={form.askingPrice} onChange={e => set("askingPrice", e.target.value)} style={inputStyle} />
            </div>
          </div>

          <button className="btn-main" onClick={analyze} disabled={loading || !form.make || !form.year || !form.mileage || !form.askingPrice}>
            {loading ? "Analyzing..." : "Analyze This Deal →"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#555" }}>
            <div className="pulse" style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
            <div style={{ fontSize: "13px" }}>Crunching market data...</div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="slide-in" style={{ marginTop: "20px" }}>

            {/* Verdict Card */}
            <div style={{ background: "#111", border: `1px solid ${result.color}33`, borderRadius: "12px", padding: "24px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: result.color }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Verdict</div>
                  <div style={{ fontSize: "26px", fontWeight: 600, color: result.color, letterSpacing: "-0.02em" }}>{result.emoji} {result.verdict}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px" }}>vs fair value</div>
                  <div style={{ fontSize: "20px", fontWeight: 600, color: result.diff > 0 ? "#ff5252" : "#00e676" }}>
                    {result.diff > 0 ? "+" : ""}${Math.abs(result.diff).toLocaleString()}
                  </div>
                  <div style={{ fontSize: "11px", color: "#555" }}>{result.diff > 0 ? "over" : "under"} market</div>
                </div>
              </div>
              <div style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.6, borderTop: "1px solid #1e1e1e", paddingTop: "14px" }}>
                {result.advice}
              </div>
            </div>

            {/* Value Bar */}
            <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "12px", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>Price Position</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#555", marginBottom: "8px" }}>
                <span>Steal Zone</span><span>Fair Range</span><span>Overpriced</span>
              </div>
              <div style={{ height: "8px", background: "#1e1e1e", borderRadius: "4px", position: "relative", marginBottom: "8px" }}>
                <div style={{ position: "absolute", left: "15%", right: "25%", height: "100%", background: "#1e4d2b", borderRadius: "4px" }} />
                {(() => {
                  const min = result.fairMin * 0.7, max = result.fairMax * 1.4;
                  const pct = Math.min(Math.max(((parseFloat(form.askingPrice) - min) / (max - min)) * 100, 2), 98);
                  return <div style={{ position: "absolute", left: `${pct}%`, top: "-3px", width: "14px", height: "14px", background: result.color, borderRadius: "50%", transform: "translateX(-50%)", border: "2px solid #0a0a0a" }} />;
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "#555" }}>Your price: <span style={{ color: "#fff" }}>${parseInt(form.askingPrice).toLocaleString()}</span></span>
                <span style={{ color: "#555" }}>Fair: <span style={{ color: "#69f0ae" }}>${result.fairMin.toLocaleString()}–${result.fairMax.toLocaleString()}</span></span>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
              {[
                { label: "Fair Market Value", value: `$${result.fairValue.toLocaleString()}`, sub: "estimated" },
                { label: "Est. Monthly*", value: `$${result.monthlyPayment.toLocaleString()}`, sub: "5yr @ 7% APR" },
                { label: "Total Interest*", value: `$${result.totalInterest.toLocaleString()}`, sub: "over loan life" },
              ].map(s => (
                <div key={s.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px", padding: "14px 12px" }}>
                  <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{s.label}</div>
                  <div style={{ fontSize: "18px", fontWeight: 600, fontFamily: "'DM Mono', monospace", marginBottom: "2px" }}>{s.value}</div>
                  <div style={{ fontSize: "10px", color: "#444" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* AI Tips */}
            <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aiTips ? "14px" : "0" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 500 }}>✨ AI Negotiation Tips</div>
                  <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>Tailored advice for this exact deal</div>
                </div>
                {!aiTips && <button className="btn-ai" onClick={() => getAITips(result)} disabled={loadingTips}>{loadingTips ? "Loading..." : "Get Tips →"}</button>}
              </div>
              {loadingTips && <div className="pulse" style={{ color: "#555", fontSize: "13px", marginTop: "10px" }}>Generating tips...</div>}
              {aiTips && (
                <div style={{ fontSize: "13px", color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiTips}</div>
              )}
            </div>

            <div style={{ fontSize: "11px", color: "#333", textAlign: "center", marginTop: "16px" }}>
              *Estimates only. Actual values vary by credit score, down payment, and dealer.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
