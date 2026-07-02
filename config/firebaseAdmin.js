console.log("firebaseAdmin.js loaded");
const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "firebase-service-account.json"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { admin, db };