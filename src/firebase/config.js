// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCjSYjGZLZAzOROrK7SXYXcPt4qS7RtqF4",
  authDomain: "scrapper-data-fc1eb.firebaseapp.com",
  projectId: "scrapper-data-fc1eb",
  storageBucket: "scrapper-data-fc1eb.appspot.com",
  messagingSenderId: "541182393949",
  appId: "1:541182393949:web:a3d40caa8c9e836611d7b4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
