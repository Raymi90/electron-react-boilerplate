const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json"); // Path to the service account key file

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://scrapper-data.firebaseio.com",
  });
} else {
  admin.app();
}

export const firestore = admin.firestore();
