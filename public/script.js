// ==========================================================================
// 1. UNIFIED FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDtkXEIHXJrHymHyVHe587-1y9vpMurgLY",
    authDomain: "onecomplaint-618c0.firebaseapp.com",
    projectId: "onecomplaint-618c0",
    storageBucket: "onecomplaint-618c0.firebasestorage.app",
    messagingSenderId: "622889046391",
    appId: "1:622889046391:web:9239f3ee3ec81d28775172"
};

let auth = null;
let confirmationResultObj = null;

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    auth.useDeviceLanguage(); 
} catch (error) {
    console.error("Firebase Crash:", error);
}

// ==========================================================================
// 2. EMAIL / PASSWORD MODAL LOGIC
// ==========================================================================
document.querySelector(".login").addEventListener("click", () => {
    const modal = document.getElementById("auth-modal");
    if(modal) modal.style.display = "flex";
});

let isLoginMode = true;
window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    document.getElementById("modalTitle").innerText = isLoginMode ? "Secure Login" : "Create Account";
    document.getElementById("authBtn").innerText = isLoginMode ? "Login" : "Sign Up";
    document.getElementById("toggleText").innerText = isLoginMode ? "Switch to Sign Up" : "Switch to Login";
};

document.getElementById("authBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        if(isLoginMode) await auth.signInWithEmailAndPassword(email, password);
        else await auth.createUserWithEmailAndPassword(email, password);
        alert("Success! Authenticated.");
        document.getElementById("auth-modal").style.display = "none";
    } catch(e) { alert(e.message); }
});

// ==========================================================================
// 3. PRELOADER & GLOBAL VARIABLES
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
    const preloader = document.getElementById("app-preloader");
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = "0";
            setTimeout(() => { preloader.style.display = "none"; }, 400);
        }, 500);
    }
});

let analysisResult = {};
let trackingCoordinates = { latitude: null, longitude: null };
let mediaStreamInstance = null;
let attachedImagesBase64 = []; 
let authenticatedCitizenProfile = { name: "", email: "", phone: "", address: "", city: "", pincode: "" };

// ==========================================================================
// 4. REAL SMS AUTHENTICATION LOGIC (LOGIN & SIGNUP UNIFIED)
// ==========================================================================
window.addEventListener("load", () => {
    // Geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                trackingCoordinates.latitude = pos.coords.latitude;
                trackingCoordinates.longitude = pos.coords.longitude;
                const geoBadge = document.getElementById("geo-badge-text");
                const headerBadge = document.getElementById("header-location-badge");
                if(geoBadge) geoBadge.innerText = "Location Synced";
                if(headerBadge) { headerBadge.style.background = "#f0fff4"; headerBadge.style.color = "#2f855a"; headerBadge.style.borderColor = "#2f855a"; }
            },
            (err) => { const geoBadge = document.getElementById("geo-badge-text"); if(geoBadge) geoBadge.innerText = "Location Denied"; },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }

    setTimeout(() => {
        if (auth) {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    authenticatedCitizenProfile.phone = user.phoneNumber;
                    loadProfileFromMemory();
                } else {
                    openAuthModal();
                }
            });
        } else {
            openAuthModal();
        }
    }, 1500); 
});

function openAuthModal() { const m = document.getElementById("auth-gateway-modal"); if(m) { m.classList.remove("hidden"); m.style.display = "flex"; document.body.style.overflow = "hidden"; } }
window.closeAuthModal = function() { const m = document.getElementById("auth-gateway-modal"); if(m) { m.classList.add("hidden"); m.style.display = "none"; document.body.style.overflow = "auto"; } }

window.toggleAuthTabs = function(target) {
    document.getElementById("tab-login-btn").classList.toggle("active", target === "login");
    document.getElementById("tab-signup-btn").classList.toggle("active", target === "signup");
    document.getElementById("login-form-block").style.display = target === "login" ? "block" : "none";
    document.getElementById("signup-form-block").style.display = target === "signup" ? "block" : "none";
}

// Auto-injects the invisible security container required by Google
function initRecaptcha() {
    if (!document.getElementById('recaptcha-container')) {
        const rc = document.createElement('div');
        rc.id = 'recaptcha-container';
        document.body.appendChild(rc);
    }
    if (!window.recaptchaVerifier && auth) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible'
        });
    }
}

// Master function to handle BOTH Login and Signup SMS
function sendFirebaseSMS(type) {
    if(!auth) return alert("Error: Firebase is not connected.");
    
    let phone = "";
    let btnId = "";
    let verifyBtnId = "";
    let groupBoxId = "";

    if (type === "signup") {
        const name = document.getElementById("reg-name").value.trim();
        phone = document.getElementById("reg-phone").value.trim();
        if (!name || !phone) return alert("Name and Phone Number are required.");
        
        authenticatedCitizenProfile.name = name;
        authenticatedCitizenProfile.email = document.getElementById("reg-email").value.trim();
        authenticatedCitizenProfile.address = document.getElementById("reg-address").value.trim();
        authenticatedCitizenProfile.city = document.getElementById("reg-city").value.trim();
        authenticatedCitizenProfile.pincode = document.getElementById("reg-pincode").value.trim();
        localStorage.setItem("oc_local_profile", JSON.stringify(authenticatedCitizenProfile));

        btnId = "requestSignupOtpBtn";
        verifyBtnId = "verifySignupOtpBtn";
        groupBoxId = "signup-otp-group";
    } else {
        phone = document.getElementById("login-identifier").value.trim();
        if (!phone) return alert("Please enter your Phone Number.");
        btnId = "requestLoginOtpBtn";
        verifyBtnId = "verifyLoginOtpBtn";
        groupBoxId = "login-otp-group";
    }

    if (!phone.startsWith("+")) { phone = "+91" + phone; }

    const btn = document.getElementById(btnId);
    btn.innerText = "Sending SMS..."; btn.disabled = true;

    initRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    auth.signInWithPhoneNumber(phone, appVerifier)
        .then((confirmationResult) => {
            window.confirmationResultObj = confirmationResult;
            document.getElementById(groupBoxId).style.display = "block";
            btn.style.display = "none";
            document.getElementById(verifyBtnId).style.display = "block";
            alert("Success! A 6-digit code has been sent to " + phone);
        }).catch((error) => {
            alert("Error sending SMS: " + error.message);
            btn.innerText = type === "signup" ? "Register & Send OTP" : "Send Verification Code"; 
            btn.disabled = false;
            if(window.recaptchaVerifier) window.recaptchaVerifier.render().then((widgetId) => { grecaptcha.reset(widgetId); });
        });
}

function verifyFirebaseSMS(inputId, btnId) {
    if(!window.confirmationResultObj) return alert("Error: No active SMS session found.");
    const code = document.getElementById(inputId).value.trim();
    const btn = document.getElementById(btnId);
    btn.innerText = "Verifying..."; btn.disabled = true;

    window.confirmationResultObj.confirm(code).then((result) => {
        alert("Authentication Successful! Identity verified.");
        closeAuthModal();
        loadProfileFromMemory();
    }).catch((error) => {
        alert("Invalid OTP Code. Please check your SMS and try again.");
        btn.innerText = "Verify & Enter"; btn.disabled = false;
    });
}

window.requestSignupOTP = function() { sendFirebaseSMS("signup"); }
window.requestLoginOTP = function() { sendFirebaseSMS("login"); }
window.verifySignupOTP = function() { verifyFirebaseSMS("reg-otp-code", "verifySignupOtpBtn"); }
window.verifyLoginOTP = function() { verifyFirebaseSMS("login-otp-code", "verifyLoginOtpBtn"); }

function loadProfileFromMemory() {
    const savedProfile = localStorage.getItem("oc_local_profile");
    if(savedProfile) { authenticatedCitizenProfile = Object.assign(authenticatedCitizenProfile, JSON.parse(savedProfile)); }
    
    const displayName = authenticatedCitizenProfile.name ? authenticatedCitizenProfile.name.split(" ")[0] : "Citizen";
    const profileIndicator = document.getElementById("profile-indicator-name");
    if(profileIndicator) profileIndicator.innerText = `👤 ${displayName}`;
    
    const authBtn = document.getElementById("authPortalNavBtn");
    if(authBtn) {
        authBtn.innerText = "Logout";
        authBtn.onclick = () => { if(auth) auth.signOut().then(() => { localStorage.clear(); location.reload(); }); };
    }
}

// ==========================================================================
// 5. HARDWARE APIS (MIC & MULTI-IMAGE UPLOAD)
// ==========================================================================
try {
    const AudioTranscriber = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (AudioTranscriber) {
        const transcriber = new AudioTranscriber();
        transcriber.continuous = false; transcriber.lang = 'en-IN';

        const voiceBtn = document.getElementById("voiceBtn");
        if(voiceBtn) {
            voiceBtn.addEventListener("click", () => {
                if (voiceBtn.classList.contains("active-recording")) { transcriber.stop(); } 
                else { voiceBtn.classList.add("active-recording"); transcriber.start(); }
            });
        }
        transcriber.onresult = (e) => {
            const txt = document.getElementById("complaint");
            if(txt) txt.value = txt.value ? txt.value.trim() + " " + e.results[0][0].transcript : e.results[0][0].transcript;
        };
        transcriber.onend = () => { if(voiceBtn) voiceBtn.classList.remove("active-recording"); }
        transcriber.onerror = () => { if(voiceBtn) voiceBtn.classList.remove("active-recording"); }
    }
} catch(e) {}

function renderThumbnails() {
    const dock = document.getElementById("attachment-preview-dock");
    const warning = document.getElementById("media-limit-warning");
    if(!dock) return;
    dock.innerHTML = "";
    
    if(attachedImagesBase64.length > 0) {
        dock.classList.remove("hidden"); dock.style.display = "flex";
        attachedImagesBase64.forEach((base64, index) => {
            dock.innerHTML += `<div class="thumbnail-wrapper animate-fade-up"><img src="${base64}" class="preview-thumbnail-img" style="width:65px; height:65px; object-fit:cover; border-radius:10px;"><span class="remove-thumbnail-badge" onclick="removeImage(${index})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; padding:2px 6px; cursor:pointer;">&times;</span></div>`;
        });
    } else {
        dock.classList.add("hidden"); dock.style.display = "none";
    }
    if(warning) warning.style.display = attachedImagesBase64.length >= 3 ? "block" : "none";
}

window.removeImage = function(index) { attachedImagesBase64.splice(index, 1); renderThumbnails(); }

const fileBtn = document.getElementById("fileBtn");
const hiddenFileInput = document.getElementById("hiddenFileInput");
if(fileBtn && hiddenFileInput) {
    fileBtn.addEventListener("click", () => hiddenFileInput.click());
    hiddenFileInput.addEventListener("change", (e) => {
        Array.from(e.target.files).forEach(file => {
            if(attachedImagesBase64.length >= 3) return;
            const reader = new FileReader();
            reader.onload = (event) => { attachedImagesBase64.push(event.target.result); renderThumbnails(); };
            reader.readAsDataURL(file);
        });
    });
}

const cameraBtn = document.getElementById("cameraBtn");
if(cameraBtn) {
    cameraBtn.addEventListener("click", async () => {
        if(attachedImagesBase64.length >= 3) return alert("Maximum 3 files reached.");
        const frame = document.getElementById("camera-preview-window");
        const video = document.getElementById("webcam-video");
        if (!frame.classList.contains("hidden")) { closeCamera(); return; }
        try {
            mediaStreamInstance = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = mediaStreamInstance; 
            frame.classList.remove("hidden"); frame.style.display = "block";
        } catch (err) { alert("Camera access denied."); }
    });
}

const captureBtn = document.getElementById("captureSnapshotBtn");
if(captureBtn) {
    captureBtn.addEventListener("click", () => {
        if(attachedImagesBase64.length >= 3) return;
        const video = document.getElementById("webcam-video");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        attachedImagesBase64.push(canvas.toDataURL("image/jpeg"));
        renderThumbnails();
        closeCamera();
    });
}

window.closeCamera = function() {
    if (mediaStreamInstance) mediaStreamInstance.getTracks().forEach(t => t.stop());
    const frame = document.getElementById("camera-preview-window");
    if(frame) { frame.classList.add("hidden"); frame.style.display = "none"; }
}

// ==========================================================================
// 6. ANALYZE & DISPATCH
// ==========================================================================
const analyzeBtn = document.getElementById("analyzeBtn");
if(analyzeBtn) {
    analyzeBtn.addEventListener("click", async () => {
        const complaint = document.getElementById("complaint").value.trim();
        if (!complaint) return alert("Write your problem description first.");

        analyzeBtn.innerText = "Deep Analyzing..."; analyzeBtn.disabled = true;

        try {
            const res = await fetch("/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ complaint, images: attachedImagesBase64 })
            });
            const d = await res.json();
            analysisResult = d.result;

            const solutionDesk = document.getElementById("solution-desk");
            solutionDesk.classList.remove("hidden"); solutionDesk.style.display = "block";

            document.getElementById("meta-indicators").innerHTML = `
                <div class="insight-item" style="padding:10px; border-bottom:1px solid #eee;"><strong>📌 Category:</strong> <span style="background:#e3f2fd; color:#0d47a1; padding:4px 8px; border-radius:10px; font-size:12px; float:right;">${analysisResult.category || 'Public Infrastructure'}</span></div>
                <div class="insight-item" style="padding:10px; border-bottom:1px solid #eee;"><strong>🏢 Dept:</strong> <span style="float:right; text-align:right;">${analysisResult.department || 'Municipal Corp / PWD'}</span></div>
                <div class="insight-item" style="padding:10px; border-bottom:1px solid #eee;"><strong>👤 Desk:</strong> <span style="float:right; text-align:right;">${analysisResult.authority || 'Zonal Executive Engineer'}</span></div>
                <div class="insight-item" style="padding:10px;"><strong>⚖️ Law:</strong> <span style="float:right; text-align:right;">${analysisResult.law || 'Section 323 State Municipal Act'}</span></div>
            `;
            solutionDesk.scrollIntoView({ behavior: 'smooth' });
        } catch (e) { alert("AI Backend Processing Issue. Make sure your server.js is running."); }
        finally { analyzeBtn.innerText = "Deep Analyze & Resolve"; analyzeBtn.disabled = false; }
    });
}

const letterBtn = document.getElementById("letterBtn");
if(letterBtn) {
    letterBtn.addEventListener("click", async () => {
        const letterPanel = document.getElementById("letter-panel");
        letterPanel.classList.remove("hidden"); letterPanel.style.display = "block";
        document.getElementById("letter-output").innerText = "Generating heavy legal draft...";

        try {
            const res = await fetch("/generate-letter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(analysisResult)
            });
            const d = await res.json();
            document.getElementById("letter-output").innerText = d.letter;
            letterPanel.scrollIntoView({ behavior: 'smooth' });
        } catch (e) { document.getElementById("letter-output").innerText = "Error connecting to AI. Using default template...\n\nTo Whom it may concern,\nThis is an official public grievance regarding infrastructure failure at " + (authenticatedCitizenProfile.address || "my residence") + ".\n\nPlease resolve immediately."; }
    });
}

// ==========================================================================
// 7. BULLETPROOF NATIVE PDF ENGINE (OPENS PRINT WINDOW)
// ==========================================================================
const pdfBtn = document.getElementById("pdfBtn");
if(pdfBtn) {
    pdfBtn.addEventListener("click", () => {
        const textData = document.getElementById("letter-output").innerText;
        if (!textData || textData.trim() === "") return alert("No draft to download.");

        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Please allow pop-ups to generate PDF.");

        const formattedText = textData.replace(/\n/g, "<br>");
        const printHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>OneComplaint_Legal_Draft</title>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; color: #000 !important; background: #fff !important; line-height: 1.6; font-size: 15px; }
                    .header { border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
                    .header h2 { margin: 0 0 10px 0; font-family: Arial, sans-serif; }
                    .header p { margin: 5px 0; font-weight: bold; font-family: Arial, sans-serif; }
                    @media print { @page { margin: 20mm; } body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>ONECOMPLAINT CITIZEN RECORD</h2>
                    <p>Filed By: ${authenticatedCitizenProfile.name || 'Citizen'}</p>
                    <p>Phone: ${authenticatedCitizenProfile.phone || 'N/A'}</p>
                    <p>Address: ${authenticatedCitizenProfile.address || 'N/A'} - ${authenticatedCitizenProfile.pincode || ''}</p>
                    <p>Date: ${new Date().toLocaleDateString()}</p>
                </div>
                <div>${formattedText}</div>
                <script> window.onload = function() { window.focus(); window.print(); }; </script>
            </body>
            </html>
        `;

        printWindow.document.write(printHTML);
        printWindow.document.close();
        setTimeout(returnToHomeState, 1000);
    });
}

const gmailBtn = document.getElementById("gmailBtn");
if(gmailBtn) {
    gmailBtn.addEventListener("click", () => {
        const textData = document.getElementById("letter-output").innerText;
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=grievance@gov.in&su=Official Complaint&body=${encodeURIComponent(textData)}`);
        returnToHomeState(); 
    });
}

function returnToHomeState() {
    document.getElementById("complaint").value = "";
    attachedImagesBase64 = [];
    renderThumbnails();
    document.getElementById("solution-desk").classList.add("hidden"); document.getElementById("solution-desk").style.display = "none";
    document.getElementById("letter-panel").classList.add("hidden"); document.getElementById("letter-panel").style.display = "none";
    document.getElementById("home").scrollIntoView({ behavior: 'smooth' });
}

const showMoreSlaBtn = document.getElementById("show-more-sla-btn");
if(showMoreSlaBtn) {
    showMoreSlaBtn.addEventListener("click", function() {
        const hiddenRows = document.querySelectorAll('.sla-extra-row');
        if(hiddenRows.length === 0) return;
        let isCurrentlyHidden = hiddenRows[0].style.display === "none" || hiddenRows[0].classList.contains("hidden");
        hiddenRows.forEach(row => {
            if (isCurrentlyHidden) { row.style.display = "table-row"; row.classList.remove("hidden"); } 
            else { row.style.display = "none"; row.classList.add("hidden"); }
        });
        this.innerText = isCurrentlyHidden ? "Hide Extra Timelines ⬆" : "View All 20 Statutory Timelines ⬇";
    });
}

// ==========================================================================
// 8. DEEP WARD DIRECTORY
// ==========================================================================
const articleDatabase = {
    rti: { title: "Right to Information (RTI) Master Guide", dept: "Central/State Information Commission", helpline: "011-24636791", website: "https://rtionline.gov.in", steps: "1. Identify the Exact Public Authority (PIO).\n2. Draft a specific question without asking 'Why'. Ask 'How much', 'When', 'Copy of document'.\n3. Attach a Rs.10 Postal Order or pay online.\n4. Wait 30 Days. If no reply, file First Appeal.", template: "To,\nThe Public Information Officer (PIO),\n\nSubject: Information Required Under RTI Act 2005\n\nPlease provide certified copies of the following:\n1. The budget allocated for road repair in Ward XX.\n2. The contractor name.\n\nRegards,\n[Your Name]" },
    sewage: { title: "Sewage & Mainline Overflow", dept: "Sanitation / Water Board", helpline: "1916 / 155305", website: "Local Municipal Portal", steps: "1. Photograph the exact manhole or drain.\n2. Note the lane/pole number closest to it.\n3. Call 1916 to log a ticket.", template: "To,\nThe Zonal Sanitation Engineer,\n\nSubject: 24-Hr Urgent Mainline Sewage Overflow Redressal\n\nOur lane is experiencing severe sewage backflow causing a massive health hazard. We demand immediate suction pump deployment.\n\nRegards,\n[Your Name]" },
    roads: { title: "Pothole & Asphalt Road Damage", dept: "Public Works Department (PWD)", helpline: "1073", website: "https://pwd.delhi.gov.in", steps: "1. Take wide-angle photos showing the pothole depth.\n2. Check if the road is PWD, NHAI, or Municipal.\n3. Demand contractor penalty invocation.", template: "To,\nThe Assistant Engineer (Civil),\n\nSubject: Defective Road Maintenance - Risk of Commuting Hazard\n\nPlease dispatch a patching team to repair deep potholes on [Street Name].\n\nRegards,\n[Your Name]" },
    electricity: { title: "Electricity & Grid Failure", dept: "State Electricity Board", helpline: "19122", website: "State Discom App", steps: "1. Note transformer number.\n2. Call 19122.\n3. Log online ticket.", template: "To the AE (Electrical)... We request urgent restoration of grid power." },
    waste: { title: "Illegal Garbage Dumping", dept: "Solid Waste Management Wing", helpline: "155304", website: "Swachhata App", steps: "1. Record dumping times.\n2. Note truck numbers.\n3. Complain to Sanitary Inspector.", template: "To the Chief Sanitary Inspector... Please issue challans for illegal debris dumping." },
    food: { title: "FSSAI Food Adulteration", dept: "Food Safety Standards Authority", helpline: "1800-11-2100", website: "https://foscos.fssai.gov.in", steps: "1. Keep invoice.\n2. Take photo of batch/expiry date.", template: "To the Food Safety Officer... Complaint against sale of expired goods." },
    traffic: { title: "Traffic & Encroachment", dept: "City Traffic Police", helpline: "1095", website: "Traffic Police Portal", steps: "1. Take photo of blocking vehicles.\n2. Note license plates.\n3. Request towing.", template: "To the Circle Inspector... Requesting immediate removal of commercial encroachment blocking traffic." },
    scam: { title: "Cyber Fraud & Scams", dept: "Cyber Crime Cell", helpline: "1930", website: "https://cybercrime.gov.in", steps: "1. Call 1930 immediately.\n2. Block bank account.\n3. Note transaction hash.", template: "To the Cyber Cell In-Charge... Request immediate freezing of nodal accounts for unauthorized withdrawal." },
    water: { title: "Water Supply Cut", dept: "Zonal Water Distribution", helpline: "1916", website: "Local Jal Board", steps: "1. Check neighbors' supply.\n2. Call 1916.", template: "To the AE (Water)... Urgent request to investigate contaminated drinking water supply." },
    animals: { title: "Stray Animal Management", dept: "Veterinary Cell", helpline: "Animal Control", website: "Municipal Portal", steps: "1. Note aggressive pack locations.\n2. Contact NGOs / Vet Cell.", template: "To the Zonal Veterinary Officer... Requesting humane catch, vaccinate, and release operations." },
    corruption: { title: "Anti-Corruption & Bribery", dept: "Vigilance Bureau / ACB", helpline: "1064", website: "State Vigilance Portal", steps: "1. Refuse bribe.\n2. Record audio covertly (if legal).", template: "To the Director of Vigilance... Reporting unlawful demands for file processing." },
    noise: { title: "Noise Pollution (Loudspeakers)", dept: "Police Control Room", helpline: "112", website: "N/A", steps: "1. Note time past 10 PM.\n2. Use decibel app.", template: "To the SHO... Requesting enforcement of noise zoning laws." },
    encroachment: { title: "Illegal Encroachment", dept: "Municipal Building Dept", helpline: "155305", website: "Municipal Portal", steps: "1. Take photos of permanent structures on public land.", template: "To the Zonal Inspector... Reporting unauthorized permanent construction on public pathways." },
    parks: { title: "Park Maintenance", dept: "Horticulture Department", helpline: "Local Ward App", website: "Municipal Portal", steps: "1. List broken swings/fences.\n2. Request funds.", template: "To the Landscape Superintendent... Request for immediate repair of broken park fences." },
    mosquito: { title: "Mosquito Fogging", dept: "Health Dept", helpline: "155305", website: "Municipal App", steps: "1. Note stagnant water locations.", template: "To the Chief Medical Officer... Urgent request for dengue fogging in residential sector." }
};

window.openArticle = function(key) {
    const art = articleDatabase[key];
    if (!art) return;
    document.getElementById("page-content-target").innerHTML = `
        <h2 style="color: #0b3d91; margin-bottom: 10px; font-size: 26px;">${art.title}</h2>
        <div style="background: #eef5ff; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
            <p style="font-size: 14px; margin-bottom: 5px;"><strong>🏢 Mandated Agency:</strong> ${art.dept}</p>
            <p style="font-size: 14px; margin-bottom: 5px;"><strong>☎️ Official Helpline:</strong> <a href="tel:${art.helpline}" style="color:#e53e3e; font-weight:bold;">${art.helpline}</a></p>
            <p style="font-size: 14px;"><strong>🌐 Official Portal:</strong> <a href="${art.website}" target="_blank" style="color:#0b3d91; text-decoration:underline;">${art.website}</a></p>
        </div>
        <h3 style="color: #102a43; margin-bottom: 10px;">🗺️ Step-by-Step Resolution Roadmap</h3>
        <p style="white-space: pre-wrap; margin-bottom: 25px; line-height: 1.6; font-size: 15px; color:#486581;">${art.steps}</p>
        <h3 style="color: #102a43; margin-bottom: 10px;">✉️ Application Blueprint</h3>
        <div style="white-space: pre-wrap; font-family: monospace; background: #f0f4f8; padding: 20px; border-radius: 8px; border-left: 4px solid #0b3d91;">${art.template}</div>
    `;
    const page = document.getElementById("articlePage");
    page.classList.remove("hidden"); page.style.display = "block";
    document.body.style.overflow = "hidden";
}

window.closeArticlePage = function() { 
    const page = document.getElementById("articlePage");
    page.classList.add("hidden"); page.style.display = "none";
    document.body.style.overflow = "auto"; 
}

window.addEventListener("DOMContentLoaded", () => {
    const menuBtn = document.getElementById("menuToggleBtn");
    if(menuBtn) {
        menuBtn.addEventListener("click", () => { document.getElementById("navMenu").classList.toggle("mobile-active"); });
    }
});
