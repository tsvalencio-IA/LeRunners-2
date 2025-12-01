/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-exchange
/* CORREÇÃO: Usa a Chave de Serviço para conectar Vercel -> Firebase
/* =================================================================== */

const admin = require("firebase-admin");
const axios = require("axios");

// Função para limpar a chave privada (bugs comuns da Vercel)
const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

// 1. Inicializa o Firebase com a Chave Mestra
if (admin.apps.length === 0) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.error("ERRO: Variável FIREBASE_SERVICE_ACCOUNT não encontrada.");
    } else {
        try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            
            // Corrige formatação da chave
            if (serviceAccount.private_key) {
                serviceAccount.private_key = formatPrivateKey(serviceAccount.private_key);
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com" // Teu URL do config.js
            });
            console.log("Firebase conectado com sucesso!");
        } catch (error) {
            console.error("ERRO ao ler a chave do Firebase:", error.message);
        }
    }
}

const db = admin.database();
const auth = admin.auth();

export default async function stravaExchangeHandler(req, res) {
    // 2. Cabeçalhos para permitir conexão (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: "Use POST" });

    try {
        // 3. Verifica quem está a chamar (Token do Usuário)
        const idToken = req.headers.authorization ? req.headers.authorization.split("Bearer ")[1] : null;
        if (!idToken) return res.status(401).json({ error: "Sem token de autorização." });

        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 4. Recebe o código do Strava
        const { code } = req.body;
        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        if (!code) return res.status(400).json({ error: "Código Strava não recebido." });

        // 5. Troca o código pelo Token Final no Strava
        const response = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientID,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        });

        // 6. Salva no Firebase
        await db.ref(`/users/${userId}/stravaAuth`).set({
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresAt: response.data.expires_at,
            athleteId: response.data.athlete.id,
            connectedAt: new Date().toISOString()
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro Final:", error.message);
        const detalhes = error.response ? error.response.data : error.message;
        return res.status(500).json({ error: "Erro interno", details: detalhes });
    }
}
