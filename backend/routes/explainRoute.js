import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post("/generate", async (req, res) => {
  try {
    const { score, debtRatio, surplus, volatility } = req.body;

    const prompt = `
You are an AI-powered advisory layer integrated with a deterministic financial risk engine.

SYSTEM ARCHITECTURE CONTEXT:
- The risk score is generated using structured financial rules.
- These rules evaluate cashflow stability, debt ratio, EMI burden, and volatility.
- You must NOT modify or recompute the score.
- You enhance interpretability and provide structured advisory insight.

Financial Data:
- Risk Score: ${score}
- Debt Ratio: ${debtRatio}
- Monthly Surplus: ${surplus}
- Cashflow Volatility: ${volatility}

IMPORTANT:
Return ONLY valid JSON.
Do NOT return markdown.
Do NOT wrap in code blocks.
No extra text before or after JSON.

FORMAT:

{
  "explanation": "Structured advisory explanation",
  "strategy": "Practical loan strategy guidance",
  "underwritingMemo": "Formal structured bank-style credit memo including:
  - Executive Summary
  - Risk Assessment
  - Financial Strengths
  - Key Risk Concerns
  - Lending Recommendation
  - Suggested Loan Structure
  - Conditional Covenants (if applicable)"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional fintech credit risk AI. Always output valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    });

    let aiText = completion.choices[0].message.content.trim();

    // 🔥 Remove markdown if model accidentally adds it
    if (aiText.startsWith("```")) {
      aiText = aiText.replace(/```json|```/g, "").trim();
    }

    let parsed;

    try {
      parsed = JSON.parse(aiText);
    } catch (err) {
      parsed = {
        explanation: aiText,
        strategy:
          "Strategic advisory temporarily unavailable. Please review financial stability before applying.",
        underwritingMemo:
          "Underwriting memo unavailable due to formatting issue."
      };
    }

    // ✅ Always return all fields (frontend safety)
    res.json({
      explanation: parsed.explanation || "Advisory unavailable",
      strategy: parsed.strategy || "Strategy unavailable",
      underwritingMemo:
        parsed.underwritingMemo || "Underwriting memo unavailable"
    });

  } catch (error) {
    console.error("AI Error:", error);

    res.status(500).json({
      explanation: "AI advisory temporarily unavailable.",
      strategy: "Strategy unavailable.",
      underwritingMemo: "Underwriting memo unavailable."
    });
  }
});

export default router;