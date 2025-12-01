/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-exchange
/* CORREÇÃO FINAL: Sintaxe ESM (import) compatível com "type": "module"
/* =================================================================== */

import admin from "firebase-admin";
import axios from "axios";

// Função para formatar a chave privada
const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

export default async function handler(req, res) {
    // 1. Cabeçalhos CORS (Primeira coisa a fazer!)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Responde ao "preflight" do navegador
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. Inicialização do Firebase (Dentro do handler para capturar erros)
        if (admin.apps.length === 0) {
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                throw new Error("Variável FIREBASE_SERVICE_ACCOUNT não encontrada no Vercel.");
            }
            
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            
            if (serviceAccount.private_key) {
                serviceAccount.private_key = formatPrivateKey(serviceAccount.private_key);
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com"
            });
        }

        // 3. Validações e Lógica
        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Método não permitido. Use POST." });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Token de autorização ausente." });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Código Strava não recebido." });

        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        // 4. Troca de Token com o Strava
        const stravaResponse = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientID,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        });

        const stravaData = stravaResponse.data;

        // 5. Salvar no Firebase
        await admin.database().ref(`/users/${userId}/stravaAuth`).set({
            accessToken: stravaData.access_token,
            refreshToken: stravaData.refresh_token,
            expiresAt: stravaData.expires_at,
            athleteId: stravaData.athlete.id,
            connectedAt: new Date().toISOString()
        });

        return res.status(200).json({ success: true, message: "Conectado com sucesso!" });

    } catch (error) {
        console.error("ERRO BACKEND:", error);
        // Retorna o erro real para o navegador (ajuda a saber se é chave ou código)
        return res.status(500).json({ 
            error: "Erro interno no servidor", 
            details: error.message,
            stack: error.stack 
        });
    }
}
