from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import os

# --------------------------------------------------
# Load Model Artifacts (SAFE PATH HANDLING)
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = joblib.load(os.path.join(BASE_DIR, "rf_model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "scaler.pkl"))
feature_columns = joblib.load(os.path.join(BASE_DIR, "feature_columns.pkl"))

# --------------------------------------------------
# FastAPI App
# --------------------------------------------------

app = FastAPI(title="MSME Credit Risk Engine")

# --------------------------------------------------
# Request Schema (MATCH FRONTEND)
# --------------------------------------------------

class RiskRequest(BaseModel):
    revenue: float
    expenses: float
    debt: float
    emi: float
    volatility: str  # low | medium | high

# --------------------------------------------------
# Prediction Endpoint
# --------------------------------------------------

@app.post("/predict")
def predict(data: RiskRequest):

    # ---------------- VALIDATION ----------------
    if data.revenue <= 0:
        raise HTTPException(status_code=400, detail="Revenue must be positive")

    if data.emi < 0 or data.expenses < 0:
        raise HTTPException(status_code=400, detail="Invalid financial values")

    # ---------------- FINANCIAL METRICS ----------------
    surplus = data.revenue - data.expenses
    emi_ratio = data.emi / (data.revenue + 1)  # EMI burden ratio
    loan_percent_income = emi_ratio

    # ---------------- FEATURE ENGINEERING ----------------
    # NOTE: These mappings are realistic placeholders
    input_data = {
        "person_income": data.revenue * 12,     # annualized income
        "person_emp_length": 5,                 # assumed MSME stability
        "loan_amnt": max(0, surplus * 6),
        "person_age": 35,
        "loan_percent_income": loan_percent_income,
        "person_name": 0,
        "person_city": 0
    }

    df = pd.DataFrame([input_data])
    df = df.reindex(columns=feature_columns, fill_value=0)

    df_scaled = scaler.transform(df)

    # ---------------- ML PREDICTION (ACCURACY-FOCUSED) ----------------
    # Probability of Default (PD) — bank-grade
    prob_default = model.predict_proba(df_scaled)[0][1]

    # Convert PD → Score
    score = int(100 - (prob_default * 100))

    # ---------------- SCORE SMOOTHING ----------------
    # Prevent unrealistic extremes
    score = max(35, min(score, 95))

    # ---------------- BUSINESS RULE OVERLAY ----------------
    # (Banks NEVER rely on ML alone)

    # EMI burden penalty
    if emi_ratio > 0.45:
        score -= 18
    elif emi_ratio > 0.35:
        score -= 12
    elif emi_ratio > 0.25:
        score -= 6

    # Volatility penalty
    volatility = data.volatility.lower()
    if volatility == "high":
        score -= 8
    elif volatility == "medium":
        score -= 3

    # Re-cap after penalties
    score = max(35, min(score, 95))

    # ---------------- RISK TIERING (REALISTIC) ----------------
    if score >= 85:
        tier = "Low Risk (Prime)"
    elif score >= 70:
        tier = "Moderate Risk (Standard)"
    elif score >= 55:
        tier = "Elevated Risk (Sub-Prime)"
    else:
        tier = "High Risk (Decline)"

    # ---------------- RESPONSE ----------------
    return {
        "score": score,
        "tier": tier,
        "surplus": int(surplus),
        "debtRatio": round(emi_ratio, 2),
        "recommendedLoan": int(max(0, surplus * 6))
    }