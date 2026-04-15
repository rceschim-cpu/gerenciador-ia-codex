import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBY9ZH0Nc0XUII9b1LxsWHQ-1ANVWwn_jw",
  authDomain: "gerenciador-ia.firebaseapp.com",
  projectId: "gerenciador-ia",
  storageBucket: "gerenciador-ia.firebasestorage.app",
  messagingSenderId: "444462695655",
  appId: "1:444462695655:web:ee2fb2dd4612daab760e42"
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// App secundário para criar usuários sem deslogar o admin
export const secondaryApp = initializeApp(firebaseConfig, 'secondary')
export const secondaryAuth = getAuth(secondaryApp)
