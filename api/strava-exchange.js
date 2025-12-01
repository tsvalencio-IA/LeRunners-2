/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-exchange
/* CORREÇÃO: Leitura robusta da Chave de Serviço Firebase
/* =================================================================== */

const admin = require("firebase-admin");
const axios = require("axios");

// Função auxiliar para formatar a chave privada corretamente
const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

// --- INICIALIZAÇÃO DO FIREBASE ---
if (admin.apps.length === 0) {
    console.log("Inicializando Firebase...");
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            // Tenta ler a variável de ambiente configurada na Vercel
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            
            // Corrige a formatação da chave privada se necessário
            if (serviceAccount.private_key) {
                serviceAccount.private_key = formatPrivateKey(serviceAccount.private_key);
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com"
            });
            console.log("Sucesso: Firebase conectado via Service Account.");
        } catch (error) {
            console.error("ERRO CRÍTICO: Falha ao ler FIREBASE_SERVICE_ACCOUNT.", error.message);
        }
    } else {
        // Fallback para caso a variável não exista (vai dar erro, mas loga o motivo)
        console.error("ERRO: Variável de ambiente FIREBASE_SERVICE_ACCOUNT não encontrada.");
        admin.initializeApp({
            databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com"
        });
    }
}

const db = admin.database();
const auth = admin.auth();

export default async function stravaExchangeHandler(req, res) {
    // --- 1. CONFIGURAÇÃO DE CORS (Essencial para não dar erro de rede) ---
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Responde imediatamente a preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Método não permitido. Use POST." });
    }

    try {
        // --- 2. VALIDAÇÃO DO USUÁRIO ---
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new Error("Token de autorização ausente.");
        }
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // --- 3. TROCA DE TOKEN COM O STRAVA ---
        const { code } = req.body;
        if (!code) throw new Error("Código Strava não recebido.");

        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        if (!clientID || !clientSecret) {
            throw new Error("Configuração do servidor incompleta (Client ID/Secret ausentes).");
        }

        // Chamada oficial ao Strava
        const response = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientID,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        });

        const stravaData = response.data;

        // --- 4. SALVAR NO BANCO DE DADOS ---
        await db.ref(`/users/${userId}/stravaAuth`).set({
            accessToken: stravaData.access_token,
            refreshToken: stravaData.refresh_token,
            expiresAt: stravaData.expires_at,
            athleteId: stravaData.athlete.id,
            connectedAt: new Date().toISOString()
        });

        return res.status(200).json({ success: true, message: "Conectado com sucesso!" });

    } catch (error) {
        console.error("Erro na API:", error.message);
        // Retorna o erro detalhado para o frontend (ajuda no debug)
        const status = error.message.includes("Token") ? 401 : 500;
        return res.status(status).json({ 
            error: error.message,
            details: error.response ? error.response.data : null
        });
    }
}
