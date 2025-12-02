/* =================================================================== */
/* VERCEL SERVERLESS FUNCTION: /api/strava-exchange
/* ARQUIVO COMPLETO V3.0 (Com Suporte a Refresh Token)
/* =================================================================== */

import admin from "firebase-admin";
import axios from "axios";

// Formata chave privada
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
        // 2. INICIALIZAÇÃO FIREBASE
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

        // 3. VALIDAÇÃO BÁSICA
        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Método não permitido." });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Token de autorização ausente." });
        }

        // 4. VERIFICAÇÃO DO USUÁRIO
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 5. LÓGICA DE TROCA (CODE ou REFRESH_TOKEN)
        const { code, refresh_token } = req.body;
        
        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        if (!clientID || !clientSecret) {
            throw new Error("Credenciais Strava ausentes na Vercel.");
        }

        let stravaResponse;
        
        // CENÁRIO A: Troca inicial (Authorization Code)
        if (code) {
            stravaResponse = await axios.post("https://www.strava.com/oauth/token", {
                client_id: clientID,
                client_secret: clientSecret,
                code: code,
                grant_type: "authorization_code",
            });
        } 
        // CENÁRIO B: Renovação (Refresh Token)
        else if (refresh_token) {
            stravaResponse = await axios.post("https://www.strava.com/oauth/token", {
                client_id: clientID,
                client_secret: clientSecret,
                refresh_token: refresh_token,
                grant_type: "refresh_token",
            });
        } else {
            return res.status(400).json({ error: "Nem 'code' nem 'refresh_token' fornecidos." });
        }

        const stravaData = stravaResponse.data;

        // 6. SALVA NO BANCO
        await admin.database().ref(`/users/${userId}/stravaAuth`).set({
            accessToken: stravaData.access_token,
            refreshToken: stravaData.refresh_token,
            expiresAt: stravaData.expires_at, // Timestamp Unix
            athleteId: stravaData.athlete ? stravaData.athlete.id : null, // No refresh, athlete pode não vir
            connectedAt: new Date().toISOString()
        });
        
        // Se for refresh, mantém o ID do atleta antigo se não vier no novo
        if (!stravaData.athlete && refresh_token) {
             const oldDataSnapshot = await admin.database().ref(`/users/${userId}/stravaAuth/athleteId`).once('value');
             if (oldDataSnapshot.exists()) {
                 await admin.database().ref(`/users/${userId}/stravaAuth/athleteId`).set(oldDataSnapshot.val());
             }
        }

        return res.status(200).json({ success: true, message: "Token atualizado com sucesso!", data: stravaData });

    } catch (error) {
        console.error("ERRO BACKEND:", error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            error: "Erro no processamento Strava", 
            details: error.response ? error.response.data : error.message 
        });
    }
}
