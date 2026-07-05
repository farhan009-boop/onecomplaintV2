// ============================================================================
// OneComplaint - Complete Frontend Application
// Updated: All features + Geolocation + Office Finder + Email Detection
// ============================================================================

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDtkXEIHXJrHymHyVHe587-1y9vpMurgLY",
  authDomain: "onecomplaint-618c0.firebaseapp.com",
  projectId: "onecomplaint-618c0",
  storageBucket: "onecomplaint-618c0.firebasestorage.app",
  messagingSenderId: "622889046391",
  appId: "1:622889046391:web:9239f3ee3ec81d28775172"
};

let auth = null;
try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  auth.useDeviceLanguage();
} catch (error) {
  console.error("Firebase init error:", error);
}

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let authenticatedCitizenProfile = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  pincode: ""
};

let userLocation = {
  latitude: null,
  longitude: null,
  city: null,
  detected: false
};

let analysisResult = {
  problem: "",
  category: "",
  city: "",
  area: "",
  pincode: "",
  department: "",
  authority: "",
  priority: "",
  office: null
};

let mediaStreamInstance = null;
let attachedFiles = [];
const MAX_FILES = 3;

// ============================================================================
// GEOLOCATION FUNCTIONS (NEW)
// ============================================================================

/**
 * Request location permission from user
 */
function requestLocationPermission() {
  if ("geolocation" in navigator) {
    console.log("📍 Requesting geolocation...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        userLocation.latitude = latitude;
        userLocation.longitude = longitude;
        userLocation.detected = true;

        console.log(`✅ Location detected: ${latitude}, ${longitude}`);

        // Update UI
        updateLocationBadge();
        hideLocationPrompt();

        // Show success message
        showSuccessMessage("📍 Location enabled for accurate results!");
      },
      (error) => {
        console.warn("⚠️ Location permission denied:", error.message);
        showSuccessMessage("📍 Location not enabled. Using default location.");
        userLocation.detected = false;
        updateLocationBadge();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

/**
 * Update location badge in header
 */
function updateLocationBadge() {
  const badge = document.getElementById("geo-badge-text");
  if (!badge) return;

  if (userLocation.detected && userLocation.latitude && userLocation.longitude) {
    badge.textContent = `📍 Location: Enabled`;
    badge.style.color = "#10b981";
  } else {
    badge.textContent = `📍 Location: Off`;
    badge.style.color = "#ef4444";
  }
}

/**
 * Show location permission prompt (called once on page load)
 */
function showLocationPrompt() {
  const prompt = document.getElementById("location-permission-prompt");
  if (prompt && !userLocation.detected) {
    prompt.style.display = "block";
  }
}

/**
 * Hide location permission prompt
 */
function hideLocationPrompt() {
  const prompt = document.getElementById("location-permission-prompt");
  if (prompt) {
    prompt.style.display = "none";
  }
}

// ============================================================================
// AUTHENTICATION FUNCTIONS (EXISTING)
// ============================================================================

function openAuthModal() {
  const m = document.getElementById("auth-gateway-modal");
  if (m) m.style.display = "block";
}

function closeAuthModal() {
  const m = document.getElementById("auth-gateway-modal");
  if (m) m.style.display = "none";
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById("login-tab");
  const signupTab = document.getElementById("signup-tab");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (tab === "login") {
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
    loginForm.style.display = "block";
    signupForm.style.display = "none";
  } else {
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
    signupForm.style.display = "block";
    loginForm.style.display = "none";
  }
}

async function signInWithGoogle() {
  if (!auth) return alert("Firebase not connected.");
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then((result) => {
        const user = result.user;
        if (user) {
          authenticatedCitizenProfile.name = user.displayName || "";
          authenticatedCitizenProfile.email = user.email || "";

          const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
          authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);
          authenticatedCitizenProfile.name = user.displayName || authenticatedCitizenProfile.name;
          authenticatedCitizenProfile.email = user.email || authenticatedCitizenProfile.email;
          localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));

          updateProfileIndicator();
          closeAuthModal();
          showSuccessMessage("✅ Signed in with Google!");
        }
      })
      .catch((error) => {
        alert("Google Sign-In Error: " + error.message);
      });
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function loginWithEmail() {
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  if (!auth) return alert("Firebase not connected");

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    const user = result.user;
    authenticatedCitizenProfile.email = user.email;

    const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
    authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);
    localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));

    updateProfileIndicator();
    closeAuthModal();
    showSuccessMessage("✅ Logged in successfully!");
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
  } catch (error) {
    alert("Login Error: " + error.message);
  }
}

async function signupWithEmail() {
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;

  if (!email || !password || !confirmPassword) {
    alert("Please fill in all fields");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  if (!auth) return alert("Firebase not connected");

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    const user = result.user;
    authenticatedCitizenProfile.email = user.email;
    localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));

    updateProfileIndicator();
    closeAuthModal();
    showSuccessMessage("✅ Account created successfully!");
    document.getElementById("signup-email").value = "";
    document.getElementById("signup-password").value = "";
    document.getElementById("signup-confirm-password").value = "";
  } catch (error) {
    alert("Signup Error: " + error.message);
  }
}

function logoutUser() {
  if (!auth) return;
  auth.signOut().then(() => {
    authenticatedCitizenProfile = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };
    localStorage.removeItem("oc_local_profile");
    updateProfileIndicator();
    showSuccessMessage("✅ Logged out successfully!");
  });
}

function updateProfileIndicator() {
  const profileBtn = document.getElementById("profile-indicator-name");
  if (profileBtn) {
    const name = authenticatedCitizenProfile.name || "Profile";
    profileBtn.textContent = `👤 ${name}`;
  }
}

// ============================================================================
// PROFILE MODAL FUNCTIONS (EXISTING)
// ============================================================================

function openProfileModal(event) {
  if (event) event.preventDefault();
  const modal = document.getElementById("profile-modal");
  if (modal) {
    const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
    authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);

    document.getElementById("profile-name").value = authenticatedCitizenProfile.name || "";
    document.getElementById("profile-email").value = authenticatedCitizenProfile.email || "";
    document.getElementById("profile-phone").value = authenticatedCitizenProfile.phone || "";
    document.getElementById("profile-address").value = authenticatedCitizenProfile.address || "";
    document.getElementById("profile-city").value = authenticatedCitizenProfile.city || "";
    document.getElementById("profile-pincode").value = authenticatedCitizenProfile.pincode || "";

    modal.style.display = "block";
  }
}

function closeProfileModal() {
  const modal = document.getElementById("profile-modal");
  if (modal) modal.style.display = "none";
}

function saveProfile() {
  authenticatedCitizenProfile.name = document.getElementById("profile-name").value;
  authenticatedCitizenProfile.email = document.getElementById("profile-email").value;
  authenticatedCitizenProfile.phone = document.getElementById("profile-phone").value;
  authenticatedCitizenProfile.address = document.getElementById("profile-address").value;
  authenticatedCitizenProfile.city = document.getElementById("profile-city").value;
  authenticatedCitizenProfile.pincode = document.getElementById("profile-pincode").value;

  localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));

  const msg = document.getElementById("profile-save-msg");
  if (msg) {
    msg.style.display = "block";
    setTimeout(() => {
      msg.style.display = "none";
      closeProfileModal();
    }, 2000);
  }

  updateProfileIndicator();
  showSuccessMessage("✅ Profile updated successfully!");
}

// ============================================================================
// COMPLAINT ANALYSIS FUNCTIONS (UPDATED WITH GEOLOCATION)
// ============================================================================

async function analyzeComplaint() {
  const complaintText = document.getElementById("complaint").value;

  if (!complaintText || complaintText.trim() === "") {
    alert("Please describe your problem");
    return;
  }

  // Check if location is available
  if (!userLocation.detected || !userLocation.latitude || !userLocation.longitude) {
    alert("⚠️ Location not enabled. Using default location for analysis.");
  }

  const analyzeBtn = document.getElementById("analyzeBtn");
  if (analyzeBtn) analyzeBtn.disabled = true;

  try {
    const payload = {
      complaint: complaintText,
      latitude: userLocation.latitude || 28.7041, // Default: Delhi
      longitude: userLocation.longitude || 77.1025
    };

    console.log("📤 Sending to backend:", payload);

    const response = await fetch("https://onecomplaint.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    analysisResult = data.result;

    console.log("✅ Analysis successful:", analysisResult);

    displayRoadmap(analysisResult);
    displayOfficeInfo(analysisResult.office);
    showLetterButton();

  } catch (error) {
    console.error("❌ Error:", error);
    alert(`AI Backend Issue: ${error.message}`);
  } finally {
    if (analyzeBtn) analyzeBtn.disabled = false;
  }
}

/**
 * Display office information (NEW)
 */
function displayOfficeInfo(office) {
  if (!office) return;

  const officeInfo = document.getElementById("office-info-display");
  if (!officeInfo) return;

  let html = `
    <div class="office-card glass-panel">
      <h3>📍 Nearest Government Office</h3>
      <p><strong>Office:</strong> ${office.officeName || "N/A"}</p>
      <p><strong>Department:</strong> ${office.department || "N/A"}</p>
      <p><strong>Address:</strong> ${office.address || "N/A"}</p>
      <p><strong>Pincode:</strong> ${office.pincode || "N/A"}</p>
      <p><strong>Phone:</strong> ${office.phone || "Not available"}</p>
      <p><strong>Email:</strong> ${office.email || "Not available"}</p>
      <p><strong>Authority:</strong> ${office.authority || "N/A"}</p>
      <p><strong>Processing Time:</strong> ${office.processTime || "N/A"}</p>
    </div>
  `;

  officeInfo.innerHTML = html;
}

/**
 * Build complaint roadmap (EXISTING - kept as-is)
 */
function buildComplaintRoadmap(result) {
  const roadmapHtml = `
    <div class="roadmap-section">
      <h3 style="text-align: center; margin-bottom: 30px; font-size: 20px;">📋 Your Complaint Journey</h3>
      
      <div class="roadmap-step">
        <div class="roadmap-step-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">1</div>
        <div class="roadmap-content">
          <div class="roadmap-step-title">Complaint Registered</div>
          <div class="roadmap-step-desc">Your complaint has been successfully registered in the system. Screenshot saved.</div>
        </div>
      </div>
      
      <div class="roadmap-connector"></div>
      
      <div class="roadmap-step">
        <div class="roadmap-step-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">2</div>
        <div class="roadmap-content">
          <div class="roadmap-step-title">Assigned to Department</div>
          <div class="roadmap-step-desc">Routed to <strong>${result.department || "Relevant"}</strong> department. Expected: 1-2 days.</div>
        </div>
      </div>
      
      <div class="roadmap-connector"></div>
      
      <div class="roadmap-step">
        <div class="roadmap-step-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">3</div>
        <div class="roadmap-content">
          <div class="roadmap-step-title">Under Review</div>
          <div class="roadmap-step-desc">Department reviewing complaint. Will investigate and verify details. Expected: 3-7 days.</div>
        </div>
      </div>
      
      <div class="roadmap-connector"></div>
      
      <div class="roadmap-step">
        <div class="roadmap-step-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">4</div>
        <div class="roadmap-content">
          <div class="roadmap-step-title">Action Taken</div>
          <div class="roadmap-step-desc">Department has initiated corrective measures. Expected: 5-15 days.</div>
        </div>
      </div>
      
      <div class="roadmap-connector"></div>
      
      <div class="roadmap-step">
        <div class="roadmap-step-icon" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);">5</div>
        <div class="roadmap-content">
          <div class="roadmap-step-title">Resolved ✓</div>
          <div class="roadmap-step-desc">Issue resolved. You'll receive notification and completion certificate.</div>
        </div>
      </div>
      
      <div style="margin-top: 25px; padding: 16px; background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 8px;">
        <p style="margin: 0; font-size: 13px;"><strong>ℹ️ SLA Information:</strong></p>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
          Most government departments respond within 7-30 days. You can follow up if no response after SLA period.
        </p>
      </div>
    </div>
  `;

  return roadmapHtml;
}

function displayRoadmap(result) {
  const roadmapHtml = buildComplaintRoadmap(result);
  const resultsPanel = document.getElementById("results-panel");
  if (resultsPanel) {
    resultsPanel.innerHTML = roadmapHtml;
    resultsPanel.style.display = "block";
    resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showLetterButton() {
  const letterBtn = document.getElementById("letterBtn");
  if (letterBtn) letterBtn.style.display = "inline-block";
}

// ============================================================================
// COMPLAINT LETTER GENERATION (UPDATED WITH OFFICE DATA & EMAIL)
// ============================================================================

const letterBtn = document.getElementById("letterBtn");
if (letterBtn) {
  letterBtn.addEventListener("click", async () => {
    // Check if analysis was done
    if (!analysisResult.category) {
      alert("⚠️ Please analyze a complaint first (click 'Deep Analyze & Resolve')");
      return;
    }

    // Load latest profile data from localStorage
    const savedProfile = localStorage.getItem("oc_local_profile");
    if (savedProfile) {
      authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, JSON.parse(savedProfile));
    }

    // Warn user if profile is empty
    if (!authenticatedCitizenProfile.name) {
      const confirmMsg = confirm("⚠️ Your profile is empty! Click OK to fill profile first, or Cancel to continue without profile details.");
      if (confirmMsg) {
        openProfileModal();
        return;
      }
    }

    const letterPanel = document.getElementById("letter-panel");
    if (letterPanel) {
      letterPanel.style.display = "block";
      const letterOutput = document.getElementById("letter-output");
      if (letterOutput) {
        letterOutput.innerHTML = `<div class="letter-loading"><div class="letter-spinner"></div><span>Generating official complaint letter with your details...</span></div>`;
      }
    }

    try {
      const letterPayload = {
        problem: analysisResult.problem,
        category: analysisResult.category,
        department: analysisResult.department,
        authority: analysisResult.authority,
        city: analysisResult.city,
        office: analysisResult.office,
        citizenName: authenticatedCitizenProfile.name || "Concerned Citizen",
        citizenEmail: authenticatedCitizenProfile.email || "Not Provided",
        citizenPhone: authenticatedCitizenProfile.phone || "Not Provided",
        citizenAddress: authenticatedCitizenProfile.address || "Not Provided",
        citizenCity: authenticatedCitizenProfile.city || "Not Provided",
        citizenPincode: authenticatedCitizenProfile.pincode || "Not Provided"
      };

      console.log("📤 Generating letter with:", letterPayload);

      const response = await fetch("https://onecomplaint.onrender.com/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(letterPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const letterContent = data.letter;

      const letterOutput = document.getElementById("letter-output");
      if (letterOutput) {
        letterOutput.innerText = letterContent;
      }

      if (letterPanel) {
        letterPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      showSuccessMessage("✅ Letter generated successfully!");

      // Show action buttons after generation
      showLetterActionButtons(letterContent);

    } catch (error) {
      console.error("❌ Error:", error);
      const letterOutput = document.getElementById("letter-output");
      if (letterOutput) {
        letterOutput.innerText = `Error: Could not generate letter. ${error.message}`;
      }
      alert("Error generating letter. Please try again.");
    }
  });
}

/**
 * Show action buttons after letter generation
 */
function showLetterActionButtons(letterContent) {
  let actionBtnsDiv = document.getElementById("letter-action-buttons");
  
  if (!actionBtnsDiv) {
    actionBtnsDiv = document.createElement("div");
    actionBtnsDiv.id = "letter-action-buttons";
    actionBtnsDiv.style.marginTop = "16px";
    actionBtnsDiv.style.display = "flex";
    actionBtnsDiv.style.gap = "10px";
    actionBtnsDiv.style.flexWrap = "wrap";
    
    const letterPanel = document.getElementById("letter-panel");
    if (letterPanel) {
      letterPanel.appendChild(actionBtnsDiv);
    }
  }

  actionBtnsDiv.innerHTML = `
    <button onclick="downloadLetterAsHTML()" class="download-btn" style="padding: 10px 20px; background: #059669; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
      📥 Download Letter
    </button>
    <button onclick="openGmailWithLetter()" class="email-btn" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
      📧 Send via Gmail
    </button>
    <button onclick="copyLetterToClipboard()" class="copy-btn" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
      📋 Copy to Clipboard
    </button>
  `;
}

/**
 * Download letter as HTML file
 */
function downloadLetterAsHTML() {
  const letterContent = document.getElementById("letter-output").innerText;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Complaint Letter</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
        h1 { color: #333; text-align: center; }
      </style>
    </head>
    <body>
      <pre style="white-space: pre-wrap; word-wrap: break-word;">${letterContent}</pre>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "complaint_letter.html";
  a.click();
  URL.revokeObjectURL(url);

  showSuccessMessage("✅ Letter downloaded as HTML. Use Ctrl+S to save as PDF in your browser.");
}

/**
 * Open Gmail with auto-filled letter (NEW - UPDATED)
 */
function openGmailWithLetter() {
  const letterContent = document.getElementById("letter-output").innerText;
  
  // Get office email from analysisResult
  const recipientEmail = analysisResult.office?.email || analysisResult.office?.email || "grievance@cpgrams.gov.in";
  const subject = `Complaint: ${analysisResult.category} - ${analysisResult.problem.substring(0, 50)}`;
  
  // Prepare body with letter content
  const body = letterContent;

  // Create mailto link
  const mailtoLink = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Open Gmail
  window.open(mailtoLink, "_blank");

  showSuccessMessage("✅ Email client opened with letter content. Review and send!");
}

/**
 * Copy letter to clipboard
 */
function copyLetterToClipboard() {
  const letterContent = document.getElementById("letter-output").innerText;
  navigator.clipboard.writeText(letterContent).then(() => {
    showSuccessMessage("✅ Letter copied to clipboard!");
  });
}

// ============================================================================
// MEDIA INPUT FUNCTIONS (EXISTING - VOICE, CAMERA, FILE)
// ============================================================================

const voiceBtn = document.getElementById("voiceBtn");
if (voiceBtn) {
  voiceBtn.addEventListener("click", async () => {
    try {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      const textarea = document.getElementById("complaint");
      let isListening = false;
      voiceBtn.classList.add("active-recording");
      voiceBtn.style.background = "#ef4444";

      recognition.onstart = () => {
        isListening = true;
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (event.results[event.results.length - 1].isFinal) {
          textarea.value += (textarea.value ? " " : "") + transcript;
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
      };

      recognition.onend = () => {
        isListening = false;
        voiceBtn.classList.remove("active-recording");
        voiceBtn.style.background = "";
      };

      recognition.start();
      setTimeout(() => recognition.stop(), 30000);
    } catch (error) {
      alert("Speech recognition not supported: " + error.message);
    }
  });
}

const cameraBtn = document.getElementById("cameraBtn");
if (cameraBtn) {
  cameraBtn.addEventListener("click", async () => {
    try {
      const cameraPreview = document.getElementById("camera-preview-window");
      if (cameraPreview) {
        cameraPreview.style.display = "block";

        const constraints = {
          video: {
            facingMode: { ideal: "environment" } // Rear camera (back)
          },
          audio: false
        };

        try {
          mediaStreamInstance = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
          console.warn("Rear camera failed, trying any camera:", error);
          mediaStreamInstance = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        const video = document.getElementById("webcam-video");
        if (video) {
          video.srcObject = mediaStreamInstance;
        }
      }
    } catch (error) {
      alert("Camera access denied: " + error.message);
    }
  });
}

function closeCamera() {
  if (mediaStreamInstance) {
    mediaStreamInstance.getTracks().forEach((track) => track.stop());
  }
  const cameraPreview = document.getElementById("camera-preview-window");
  if (cameraPreview) {
    cameraPreview.style.display = "none";
  }
}

const captureSnapshotBtn = document.getElementById("captureSnapshotBtn");
if (captureSnapshotBtn) {
  captureSnapshotBtn.addEventListener("click", () => {
    const video = document.getElementById("webcam-video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      attachedFiles.push(blob);
      addAttachmentPreview(blob);

      if (attachedFiles.length >= MAX_FILES) {
        closeCamera();
      }

      showSuccessMessage(`📷 Photo attached (${attachedFiles.length}/${MAX_FILES})`);
    });
  });
}

const fileBtn = document.getElementById("fileBtn");
if (fileBtn) {
  fileBtn.addEventListener("click", () => {
    const fileInput = document.getElementById("hiddenFileInput");
    if (fileInput) fileInput.click();
  });
}

const fileInput = document.getElementById("hiddenFileInput");
if (fileInput) {
  fileInput.addEventListener("change", (event) => {
    const files = event.target.files;
    if (files.length + attachedFiles.length > MAX_FILES) {
      alert(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    for (let file of files) {
      attachedFiles.push(file);
      addAttachmentPreview(file);
    }

    showSuccessMessage(`📎 ${files.length} file(s) attached`);
  });
}

function addAttachmentPreview(file) {
  const dock = document.getElementById("attachment-preview-dock");
  if (!dock) return;

  dock.style.display = "block";

  const preview = document.createElement("div");
  preview.style.cssText = "display:inline-block;margin:8px;position:relative;";

  if (file.type.startsWith("image")) {
    const img = document.createElement("img");
    img.style.cssText = "width:80px;height:80px;border-radius:8px;object-fit:cover;border:2px solid #ddd;";
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  } else {
    const label = document.createElement("div");
    label.style.cssText = "width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;border-radius:8px;font-size:12px;text-align:center;word-break:break-word;";
    label.textContent = file.name.substring(0, 15);
    preview.appendChild(label);
  }

  const removeBtn = document.createElement("button");
  removeBtn.style.cssText = "position:absolute;top:-5px;right:-5px;width:24px;height:24px;border-radius:50%;background:red;color:white;border:none;cursor:pointer;font-weight:bold;";
  removeBtn.textContent = "×";
  removeBtn.onclick = () => {
    const index = attachedFiles.indexOf(file);
    if (index > -1) attachedFiles.splice(index, 1);
    preview.remove();
    if (attachedFiles.length === 0) dock.style.display = "none";
  };

  preview.appendChild(removeBtn);
  dock.appendChild(preview);
}

// ============================================================================
// ARTICLE/WARD DIRECTORY (EXISTING - KEPT INTACT)
// ============================================================================

const articleDatabase = {
  rti: {
    title: "RTI (Right to Information) - How to File",
    category: "Transparency & Information Access",
    description: "Learn how to use RTI to request government information",
    content: `
## RTI Application Process

RTI (Right to Information) allows citizens to request any government information.

### Steps to File RTI:
1. Identify the correct Public Authority (ministry/department)
2. Write a letter clearly stating what information you need
3. Mention the section of RTI Act 2005
4. Pay the required fee (usually ₹10)
5. Submit to the Public Information Officer (PIO)
6. Follow up if no response within 30 days

### Key Government Portals:
- DOPT RTI Portal: https://dopt.gov.in/rti
- Ministry-specific RTI counters

### Important Rules:
- Maximum response time: 30 days (extendable to 45 days)
- Fees: ₹10 for copies
- Appeal available if denied

**Sample Email for RTI:**
\`\`\`
Dear [Public Information Officer],

I am writing to request the following information under RTI Act 2005:
[Clearly state what information you need]

Please provide the information within 30 days.

Regards,
[Your Name]
\`\`\`
    `,
    helpline: "📞 1800-180-1111",
    portal: "🌐 https://dopt.gov.in/rti",
    sla: "30 days (extendable to 45 days)"
  },

  sewage: {
    title: "Sewage & Drainage Issues",
    category: "Water & Sanitation",
    description: "Report clogged drains, overflowing sewage, or drainage problems",
    content: `
## Sewage & Drainage Complaint Process

### Issues You Can Report:
- Clogged or blocked drains
- Overflowing sewage
- Broken sewer pipes
- Foul smell from drainage
- Water stagnation

### Steps to Report:
1. Contact Municipal Corporation / Nagar Nigam
2. Provide location and photo of problem
3. Get complaint reference number
4. Follow up every 7 days if not resolved

### Important Contacts:
- **Delhi**: dmc-sewage@delhigovt.nic.in, Phone: 011-4141-4141
- **Mumbai**: sewage@municipal.maharashtra.gov.in
- **Bangalore**: drainage@bengaluru.gov.in

### SLA Timeline:
- Assessment: 2-3 days
- Cleaning/Repairs: 5-10 days
- Major repairs: 20-30 days

### Prevention Tips:
- Don't throw non-biodegradable items in drains
- Report early before it worsens
- Take photos/videos for evidence
    `,
    helpline: "📞 Municipal Corporation Hotline",
    portal: "🌐 Municipal Portal of Your City",
    sla: "5-10 days"
  },

  roads: {
    title: "Pothole & Road Damage",
    category: "Public Infrastructure",
    description: "Report damaged roads, potholes, and street damage",
    content: `
## Road Pothole Complaint Process

### What to Report:
- Potholes or broken asphalt
- Damaged road surface
- Missing street lamps
- Damaged road markings
- Uneven road surface

### How to File Complaint:
1. Take clear photo/video of the pothole
2. Note the exact location (street name, nearby landmark)
3. Contact Public Works Department (PWD)
4. File complaint online or visit office
5. Get complaint reference number

### Key Contacts:
- **Delhi PWD**: pwd-delhi@delhigovt.nic.in
- **Mumbai PWD**: roads-mumbai@maharashtra.gov.in
- **Bangalore PWD**: roads-bengaluru@karnataka.gov.in

### Expected Timeline:
- Assessment: 2 days
- Repair: 5-15 days (depending on severity)
- Large projects: 30+ days

### Do's:
✓ Take good quality photos
✓ Mention exact location
✓ Report immediately to prevent accidents
✓ Keep reference number for follow-up

### Don'ts:
✗ Don't block the pothole yourself
✗ Don't report same issue multiple times
✗ Don't damage road further
    `,
    helpline: "📞 PWD Helpline (City-specific)",
    portal: "🌐 State PWD Online Portal",
    sla: "5-15 days"
  },

  electricity: {
    title: "Electricity & Power Issues",
    category: "Utilities",
    description: "Report power outages, meter issues, and billing problems",
    content: `
## Electricity Complaint Process

### Types of Complaints:
- Power outages/blackouts
- Meter malfunction
- High billing
- Low voltage
- Damaged wires
- Bill disputes

### How to Complain:
1. Check online portal for outage status
2. Call electricity distributor hotline
3. Report via mobile app
4. Send complaint to email
5. Visit office for complex issues

### Contact Information:
- **Delhi**: support@delhidiscom.org, 24/7 Hotline: 19124
- **Mumbai**: complaint@mahagenco.in
- **Bangalore**: grievance@bescom.co.in

### SLA for Different Issues:
- Emergency (safety): 4-6 hours
- Power outage: 24-48 hours
- Billing dispute: 10-15 days
- Meter replacement: 5-10 days

### Document Needed:
- Consumer ID/Meter number
- Bill copy
- Photos of damaged equipment

### Important:
- Always report safety hazards (loose wires, sparks) immediately
- Save all bills for billing dispute cases
- Get acknowledgment receipt
    `,
    helpline: "📞 19124 (Delhi) / State-specific",
    portal: "🌐 DISCOM Mobile App",
    sla: "4-48 hours"
  },

  water: {
    title: "Water Supply Issues",
    category: "Water & Sanitation",
    description: "Report contaminated water, pipe breaks, and low pressure",
    content: `
## Water Supply Complaint Process

### Issues Covered:
- No water supply
- Low water pressure
- Contaminated water
- Broken water pipes
- Meter damage

### Steps to Report:
1. Check if supply is cut due to maintenance
2. Inform neighbors (check if issue is localized)
3. Contact water authority
4. Provide meter number and photo
5. Get complaint ID

### Government Contacts:
- **Delhi Jal Board**: jal-board@delhi.gov.in, 24/7: 1916
- **Mumbai Water**: water-supply@maharashtra.gov.in
- **Bangalore**: water-resources@bengaluru.gov.in

### Normal Response Time:
- Pipe breakage: 24-48 hours
- No supply: 48-72 hours
- Water quality complaint: 5-10 days
- Meter replacement: 7-15 days

### What to Provide:
- Consumer ID/Meter number
- Exact location
- Photos/videos of problem
- Date and time of issue
    `,
    helpline: "📞 1916 (Delhi) / City-specific",
    portal: "🌐 Jal Board Online Portal",
    sla: "24-72 hours"
  },

  waste: {
    title: "Waste Management & Garbage",
    category: "Sanitation",
    description: "Report garbage collection issues and waste management problems",
    content: `
## Garbage & Waste Management

### Issues to Report:
- Garbage not collected
- Overflowing bins
- Improper waste disposal
- Littering in public spaces
- Construction debris

### Filing Complaint:
1. Note exact location and photo
2. Check collection day for your area
3. Contact Municipal Solid Waste (MSW) dept
4. Use city mobile app
5. File email complaint

### Key Contacts:
- **Delhi SWM**: swm@delhigovt.nic.in, 1969
- **Mumbai**: waste-mgmt@maharashtra.gov.in
- **Bangalore**: waste@bengaluru.gov.in

### Response Timeline:
- Regular collection miss: 24 hours
- Overflowing bin: 12 hours
- Illegal dumping: 2-3 days

### Tips:
- Segregate waste (wet/dry)
- Put trash in designated bins
- Report during working hours
- Take reference number
    `,
    helpline: "📞 1969 (Delhi) / City-specific",
    portal: "🌐 Municipal Waste Portal",
    sla: "12-24 hours"
  },

  food_safety: {
    title: "Food Safety & FSSAI Complaints",
    category: "Food & Health",
    description: "Report unhygienic food preparation, adulteration, and expired products",
    content: `
## Food Safety Complaint (FSSAI)

### Issues Covered:
- Contaminated food
- Expired products
- Adulteration
- Unhygienic handling
- Unsafe restaurant practices

### How to Report:
1. Contact local Food Safety Officer
2. File complaint with FSSAI
3. Take photos of product/premise
4. Keep bill/receipt
5. Mention batch/expiry details

### Contacts:
- **FSSAI Helpline**: 18004255959 (toll-free)
- **Delhi**: delhi@fssai.gov.in
- **Online Portal**: https://www.fssai.gov.in/

### SLA:
- Initial inspection: 5-10 days
- Further action: 15-30 days
- Closure: 30-45 days

### Important:
- Keep original bill
- Preserve sample if possible
- Photo evidence helpful
- Don't consume suspicious food

### What Gets Action:
✓ Expired products
✓ Unsafe preparation
✓ Pest infestation
✓ Unhygienic conditions
✓ Labeling violations
    `,
    helpline: "📞 18004255959",
    portal: "🌐 https://www.fssai.gov.in/",
    sla: "5-15 days"
  },

  traffic: {
    title: "Traffic & Road Safety",
    category: "Traffic & Safety",
    description: "Report traffic violations, rash driving, and road safety issues",
    content: `
## Traffic & Road Safety Complaints

### Issues You Can Report:
- Traffic signal malfunction
- Rash/dangerous driving
- Vehicles parked illegally
- Traffic rule violations
- Damaged road signs

### How to Report:
1. Note vehicle number (if applicable)
2. Describe incident with location
3. Contact Traffic Police
4. Online complaint portal
5. Provide photos/video if available

### Contact Information:
- **Delhi Traffic**: traffic-delhi@delhipolice.gov.in, 100 (Emergency)
- **Mumbai**: traffic@maharashtra.police.gov.in
- **Bangalore**: traffic@bengaluru.police.gov.in

### Response Time:
- Emergency (accident): Immediate
- Traffic violation: 24-48 hours
- Signal repair: 3-5 days
- Enforcement action: 7-15 days

### Evidence Helpful:
- Photos/video of incident
- Vehicle registration number
- Witness contact details
- Time and date

### Note:
- Keep complaint reference
- Follow up if needed
- Don't interfere with traffic
    `,
    helpline: "📞 100 (Emergency) / City Traffic",
    portal: "🌐 City Police Portal",
    sla: "24-48 hours"
  },

  corruption: {
    title: "Anti-Corruption & Bribery",
    category: "Governance",
    description: "Report corruption, bribery, and unethical government conduct",
    content: `
## Anti-Corruption Complaint Process

### What Qualifies:
- Bribery demands
- Misuse of authority
- Embezzlement
- Nepotism
- Illegal extortion

### Safe Ways to Report:
1. **ACB (Anti-Corruption Bureau)** - Anonymous complaints
2. **CBI** - Federal-level cases
3. **CMS Portal** - Central Vigilance Commission
4. **Chief Secretary** - State-level

### Contacts:
- **ACB**: acb-delhi@delhigovt.nic.in
- **CBI**: https://www.cbi.gov.in/
- **CVC**: https://www.cvc.gov.in/

### Protection:
- Whistleblower Protection Act provides safety
- Anonymous complaints accepted
- Investigation kept confidential
- Protection from retaliation

### SLA:
- Initial assessment: 7-10 days
- Investigation: 30-90 days
- Action: Case-dependent

### Important:
- Collect evidence (documents, photos)
- Write detailed complaint
- Keep backup copies
- Don't confront accused
    `,
    helpline: "📞 ACB Toll-free (State-specific)",
    portal: "🌐 Anti-Corruption Bureau",
    sla: "7-10 days initial"
  }
};

function openArticle(key) {
  const article = articleDatabase[key];
  if (!article) return;

  const articlePage = document.getElementById("articlePage");
  if (!articlePage) return;

  // Push history state so back button works
  window.history.pushState({ article: key }, null, `#${key}`);

  const articleContent = document.getElementById("article-content");
  if (articleContent) {
    articleContent.innerHTML = `
      <div class="article-header">
        <h2>${article.title}</h2>
        <p class="article-category">${article.category}</p>
      </div>
      <div class="article-info-grid">
        <div class="info-box">
          <strong>📞 Helpline:</strong><br>${article.helpline}
        </div>
        <div class="info-box">
          <strong>🌐 Online Portal:</strong><br>${article.portal}
        </div>
        <div class="info-box">
          <strong>⏱️ Expected Timeline:</strong><br>${article.sla}
        </div>
      </div>
      <div class="article-body">${article.content}</div>
    `;
  }

  articlePage.style.display = "block";
  document.body.style.overflow = "hidden";
}

window.closeArticlePage = function() {
  const page = document.getElementById("articlePage");
  if (page) {
    page.style.display = "none";
    document.body.style.overflow = "auto";
  }
};

// Handle back button on article page
window.addEventListener("popstate", function(event) {
  const page = document.getElementById("articlePage");
  if (page && page.style.display !== "none") {
    closeArticlePage();
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showSuccessMessage(message) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    font-weight: 600;
    z-index: 9999;
    animation: slideUp 0.3s ease-in-out;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideDown 0.3s ease-in-out";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function resetComplaintForm() {
  const complaintText = document.getElementById("complaint");
  if (complaintText) complaintText.value = "";
  
  const dock = document.getElementById("attachment-preview-dock");
  if (dock) dock.style.display = "none";
  
  attachedFiles = [];
  analysisResult = {
    problem: "",
    category: "",
    city: "",
    area: "",
    pincode: "",
    department: "",
    authority: "",
    priority: "",
    office: null
  };

  const resultsPanel = document.getElementById("results-panel");
  if (resultsPanel) resultsPanel.style.display = "none";

  const letterPanel = document.getElementById("letter-panel");
  if (letterPanel) letterPanel.style.display = "none";

  const letterBtn = document.getElementById("letterBtn");
  if (letterBtn) letterBtn.style.display = "none";
}

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Load profile from localStorage
  const saved = JSON.parse(localStorage.getItem("oc_local_profile") || "{}");
  authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, saved);
  updateProfileIndicator();

  // Show location permission prompt once
  showLocationPrompt();

  // Setup location button listeners
  const requestLocationBtn = document.getElementById("request-location-btn");
  if (requestLocationBtn) {
    requestLocationBtn.addEventListener("click", () => {
      requestLocationPermission();
    });
  }

  const skipLocationBtn = document.getElementById("skip-location-btn");
  if (skipLocationBtn) {
    skipLocationBtn.addEventListener("click", () => {
      hideLocationPrompt();
      showSuccessMessage("📍 You can enable location anytime from settings.");
    });
  }

  // Setup hamburger menu
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  const navMenu = document.getElementById("navMenu");
  if (menuToggleBtn && navMenu) {
    menuToggleBtn.addEventListener("click", () => {
      navMenu.classList.toggle("active");
    });
  }

  // Update location badge on load
  updateLocationBadge();

  console.log("✅ OneComplaint application initialized");
});

// ============================================================================
// END OF SCRIPT
// ============================================================================