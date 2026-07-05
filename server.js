const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { GoogleGenAI, Type } = require("@google/genai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ============================================================================
// LOAD EMAIL MAPPING
// ============================================================================
let emailMapping = {};
try {
  const emailMapPath = path.join(__dirname, "email-mapping.json");
  const emailMapData = fs.readFileSync(emailMapPath, "utf8");
  emailMapping = JSON.parse(emailMapData);
  console.log("✅ Email mapping loaded successfully");
} catch (error) {
  console.warn("⚠️ Email mapping file not found. Will use default emails.");
  emailMapping = {
    categoryToEmail: {
      default: {
        name: "General Grievance Portal",
        state_emails: { default: "grievance@cpgrams.gov.in" }
      }
    }
  };
}

// ============================================================================
// INITIALIZE GEMINI AI
// ============================================================================
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Define schema for complaint analysis
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
  required: ["problem", "category", "city", "area", "pincode", "department", "authority", "priority"],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get email address based on complaint category and state
 * @param {string} category - Complaint category
 * @param {string} state - State name
 * @returns {string} Email address
 */
function getEmailByCategory(category, state) {
  try {
    const categoryData = emailMapping.categoryToEmail[category.toLowerCase()];
    
    if (!categoryData) {
      // Use default email
      return emailMapping.categoryToEmail.default.state_emails.default || "grievance@cpgrams.gov.in";
    }

    // Try to get state-specific email
    const stateEmail = categoryData.state_emails[state.toLowerCase()];
    if (stateEmail) {
      return stateEmail;
    }

    // Fall back to category's default email
    return categoryData.state_emails.default || "grievance@cpgrams.gov.in";
  } catch (error) {
    console.error("Error getting email:", error);
    return "grievance@cpgrams.gov.in";
  }
}

/**
 * Find nearest government office using Gemini AI
 * Uses user's location and complaint category to find relevant office
 * @param {string} complaint - User's complaint text
 * @param {string} category - Complaint category
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {string} city - User's city (from geolocation conversion)
 * @returns {Promise<object>} Office details
 */
async function findNearestOffice(complaint, category, latitude, longitude, city) {
  try {
    const prompt = `
You are an expert in Indian government administration. A citizen has filed a complaint and you need to help them find the nearest appropriate government office.

COMPLAINT: "${complaint}"
CATEGORY: ${category}
USER LOCATION: City: ${city}, Coordinates: (${latitude}, ${longitude})

Your task:
1. Identify the most appropriate government department for this complaint in ${city}
2. Provide the nearest likely office location
3. Include realistic contact details based on Indian government standards

Respond in EXACTLY this JSON format (no extra text):
{
  "officeName": "Name of the office/department",
  "department": "Department name",
  "address": "Full address with street, area, city",
  "pincode": "Postal code",
  "phone": "Phone number if available, else null",
  "email": "Official email if available, else null",
  "authority": "Name of the officer/authority",
  "jurisdiction": "${city} and surrounding areas",
  "processTime": "Estimated response time (e.g., 7-15 days)",
  "escalationLevel": "Which level of government (Municipal/State/Central)"
}

IMPORTANT: 
- Use your knowledge of Indian government offices
- Provide REALISTIC data for ${city}
- If uncertain, provide the most likely department office
- For email, provide the official departmental email
- Phone should be actual government helpline if known`;

    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const response = await model.generateContent(prompt);
    
    const responseText = response.response.text().trim();
    
    // Parse JSON from response
    let officeData;
    try {
      // Extract JSON if it's wrapped in markdown
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        officeData = JSON.parse(jsonMatch[0]);
      } else {
        officeData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error("Failed to parse office data JSON:", responseText);
      // Return default structure if parsing fails
      officeData = {
        officeName: "Government Office",
        department: category,
        address: `${city}, India`,
        pincode: "000000",
        phone: null,
        email: getEmailByCategory(category, city),
        authority: "Government Authority",
        jurisdiction: city,
        processTime: "7-15 days",
        escalationLevel: "State"
      };
    }

    return officeData;
  } catch (error) {
    console.error("Error finding nearest office:", error);
    throw new Error("Failed to find nearest office: " + error.message);
  }
}

/**
 * Convert coordinates to city name (approximation)
 * In production, use Google Maps Reverse Geocoding or OpenStreetMap Nominatim
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {string} City name
 */
function getApproximateCity(latitude, longitude) {
  // This is a simplified version
  // In production, you might want to use OpenStreetMap Nominatim API (free)
  // For now, we'll return "Unknown City" and let the frontend handle it
  
  // Rough approximations for major Indian cities
  const cities = [
    { name: "Delhi", lat: 28.7041, lng: 77.1025, radius: 0.5 },
    { name: "Mumbai", lat: 19.0760, lng: 72.8777, radius: 0.5 },
    { name: "Bangalore", lat: 12.9716, lng: 77.5946, radius: 0.5 },
    { name: "Hyderabad", lat: 17.3850, lng: 78.4867, radius: 0.5 },
    { name: "Chennai", lat: 13.0827, lng: 80.2707, radius: 0.5 },
    { name: "Kolkata", lat: 22.5726, lng: 88.3639, radius: 0.5 },
    { name: "Pune", lat: 18.5204, lng: 73.8567, radius: 0.5 },
    { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, radius: 0.5 },
  ];

  for (let city of cities) {
    const distance = Math.sqrt(Math.pow(latitude - city.lat, 2) + Math.pow(longitude - city.lng, 2));
    if (distance < city.radius) {
      return city.name;
    }
  }

  return "India"; // Default fallback
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * ROUTE 1: /analyze - Analyze complaint and find nearest office
 */
app.post("/analyze", async (req, res) => {
  console.log("📝 Analyze route called");
  try {
    const { complaint, latitude, longitude } = req.body;

    // Validation
    if (!complaint || complaint.trim() === "") {
      return res.status(400).json({ error: "Complaint text is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY not set");
      return res.status(500).json({
        error: "Server configuration error: GEMINI_API_KEY not set"
      });
    }

    console.log(`📍 User location: ${latitude}, ${longitude}`);

    // ========== STEP 1: Analyze complaint and get category ==========
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const analysisPrompt = `
You are an AI government complaint assistant. Analyze this complaint and categorize it.

COMPLAINT: "${complaint}"

Respond in EXACTLY this JSON format:
{
  "problem": "One-line summary of the problem",
  "category": "One of: roads, water, electricity, sewage, waste, food_safety, traffic, corruption, or other",
  "city": "Inferred city or 'Unknown'",
  "area": "Inferred area/locality or 'Not Specified'",
  "pincode": "Inferred pincode or '000000'",
  "department": "Appropriate government department",
  "authority": "Responsible authority name",
  "priority": "High, Medium, or Low based on urgency"
}`;

    const analysisResponse = await model.generateContent(analysisPrompt);
    const analysisText = analysisResponse.response.text().trim();

    let analysisData;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        analysisData = JSON.parse(analysisText);
      }
    } catch (parseError) {
      console.error("Failed to parse analysis:", analysisText);
      return res.status(500).json({ error: "Failed to analyze complaint" });
    }

    console.log("✅ Complaint analyzed:", analysisData.category);

    // ========== STEP 2: Get approximate city from coordinates ==========
    let userCity = analysisData.city !== "Unknown" ? analysisData.city : getApproximateCity(latitude, longitude);
    console.log(`📍 User city determined: ${userCity}`);

    // ========== STEP 3: Find nearest office ==========
    const officeData = await findNearestOffice(
      complaint,
      analysisData.category,
      latitude,
      longitude,
      userCity
    );

    console.log("✅ Office found:", officeData.officeName);

    // ========== STEP 4: Get email for this category and city ==========
    const officialEmail = getEmailByCategory(analysisData.category, userCity);
    officeData.email = officeData.email || officialEmail; // Use found email or fallback

    console.log("📧 Email assigned:", officeData.email);

    // ========== STEP 5: Combine analysis + office data ==========
    const result = {
      ...analysisData,
      office: officeData,
      userCity: userCity,
      userLocation: {
        latitude,
        longitude
      }
    };

    res.json({ result });

  } catch (error) {
    console.error("❌ Error in /analyze:", error.message);
    res.status(500).json({
      error: "Server error during analysis: " + error.message
    });
  }
});

/**
 * ROUTE 2: /generate-letter - Generate complaint letter with validated data
 */
app.post("/generate-letter", async (req, res) => {
  console.log("📄 Generate letter route called");
  try {
    const {
      problem,
      category,
      department,
      authority,
      city,
      office,
      citizenName,
      citizenEmail,
      citizenPhone,
      citizenAddress,
      citizenCity,
      citizenPincode
    } = req.body;

    if (!problem) {
      return res.status(400).json({ error: "Problem description is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "API Key not configured" });
    }

    console.log(`📝 Generating letter for: ${citizenName}`);

    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const letterPrompt = `
You are a professional letter writer. Generate a formal complaint letter.

COMPLAINT DETAILS:
- Problem: ${problem}
- Category: ${category}
- Department: ${department}
- Authority: ${authority}
- Office Address: ${office?.address || city}

CITIZEN DETAILS:
- Name: ${citizenName}
- Email: ${citizenEmail}
- Phone: ${citizenPhone}
- Address: ${citizenAddress}, ${citizenCity} - ${citizenPincode}

Generate a PROFESSIONAL, FORMAL complaint letter that:
1. Addresses the specific authority
2. Clearly describes the problem with details
3. References the complaint category
4. Requests specific action within legal timeframe
5. Includes citizen contact details
6. Is suitable for official submission
7. Follows Indian government format standards

Format: Plain text, no markdown, no bold, no asterisks.
Start with "To," and end with signature line.`;

    const letterResponse = await model.generateContent(letterPrompt);
    const letter = letterResponse.response.text().trim();

    console.log("✅ Letter generated successfully");

    res.json({ letter });

  } catch (error) {
    console.error("❌ Error in /generate-letter:", error.message);
    res.status(500).json({
      error: "Server error generating letter: " + error.message
    });
  }
});

/**
 * ROUTE 3: /health - Health check
 */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    server: "OneComplaint Backend",
    apiKey: !!process.env.GEMINI_API_KEY,
    emailMapping: Object.keys(emailMapping.categoryToEmail || {}).length
  });
});

// ============================================================================
// START SERVER
// ============================================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log("✅ OneComplaint Server Running");
  console.log("=".repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${process.env.GEMINI_API_KEY ? "✅ Loaded" : "❌ Missing"}`);
  console.log(`📧 Email Mappings: ${Object.keys(emailMapping.categoryToEmail || {}).length} categories`);
  console.log("=".repeat(60) + "\n");
});