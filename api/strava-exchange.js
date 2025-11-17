/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-exchange
/* VERSÃO V1.2 (CORS FIX DEFINITIVO - Permissividade para Testes)
/* CORREÇÃO CRÍTICA: Definido Access-Control-Allow-Origin como '*' 
/* para garantir a passagem do CORS entre todos os domínios do Vercel e GitHub.
/* =================================================================== */

// Vercel Serverless Functions usam o padrão Node.js export default
const admin = require("firebase-admin");
const axios = require("axios");

// Inicializa o Firebase Admin SDK (Cloud Run/Vercel precisam disso)
if (admin.apps.length === 0) {
    admin.initializeApp({
        databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com"
    });
}

const db = admin.database();
const auth = admin.auth();
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

// ===================================================================
// NOVO: Função para aplicar o cabeçalho CORS (Permissivo para desenvolvimento)
// ===================================================================
function setCorsHeaders(res) {
    // Definimos como * para o desenvolvimento eliminar de vez o problema de CORS.
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function stravaExchangeHandler(req, res) {
    
    // 1. Aplica CORS (para todas as respostas)
    setCorsHeaders(res);
    
    // 2. Lida com a requisição OPTIONS (Preflight Request do CORS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Validação do Método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    // 4. Validação e autenticação do usuário (via Firebase ID Token)
    const idToken = req.headers.authorization ? req.headers.authorization.split("Bearer ")[1] : null;

    if (!idToken) {
        return res.status(401).json({ error: "Não autorizado. Token do Firebase ausente." });
    }

    let userId;
    try {
        // Verifica o token para obter o UID do usuário
        const decodedToken = await auth.verifyIdToken(idToken);
        userId = decodedToken.uid;
    } catch (error) {
        console.error("Erro na verificação do token Firebase:", error.message);
        return res.status(401).json({ error: "Token do Firebase inválido ou expirado." });
    }

    // 5. Pega o código do Strava e os Secrets (do Vercel Environment Variables)
    const code = req.body.code;
    const clientID = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!code || !clientID || !clientSecret) {
        return res.status(400).json({ error: "Código ou Secrets Vercel não fornecidos. Configure as Environment Variables." });
    }

    try {
        const params = {
            client_id: clientID,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        };

        // 6. Chamada à API do Strava
        const response = await axios.post(STRAVA_TOKEN_URL, params);
        const stravaData = response.data;

        const stravaAuthData = {
            accessToken: stravaData.access_token,
            refreshToken: stravaData.refresh_token,
            expiresAt: stravaData.expires_at,
            athleteId: stravaData.athlete.id,
            stravaAthleteData: stravaData.athlete
        };

        // 7. Salva os dados no Realtime Database
        const dbPath = `/users/${userId}/stravaAuth`;
        await db.ref(dbPath).set(stravaAuthData);

        return res.status(200).json({ success: true, message: "Strava conectado com sucesso!" });

    } catch (error) {
        const errorMessage = error.response ? error.response.data : error.message;
        console.error("Erro ao trocar token do Strava:", errorMessage);
        return res.status(500).json({
            error: "Falha ao contatar a API do Strava.",
            details: errorMessage
        });
    }
}
