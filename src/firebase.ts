import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD86Q5jcqc4oSUL0bEFas-dP0cRO1GyAQU",
  authDomain: "orthodonticpatients-12c9a.firebaseapp.com",
  projectId: "orthodonticpatients-12c9a",
  storageBucket: "orthodonticpatients-12c9a.firebasestorage.app",
  messagingSenderId: "1049878169669",
  appId: "1:1049878169669:web:baa96cc05ade01c071bb2c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
