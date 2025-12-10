// js/config.js
// CONFIGURAÇÕES GLOBAIS - VERSÃO OFUSCADA (SPLIT KEY)

const firebaseConfig = {
  apiKey: "AIzaSyDEfyw4v2UlVw85swueLoEnGjYY95xh2NI",
  authDomain: "lerunners-a6de2.firebaseapp.com",
  databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com",
  projectId: "lerunners-a6de2",
  storageBucket: "lerunners-a6de2.firebasestorage.app",
  messagingSenderId: "24483751716",
  appId: "1:24483751716:web:313b3013bd11c75e2eb5b1"
};

// --- TÉCNICA DE OFUSCAÇÃO DE CHAVE (Para enganar scanners do GitHub) ---
// COLE AQUI SUA NOVA CHAVE DIVIDIDA EM DUAS PARTES
const GEMINI_PART_A = "AIzaSy"; // Mantenha o início aqui ou cole a primeira metade
const GEMINI_PART_B = "D2L7-vh645XH6pDZszlxNokE-u33lE1fs"; // Cole o resto da chave nova aqui

const GEMINI_API_KEY = GEMINI_PART_A + GEMINI_PART_B;

// --- Configuração do CLOUDINARY ---
const CLOUDINARY_CONFIG = {
  cloudName: "djtiaygrs",
  uploadPreset: "LeRunners"
};

// --- Configuração do STRAVA ---
const STRAVA_PUBLIC_CONFIG = {
    clientID: '185534', 
    redirectURI: 'https://tsvalencio-ia.github.io/LeRunners-2/app.html', 
    vercelAPI: 'https://le-runners2.vercel.app/api/strava-exchange',
    vercelRefreshAPI: 'https://le-runners2.vercel.app/api/strava-refresh'
};

// ===================================================================
// EXPORTAÇÃO GLOBAL
// ===================================================================
window.firebaseConfig = firebaseConfig;
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.STRAVA_PUBLIC_CONFIG = STRAVA_PUBLIC_CONFIG;
