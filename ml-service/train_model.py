import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier

# Load data
columns = [
    "person_name",
    "person_city",
    "person_income",
    "person_emp_length",
    "loan_amnt",
    "person_age",
    "loan_percent_income",
    "loan_status"
]

df = pd.read_csv("loan_approval.csv", header=None, names=columns)

df.columns = df.columns.str.lower().str.strip()
df["loan_status"] = df["loan_status"].astype(str).str.lower().map({"true":1,"false":0})

df.fillna(df.median(numeric_only=True), inplace=True)

# Encode categorical
for col in df.select_dtypes(include="object"):
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])

X = df.drop(columns=["loan_status"])
y = df["loan_status"]

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

model = RandomForestClassifier(n_estimators=200, random_state=42)
model.fit(X_scaled, y)

# SAVE EVERYTHING
joblib.dump(model, "rf_model.pkl")
joblib.dump(scaler, "scaler.pkl")
joblib.dump(X.columns.tolist(), "feature_columns.pkl")

print("✅ Model trained & saved")