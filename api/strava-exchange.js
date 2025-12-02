import admin from "firebase-admin";
import axios from "axios";

// Função robusta para corrigir a chave privada (Lida com \\n e \n)
const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

export default async function handler(req, res) {
    // 1. CORS (Permissivo para garantir que o navegador não bloqueie)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. Inicializa Firebase (Singleton)
        if (admin.apps.length === 0) {
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                console.error("ERRO CRÍTICO: FIREBASE_SERVICE_ACCOUNT não definida.");
                throw new Error("Configuração de servidor inválida (Firebase).");
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

        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Método inválido. Use POST." });
        }

        // 3. Validação de Token
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Token ausente." });
        }

        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 4. Strava Exchange
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Código Strava não recebido." });

        if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
             console.error("ERRO CRÍTICO: Credenciais Strava não definidas no Vercel.");
             throw new Error("Configuração Strava incompleta.");
        }

        const response = await axios.post("https://www.strava.com/oauth/token", {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: "authorization_code",
        });

        // 5. Salva no Banco
        await admin.database().ref(`/users/${userId}/stravaAuth`).set({
            ...response.data,
            connectedAt: new Date().toISOString()
        });

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("ERRO BACKEND:", error.response?.data || error.message);
        return res.status(500).json({ 
            error: "Erro no servidor", 
            details: error.message 
        });
    }
}
