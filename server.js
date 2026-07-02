const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI, Type } = require("@google/genai");
const firebaseAdmin = require("./config/firebaseAdmin");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" })); // important for stability
app.use(express.static("public"));

const db = firebaseAdmin.db;
const admin = firebaseAdmin.admin;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ---------------- SCHEMA ----------------
const complaintSchema = {
  type: Type.OBJECT,
  properties: {
    problem: { type: Type.STRING },
    category: { type: Type.STRING },
    city: { type: Type.STRING },
    area: { type: Type.STRING },
    pincode: { type: Type.STRING },
    department: { type: Type.STRING },
    authority: { type: Type.STRING },
    priority: { type: Type.STRING },
  },
  required: [
    "problem",
    "category",
    "city",
    "area",
    "pincode",
    "department",
    "authority",
    "priority",
  ],
};

// ---------------- ROUTE 1 ----------------
app.post("/analyze", async (req, res) => {
  console.log("Analyze route hit");

  try {
    const { complaint } = req.body;

    if (!complaint) {
      return res.status(400).json({ error: "Complaint is required" });
    }

    const prompt = `
You are an AI government complaint assistant.
Analyze and categorize the complaint.

Complaint: ${complaint}
`;

    let response;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: complaintSchema,
          },
        });

        break;
      } catch (err) {
        if (err.status === 503 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      return res.status(500).json({ error: "AI failed to respond" });
    }

    // SAFE parsing (prevents crash)
    const text =
      response?.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text;

    const result = JSON.parse(text);

    res.json({ result });
  } catch (error) {
    console.error("AI Analysis failed:", error);

    res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
});

// ---------------- ROUTE 2 ----------------
app.post("/generate-letter", async (req, res) => {
  try {
    const data = req.body;

    const prompt = `
Create a formal complaint letter.

Problem: ${data.problem}
Authority: ${data.authority}
Department: ${data.department}
Location: ${data.area}, ${data.city} (${data.pincode})

Return only the letter.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const letter =
      response?.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text;

    await db.collection("complaints").add({
      uid: data.uid || "",
      name: data.name || "",
      email: data.email || "",
      phone: data.phone || "",
      address: data.address || "",
      city: data.city,
      pincode: data.pincode,
      problem: data.problem,
      authority: data.authority,
      department: data.department,
      area: data.area,
      letter: letter,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ letter });
  } catch (error) {
    console.error("Letter generation failed:", error);

    res.status(500).json({
      error: error.message || "Letter generation failed",
    });
  }
});

// ---------------- TEST ROUTE ----------------
app.get("/test-firestore", async (req, res) => {
  try {
    const docRef = await db.collection("test").add({
      message: "Firestore Connected!",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ---------------- SERVER ----------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});