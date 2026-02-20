from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal
import joblib
import pandas as pd
import os

# --------------------------------------------------
# Load Models Safely
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

rf_model = joblib.load(os.path.join(BASE_DIR, "rf_model.pkl"))
knn_model = joblib.load(os.path.join(BASE_DIR, "knn_model.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "scaler.pkl"))
feature_columns = joblib.load(os.path.join(BASE_DIR, "feature_columns.pkl"))

# --------------------------------------------------
# FastAPI App
# --------------------------------------------------

app = FastAPI(title="AI Financial Advisory Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# Request Schema
# --------------------------------------------------

class LoanRequest(BaseModel):
    person_age: int
    person_income: float
    person_home_ownership: str
    person_emp_length: int
    loan_intent: str
    loan_grade: str
    loan_amnt: float
    loan_int_rate: float
    loan_percent_income: float
    cb_person_default_on_file: str
    cb_person_cred_hist_length: int

    monthly_revenue: float
    monthly_expenses: float
    existing_debt: float
    monthly_emi: float

    volatility: Literal["LOW", "MEDIUM", "HIGH"]

# --------------------------------------------------
# Prediction Endpoint
# --------------------------------------------------

@app.post("/predict")
def predict(request: LoanRequest):

    # ------------------------------
    # Encode Volatility (UPDATED)
    # ------------------------------

    volatility_map = {
        "LOW": 0,
        "MEDIUM": 1,
        "HIGH": 2
    }

    volatility_encoded = volatility_map.get(request.volatility.upper(), 1)

    # ------------------------------
    # Financial Calculations
    # ------------------------------

    surplus = request.monthly_revenue - request.monthly_expenses
    debt_ratio = request.existing_debt / (request.person_income + 1)

    # ------------------------------
    # Prepare Data for ML
    # ------------------------------

    input_dict = request.dict()
    input_dict["volatility"] = volatility_encoded  # Replace string with encoded value

    df = pd.DataFrame([input_dict])

    # Align with training feature order
    df = df.reindex(columns=feature_columns, fill_value=0)

    # Scale
    df_scaled = scaler.transform(df)

    # ------------------------------
    # ML Predictions
    # ------------------------------

    rf_pred = rf_model.predict(df_scaled)[0]
    knn_pred = knn_model.predict(df_scaled)[0]

    # ------------------------------
    # Score Calculation
    # ------------------------------

    base_score = (rf_pred + knn_pred) * 25
    financial_bonus = max(0, surplus / 100)

    score = int(base_score + financial_bonus)

    # ------------------------------
    # Risk Tier Logic
    # ------------------------------

    if score >= 80:
        tier = "Low Risk"
    elif score >= 60:
        tier = "Medium Risk"
    else:
        tier = "High Risk"

    # ------------------------------
    # Loan Recommendation
    # ------------------------------

    recommended_loan = int(max(0, surplus * 6))

    # ------------------------------
    # Final Response
    # ------------------------------

    return {
        "score": score,
        "tier": tier,
        "surplus": surplus,
        "debtRatio": debt_ratio,
        "recommendedLoan": recommended_loan
    }