// js/config.js
// CONFIGURAÇÕES GLOBAIS - VERSÃO ATUALIZADA

const firebaseConfig = {
  apiKey: "AIzaSyDEfyw4v2UlVw85swueLoEnGjYY95xh2NI",
  authDomain: "lerunners-a6de2.firebaseapp.com",
  databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com",
  projectId: "lerunners-a6de2",
  storageBucket: "lerunners-a6de2.firebasestorage.app",
  messagingSenderId: "24483751716",
  appId: "1:24483751716:web:313b3013bd11c75e2eb5b1"
};

// --- Configuração da GOOGLE GEMINI API (MÓDULO 4 - IA) ---
const GEMINI_API_KEY = "AIzaSyDuAA1HAwu4UlLUcqI5pla8nJn-Ue3esJg";

// --- Configuração do CLOUDINARY (MÓDULO 4 - Fotos) ---
const CLOUDINARY_CONFIG = {
  cloudName: "djtiaygrs",
  uploadPreset: "LeRunners"
};

// --- Configuração do STRAVA (Pública e URLs de Backend) ---
const STRAVA_PUBLIC_CONFIG = {
    clientID: '185534', 
    
    // NOVO ENDEREÇO DO GITHUB PAGES (Para onde o Strava redireciona após login)
    redirectURI: 'https://tsvalencio-ia.github.io/LeRunners-2/app.html', 
    
    // URL FINAL DO VERCEL (Troca de código inicial)
    vercelAPI: 'https://le-runners2.vercel.app/api/strava-exchange',

    // NOVA URL: RENOVAÇÃO DE TOKEN (Refresh)
    vercelRefreshAPI: 'https://le-runners2.vercel.app/api/strava-refresh'
};

// ===================================================================
// EXPORTAÇÃO GLOBAL
// ===================================================================
window.firebaseConfig = firebaseConfig;
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.STRAVA_PUBLIC_CONFIG = STRAVA_PUBLIC_CONFIG;
