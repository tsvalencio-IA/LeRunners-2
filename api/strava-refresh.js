/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-refresh
/* ARQUIVO NOVO (V1.0) - RENOVAÇÃO AUTOMÁTICA DE TOKEN
/* =================================================================== */

import admin from "firebase-admin";
import axios from "axios";

const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

export default async function handler(req, res) {
    // 1. CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. INICIALIZAÇÃO FIREBASE (Singleton)
        if (admin.apps.length === 0) {
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                throw new Error("ERRO CRÍTICO: Variável FIREBASE_SERVICE_ACCOUNT ausente.");
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

        // 3. VALIDAÇÃO E AUTH
        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Método não permitido. Use POST." });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Token de autorização ausente." });
        }

        // Verifica quem está chamando (Segurança)
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 4. BUSCA O REFRESH TOKEN NO BANCO
        const userRef = admin.database().ref(`/users/${userId}/stravaAuth`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            return res.status(404).json({ error: "Usuário não possui dados do Strava vinculados." });
        }

        const currentData = snapshot.val();
        const refreshToken = currentData.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({ error: "Refresh Token não encontrado no banco." });
        }

        // 5. SOLICITA NOVO TOKEN AO STRAVA
        // Usa as variáveis de ambiente do Vercel para segurança
        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        const stravaResponse = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientID,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken
        });

        const newData = stravaResponse.data;

        // 6. ATUALIZA O BANCO COM O NOVO TOKEN
        await userRef.update({
            accessToken: newData.access_token,
            refreshToken: newData.refresh_token, // Strava pode girar o refresh token também
            expiresAt: newData.expires_at,
            lastRefresh: new Date().toISOString()
        });

        // 7. RETORNO
        return res.status(200).json({ 
            success: true, 
            accessToken: newData.access_token,
            message: "Token renovado com sucesso!" 
        });

    } catch (error) {
        console.error("ERRO NO REFRESH:", error);
        return res.status(500).json({ 
            error: "Erro ao renovar token", 
            details: error.response?.data || error.message 
        });
    }
}
