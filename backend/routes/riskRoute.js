import express from "express";

const router = express.Router();

router.post("/calculate", async (req, res) => {
  try {
    const response = await fetch("http://localhost:8001/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "ML Service error" });
  }
});

export default router;
