// js/config.js
// COLE AQUI AS CHAVES DO PASSO 4 DA CONFIGURAÇÃO DO FIREBASE

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
// ATENÇÃO: Chave exposta. Use restrições de API no Google Cloud.
const GEMINI_API_KEY = "AIzaSyDuAA1HAwu4UlLUcqI5pla8nJn-Ue3esJg";

// --- Configuração do CLOUDINARY (MÓDULO 4 - Fotos) ---
// Crie uma conta no Cloudinary e um "Upload Preset"
const CLOUDINARY_CONFIG = {
  cloudName: "djtiaygrs",
  uploadPreset: "LeRunners"
};

// --- Configuração do STRAVA (Pública e URLs de Backend) ---
const STRAVA_PUBLIC_CONFIG = {
    // Client ID Público do Strava
    clientID: '185534', 
    // URL DE RETORNO (DEVE SER O SEU GITHUB PAGES)
    // Assumindo: https://tsvalencio-ia.github.io/LeRunners/app.html
    redirectURI: 'https://tsvalencio-ia.github.io/LeRunners/app.html', 
    // URL da API Vercel (Backend)
    vercelAPI: 'https://le-runners-2qp3qour8-thiaguinho-s-projects.vercel.app/api/strava-exchange'
};

// ===================================================================
// NOVO (V2.5): Disponibiliza as chaves globalmente para app.js
// ===================================================================
window.firebaseConfig = firebaseConfig;
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.STRAVA_PUBLIC_CONFIG = STRAVA_PUBLIC_CONFIG;
