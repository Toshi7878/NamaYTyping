import { type FirebaseOptions, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAr4-fcnf0Qvpujm3j_L8pdY9M8VI9HB4g",
  authDomain: "namaytyping.firebaseapp.com",
  projectId: "namaytyping",
  storageBucket: "namaytyping.firebasestorage.app",
  messagingSenderId: "75847555112",
  appId: "1:75847555112:web:65d775a59593d938eb3d1d",
  measurementId: "G-Q9DW7CJHM4",
} satisfies FirebaseOptions;

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const db = getFirestore(app);
