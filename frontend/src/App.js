import { useState } from "react";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from "chart.js";
import { Radar } from "react-chartjs-2";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

function App() {
  const [formData, setFormData] = useState({
    revenue: "",
    expenses: "",
    debt: "",
    emi: "",
    volatility: "medium"
  });

  const [result, setResult] = useState(null);
  const [scenarioResult, setScenarioResult] = useState(null);
  const [viewMode, setViewMode] = useState("msme");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [scenario, setScenario] = useState({
    revenueIncrease: 0,
    expenseReduction: 0,
    emiReduction: 0
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleScenarioChange = (e) => {
    setScenario({ ...scenario, [e.target.name]: Number(e.target.value) });
  };

  const getRiskColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-500";
    return "text-red-600";
  };

  const getLenderInsights = (data) => {
    const probabilityOfDefault = Math.max(100 - data.score, 5);

    const approval =
      data.score >= 80
        ? "Approve"
        : data.score >= 65
        ? "Approve with Conditions"
        : "High Risk - Manual Review Required";

    const rawConfidence =
  100 - Math.abs(data.debtRatio * 100 - 50);

const confidenceScore = Math.max(
  0,
  Math.min(rawConfidence, 95)
);

    return { probabilityOfDefault, approval, confidenceScore };
  };


  const getBankMatches = (data) => {
  const banks = [
    { name: "HDFC Bank", riskPreference: 75, baseRate: 11.5 },
    { name: "ICICI Bank", riskPreference: 70, baseRate: 11 },
    { name: "Axis Bank", riskPreference: 65, baseRate: 12 },
    { name: "FinEdge NBFC", riskPreference: 55, baseRate: 14 }
  ];

  return banks.map((bank) => {
    const matchScore = Math.max(
      50,
      100 - Math.abs(data.score - bank.riskPreference)
    );

    const interestRate =
      data.score >= 80
        ? bank.baseRate
        : data.score >= 65
        ? bank.baseRate + 1
        : bank.baseRate + 2;

    return {
      ...bank,
      matchScore: Math.round(matchScore),
      interestRate,
      maxLoan: Math.round(data.recommendedLoan * (0.9 + matchScore / 200))
    };
  });
};

  const downloadReport = async () => {
    const lender = getLenderInsights(result);

    const response = await fetch("http://localhost:8000/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: result.score,
        tier: result.tier,
        surplus: result.surplus,
        debtRatio: result.debtRatio,
        recommendedLoan: result.recommendedLoan,
        probabilityOfDefault: lender.probabilityOfDefault,
        approval: lender.approval,
        explanation: result.explanation
      })
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "MSME_Credit_Report.pdf";
    a.click();
  };

  const callRiskEngine = async (payload) => {
    const response = await fetch("http://localhost:8000/api/risk/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  };

  const callAIExplain = async (data) => {
    const response = await fetch("http://localhost:8000/api/explain/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: data.score,
        debtRatio: data.debtRatio,
        surplus: data.surplus,
        volatility: formData.volatility
      })
    });
    return await response.json();
  };

  const calculateRisk = async () => {
    setLoading(true);

    const payload = {
      revenue: Number(formData.revenue),
      expenses: Number(formData.expenses),
      debt: Number(formData.debt),
      emi: Number(formData.emi),
      volatility: formData.volatility
    };

    const riskData = await callRiskEngine(payload);
    const explainData = await callAIExplain(riskData);

    setResult({
  ...riskData,
  explanation: explainData.explanation,
  strategy: explainData.strategy,
  underwritingMemo: explainData.underwritingMemo, // ⭐ ADD THIS
  recommendedLoan: riskData.surplus * 6
});

    setScenarioResult(null);
    setLoading(false);
  };

  const simulateScenario = async () => {
    const newRevenue =
      Number(formData.revenue) * (1 + scenario.revenueIncrease / 100);
    const newExpenses =
      Number(formData.expenses) * (1 - scenario.expenseReduction / 100);
    const newEmi =
      Number(formData.emi) * (1 - scenario.emiReduction / 100);

    const payload = {
      revenue: newRevenue,
      expenses: newExpenses,
      debt: Number(formData.debt),
      emi: newEmi,
      volatility: formData.volatility
    };

    const riskData = await callRiskEngine(payload);

    setScenarioResult({
      ...riskData,
      recommendedLoan: riskData.surplus * 6
    });
  };

  const calculateHealthMetrics = (data) => {
    const cashflowStrength = Math.min((data.surplus / 100000) * 100, 100);
    const debtExposure = 100 - data.debtRatio * 100;
    const stability =
      formData.volatility === "low"
        ? 90
        : formData.volatility === "medium"
        ? 70
        : 50;
    const repaymentCapacity = Math.min(
      (data.surplus / (Number(formData.emi) + 1)) * 10,
      100
    );
    const growthReadiness = data.score;

    return [
      Math.max(cashflowStrength, 10),
      Math.max(debtExposure, 10),
      Math.max(stability, 10),
      Math.max(repaymentCapacity, 10),
      Math.max(growthReadiness, 10)
    ];
  };

  const radarData =
    result && {
      labels: [
        "Cashflow Strength",
        "Debt Exposure",
        "Stability",
        "Repayment Capacity",
        "Growth Readiness"
      ],
      datasets: [
        {
          label: "Current Health",
          data: calculateHealthMetrics(result),
          backgroundColor: "rgba(37,99,235,0.2)",
          borderColor: "rgba(37,99,235,1)",
          borderWidth: 2
        },
        scenarioResult && {
          label: "Scenario Health",
          data: calculateHealthMetrics(scenarioResult),
          backgroundColor: "rgba(16,185,129,0.2)",
          borderColor: "rgba(16,185,129,1)",
          borderWidth: 2
        }
      ].filter(Boolean)
    };

  return (
    <div
  className={`min-h-screen transition-all duration-500 ${
    darkMode
      ? "bg-[#0f172a] text-gray-200"
      : "bg-[#f6f9fc] text-gray-900"
  }`}
>

      {/* HERO SECTION */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white py-20 px-8 text-center relative">
        <h1 className="text-4xl md:text-5xl font-extrabold">
          AI-Powered MSME Credit Intelligence Platform
        </h1>

        <p className="mt-6 text-lg md:text-xl max-w-3xl mx-auto opacity-90">
          Real-time Risk Scoring • Explainable AI Advisory • Scenario Simulation • Bank-Ready Reports
        </p>
        <button
    onClick={() => setDarkMode(!darkMode)}
    className="absolute top-6 right-6 bg-white text-black px-4 py-2 rounded-full shadow-md"
     >
      {darkMode ? "Light Mode" : "Dark Mode"}
      </button>
      </div>

      <div className="p-8">
        <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-2xl p-8">

          <h2 className="text-3xl font-bold text-center">
            MSME AI Financial Health Engine
          </h2>

          {/* FORM */}
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {["revenue", "expenses", "debt", "emi"].map((field) => (
              <input
                key={field}
                type="number"
                name={field}
                placeholder={field}
                value={formData[field]}
                onChange={handleChange}
                className="border rounded-lg p-3"
              />
            ))}

            <select
              name="volatility"
              value={formData.volatility}
              onChange={handleChange}
              className="border rounded-lg p-3"
            >
              <option value="low">Low Volatility</option>
              <option value="medium">Medium Volatility</option>
              <option value="high">High Volatility</option>
            </select>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={calculateRisk}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl"
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          {result && (
            <div className="mt-12">
              <div className="flex justify-center gap-4 mb-6">
                <button onClick={() => setViewMode("msme")} className="px-4 py-2 bg-gray-200 rounded-lg">MSME View</button>
                <button onClick={() => setViewMode("lender")} className="px-4 py-2 bg-gray-200 rounded-lg">Lender View</button>
              </div>

              <div className="bg-gray-50 p-8 rounded-2xl shadow-inner">

                {viewMode === "msme" && (
                  <>
                    <div className={`text-6xl font-bold text-center ${getRiskColor(result.score)}`}>
                      {result.score}
                    </div>

                    {/* DECISION BADGE */}
<div className="flex justify-center mt-6">
  {(() => {
    const lender = getLenderInsights(result);

    let bgColor = "";
    let text = "";

    if (result.score >= 80) {
      bgColor = "bg-green-100 text-green-700 border-green-500";
      text = "APPROVED";
    } else if (result.score >= 65) {
      bgColor = "bg-yellow-100 text-yellow-700 border-yellow-500";
      text = "APPROVE WITH CONDITIONS";
    } else {
      bgColor = "bg-red-100 text-red-700 border-red-500";
      text = "HIGH RISK – STABILIZATION REQUIRED";
    }

    return (
      <div
        className={`px-6 py-3 rounded-full border-2 font-semibold text-sm tracking-wide ${bgColor}`}
      >
        {text}
      </div>
    );
  })()}
</div>
                    {/* KPI CARDS */}
         <div className="grid md:grid-cols-4 gap-6 mt-10">

      {/* Risk Score */}
     <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-6 rounded-2xl shadow-xl">
      <p className="text-sm opacity-80">Risk Score</p>
      <h3 className="text-3xl font-bold mt-2">{result.score}</h3>
      </div>

      {/* Recommended Loan */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white p-6 rounded-2xl shadow-xl">
        <p className="text-sm opacity-80">Loan Capacity</p>
        <h3 className="text-3xl font-bold mt-2">
      ₹{result.recommendedLoan.toLocaleString()}
      </h3>
      </div>

       {/* Probability of Default */}
       <div className="bg-gradient-to-br from-rose-500 to-red-600 text-white p-6 rounded-2xl shadow-xl">
         <p className="text-sm opacity-80">Default Probability</p>
          <h3 className="text-3xl font-bold mt-2">
           {getLenderInsights(result).probabilityOfDefault}%
             </h3>
                </div>

                 {/* Model Confidence */}
                 <div className="bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white p-6 rounded-2xl shadow-xl">
                  <p className="text-sm opacity-80">Model Confidence</p>
                  <h3 className="text-3xl font-bold mt-2">
                   {Math.round(getLenderInsights(result).confidenceScore)}%
                   </h3>
                   </div>

                    </div>

                    {/* 🔥 RISK SIGNAL CHIPS */}
<div className="flex flex-wrap justify-center gap-3 mt-6">

  {result.debtRatio > 2 && (
    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
      High Leverage Exposure
    </span>
  )}

  {formData.volatility === "high" && (
    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
      Revenue Volatility Risk
    </span>
  )}

  {result.surplus > 0 && (
    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
      Positive Cashflow
    </span>
  )}

  {result.surplus <= 0 && (
    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
      Negative Cashflow
    </span>
  )}

</div>

                    <p className="text-center mt-2">
                      Tier: {result.tier} | Recommended Loan: ₹{result.recommendedLoan}
                    </p>

                    <div className="mt-8">{radarData && <Radar data={radarData} />}</div>

                    <div className="mt-8 bg-white p-6 rounded-xl shadow">
                      <h3 className="text-xl font-semibold mb-4">AI Advisory</h3>
                      <div className="whitespace-pre-line">{result.explanation}</div>
                    </div>

                    <div className="mt-8 bg-white p-6 rounded-xl shadow">
                      <h3 className="text-xl font-semibold mb-4">What-If Scenario Simulator</h3>

                      <div className="grid md:grid-cols-3 gap-4">
                        <input type="number" name="revenueIncrease" placeholder="Revenue Increase %" onChange={handleScenarioChange} className="border p-3 rounded-lg" />
                        <input type="number" name="expenseReduction" placeholder="Expense Reduction %" onChange={handleScenarioChange} className="border p-3 rounded-lg" />
                        <input type="number" name="emiReduction" placeholder="EMI Reduction %" onChange={handleScenarioChange} className="border p-3 rounded-lg" />
                      </div>

                      <div className="text-center mt-4">
                        <button onClick={simulateScenario} className="px-6 py-3 bg-blue-600 text-white rounded-xl">
                          Simulate Impact
                        </button>
                      </div>

                      {scenarioResult && (
                        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                          <p>Scenario Score: {scenarioResult.score}</p>
                          <p>Improvement: {scenarioResult.score - result.score}</p>
                          <p>New Loan: ₹{scenarioResult.recommendedLoan}</p>
                        </div>
                      )}
                    </div>

                    {/* AI LENDER MATCH ENGINE */}
<div className="mt-10 bg-white p-6 rounded-xl shadow">
  <h3 className="text-xl font-semibold mb-6">
    🏦 AI Lender Match Engine
  </h3>

  <div className="grid md:grid-cols-2 gap-6">
    {getBankMatches(result)
      .sort((a, b) => b.matchScore - a.matchScore)
      .map((bank, index) => (
        <div
          key={bank.name}
          className={`p-5 rounded-xl border ${
            index === 0
              ? "border-green-500 bg-green-50"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">{bank.name}</h4>
            {index === 0 && (
              <span className="text-xs bg-green-600 text-white px-3 py-1 rounded-full">
                AI Recommended
              </span>
            )}
          </div>

          <p className="mt-2 text-sm">
            Interest Rate: <strong>{bank.interestRate}%</strong>
          </p>
          <p className="text-sm">
            Match Score: <strong>{bank.matchScore}%</strong>
          </p>
          <p className="text-sm">
            Max Loan Offer: ₹{bank.maxLoan.toLocaleString()}
          </p>
          <div className="mt-3 text-xs text-gray-500">
  <p className="font-medium text-gray-600">Why This Bank?</p>
  <p>
    Risk alignment score of {bank.matchScore}% based on underwriting tolerance 
    and borrower credit profile compatibility.
  </p>
</div>
        </div>
      ))}
  </div>
</div>

{result.underwritingMemo && (
  <div className="mt-8 bg-gray-900 text-white p-6 rounded-xl shadow">
    <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">
    AI Decision Intelligence Layer
  </p>

    <h3 className="text-xl font-semibold mb-4">
      Bank Underwriting Memo (Internal Credit Note)
    </h3>

    <div className="whitespace-pre-line text-gray-300 text-sm">
      {result.underwritingMemo}
    </div>
  </div>
)}



                    <div className="text-center mt-6">
                      <button onClick={downloadReport} className="px-6 py-3 bg-green-600 text-white rounded-xl">
                        Download Loan Readiness Report (PDF)
                      </button>
                    </div>
                  </>
                )}

                {viewMode === "lender" && (
  <>
    {(() => {
      const lender = getLenderInsights(result);

      return (
        <div className="space-y-8">

          {/* TOP METRIC CARDS */}
          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Risk Score</p>
              <h3 className="text-3xl font-bold mt-2">{result.score}</h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Probability of Default</p>
              <h3 className="text-3xl font-bold mt-2">
                {lender.probabilityOfDefault}%
              </h3>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Approval Recommendation</p>
              <h3 className="text-xl font-semibold mt-2">
                {lender.approval}
              </h3>
            </div>

          </div>

          {/* Competitive Positioning */}
<div className="mt-8 bg-white p-6 rounded-xl shadow">
  <h3 className="text-lg font-semibold mb-4">
    Competitive Lender Positioning
  </h3>

  {getBankMatches(result)
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((bank, index) => (
      <div
        key={bank.name}
        className="flex justify-between border-b py-3 text-sm"
      >
        <span>{bank.name}</span>
        <span>{bank.interestRate}%</span>
        <span>{bank.matchScore}% Match</span>
      </div>
    ))}
</div>

          {/* MODEL CONFIDENCE BAR */}
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-gray-500 text-sm mb-3">
              Model Confidence
            </p>

            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.round(lender.confidenceScore)}%` }}
              ></div>
            </div>

            <p className="mt-2 text-sm text-gray-600">
              {Math.round(lender.confidenceScore)}% structural reliability
            </p>
          </div>

          {/* RED FLAG SECTION */}
          <div className="bg-white p-6 rounded-xl shadow">
            <p className="text-gray-500 text-sm mb-3">
              Risk Flags
            </p>

            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
              {result.debtRatio > 0.6 && <li>High leverage exposure</li>}
              {result.surplus <= 0 && <li>Negative monthly cashflow</li>}
              {formData.volatility === "high" && <li>High revenue volatility</li>}

              {result.debtRatio <= 0.6 &&
                result.surplus > 0 &&
                formData.volatility !== "high" && (
                  <li>No major structural financial risks detected</li>
                )}
            </ul>
          </div>

        </div>
      );
    })()}
  </>
)}

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;