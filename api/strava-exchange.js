/* =================================================================== */
/* VERCEL 2 SERVERLESS FUNCTION: /api/strava-exchange
/* ARQUIVO COMPLETO E DEFINITIVO (Versão V2.0 - ESM/Import)
/* =================================================================== */

import admin from "firebase-admin";
import axios from "axios";

// Função auxiliar para formatar a chave privada corretamente
// (Corrige o problema das quebras de linha nas variáveis de ambiente da Vercel)
const formatPrivateKey = (key) => {
    return key.replace(/\\n/g, '\n');
};

export default async function handler(req, res) {
    // 1. APLICAÇÃO DE CABEÇALHOS CORS (Obrigatório para funcionar no navegador)
    // Permite que o teu site (GitHub Pages) fale com este backend
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Se o navegador estiver apenas a testar a conexão (OPTIONS), responde OK imediatamente
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. INICIALIZAÇÃO DO FIREBASE ADMIN
        // Verifica se o Firebase já foi iniciado para não iniciar duas vezes
        if (admin.apps.length === 0) {
            // Verifica se a chave mestra existe nas variáveis da Vercel
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                throw new Error("ERRO CRÍTICO: A variável FIREBASE_SERVICE_ACCOUNT não foi encontrada nas configurações da Vercel.");
            }
            
            // Lê e converte a chave de texto para objeto JSON
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            
            // Corrige a formatação da chave privada se necessário
            if (serviceAccount.private_key) {
                serviceAccount.private_key = formatPrivateKey(serviceAccount.private_key);
            }

            // Inicia a conexão segura com o Banco de Dados
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: "https://lerunners-a6de2-default-rtdb.firebaseio.com"
            });
        }

        // 3. VALIDAÇÕES DE SEGURANÇA
        // Garante que o método é POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: "Método não permitido. Use POST." });
        }

        // Garante que enviaram o Token de Autenticação
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Token de autorização ausente." });
        }

        // 4. IDENTIFICAÇÃO DO USUÁRIO
        // Pega o token, verifica no Firebase quem é a pessoa e pega o ID dela (uid)
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        // 5. RECEBIMENTO DO CÓDIGO STRAVA
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Código Strava não recebido." });
        }

        // Lê as chaves do Strava das variáveis de ambiente
        const clientID = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;

        if (!clientID || !clientSecret) {
            throw new Error("Configuração do Strava (ID/Secret) ausente na Vercel.");
        }

        // 6. TROCA DE CÓDIGO POR TOKEN (Chamada à API do Strava)
        const stravaResponse = await axios.post("https://www.strava.com/oauth/token", {
            client_id: clientID,
            client_secret: clientSecret,
            code: code,
            grant_type: "authorization_code",
        });

        const stravaData = stravaResponse.data;

        // 7. SALVAMENTO DOS DADOS NO FIREBASE
        // Grava o token de acesso do Strava no perfil do usuário
        await admin.database().ref(`/users/${userId}/stravaAuth`).set({
            accessToken: stravaData.access_token,
            refreshToken: stravaData.refresh_token,
            expiresAt: stravaData.expires_at,
            athleteId: stravaData.athlete.id,
            connectedAt: new Date().toISOString()
        });

        // 8. RESPOSTA DE SUCESSO
        return res.status(200).json({ success: true, message: "Conectado com sucesso!" });

    } catch (error) {
        console.error("ERRO NO BACKEND:", error);
        
        // Retorna o erro detalhado para facilitar o diagnóstico
        return res.status(500).json({ 
            error: "Erro interno no servidor Vercel", 
            details: error.message,
            stack: error.stack 
        });
    }
}
