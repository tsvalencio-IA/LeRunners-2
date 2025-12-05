/* =================================================================== */
/* ALUNO IA - MÓDULO DE CONSULTORIA ONLINE (INTEGRADO AO PAINEL COACH)
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    stravaData: null,

    init: () => {
        // Inicializa Firebase com as chaves reais do config.js
        if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        AppIA.auth = firebase.auth();
        AppIA.db = firebase.database();

        AppIA.setupAuthListeners();
        
        // Verifica login
        AppIA.auth.onAuthStateChanged(user => {
            const loader = document.getElementById('loader');
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            const pendingView = document.getElementById('pending-view');
            const loginForm = document.getElementById('login-form');
            const regForm = document.getElementById('register-form');

            loader.classList.add('hidden');

            if (user) {
                // Usuário logado: Verifica se está aprovado na tabela 'users'
                AppIA.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        // APROVADO PELO COACH LEANDRO
                        AppIA.user = user;
                        authContainer.classList.add('hidden');
                        appContainer.classList.remove('hidden');
                        document.getElementById('user-name-display').textContent = snapshot.val().name;
                        
                        // Inicia o sistema
                        AppIA.checkStravaConnection();
                        AppIA.loadWorkouts();
                    } else {
                        // PENDENTE (Está na lista de espera)
                        // Verifica se está na lista de pendentes para não dar erro
                        AppIA.db.ref('pendingApprovals/' + user.uid).once('value', pendingSnap => {
                            authContainer.classList.remove('hidden');
                            appContainer.classList.add('hidden');
                            loginForm.classList.add('hidden');
                            regForm.classList.add('hidden');
                            pendingView.classList.remove('hidden'); // Mostra aviso de espera
                        });
                    }
                });
            } else {
                // Não logado
                authContainer.classList.remove('hidden');
                appContainer.classList.add('hidden');
                pendingView.classList.add('hidden');
                loginForm.classList.remove('hidden');
            }
        });

        // Tratamento do retorno do Strava (Code)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppIA.handleStravaCallback(urlParams.get('code'));
    },

    setupAuthListeners: () => {
        // Toggle Login/Registro
        document.getElementById('toggleToRegister').onclick = (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        };
        document.getElementById('toggleToLogin').onclick = (e) => {
            e.preventDefault();
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        };

        // Login
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            AppIA.auth.signInWithEmailAndPassword(email, pass).catch(err => {
                document.getElementById('login-error').textContent = "Erro: " + err.message;
            });
        });

        // Registro (Envia para aprovação do Leandro)
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;

            AppIA.auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => {
                    // CRIA NA LISTA DE PENDENTES (Para o Leandro ver no painel dele)
                    return AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({
                        name: name,
                        email: email,
                        requestDate: new Date().toISOString(),
                        origin: "Consultoria Online IA" // Marcador para o Leandro saber
                    });
                })
                .catch(err => {
                    document.getElementById('register-error').textContent = err.message;
                });
        });

        // Logout
        document.getElementById('btn-logout').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppIA.auth.signOut();
        
        // Botão Gerar Planilha
        document.getElementById('btn-generate-plan').onclick = AppIA.generatePlanWithAI;
    },

    // =================================================================
    // INTEGRAÇÃO STRAVA (Mesma lógica segura do app principal)
    // =================================================================
    checkStravaConnection: () => {
        AppIA.db.ref(`users/${AppIA.user.uid}/stravaAuth`).on('value', snapshot => {
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');

            if (snapshot.exists()) {
                AppIA.stravaData = snapshot.val();
                btnConnect.classList.add('hidden');
                btnSync.classList.remove('hidden');
                status.textContent = "✅ Strava Conectado.";
                
                // Ativa o botão de sync
                btnSync.onclick = AppIA.syncStravaActivities;
            } else {
                btnConnect.classList.remove('hidden');
                btnSync.classList.add('hidden');
                status.textContent = "";
                
                btnConnect.onclick = () => {
                    const c = window.STRAVA_PUBLIC_CONFIG;
                    // Redireciona de volta para ESTA página (aluno-ia.html)
                    const redirect = window.location.href.split('?')[0]; 
                    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${c.clientID}&response_type=code&redirect_uri=${redirect}&approval_prompt=force&scope=read_all,activity:read_all`;
                };
            }
        });
    },

    handleStravaCallback: async (code) => {
        // Usa a API do Vercel para trocar o token
        try {
            // Espera o auth carregar
            const checkUser = setInterval(async () => {
                const user = firebase.auth().currentUser;
                if (user) {
                    clearInterval(checkUser);
                    const token = await user.getIdToken();
                    await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                        body: JSON.stringify({code})
                    });
                    window.location.href = "aluno-ia.html"; // Limpa a URL
                }
            }, 500);
        } catch(e) { alert("Erro ao conectar Strava."); }
    },

    syncStravaActivities: async () => {
        // (Lógica simplificada de sync reutilizando a API)
        const btn = document.getElementById('btn-sync-strava');
        btn.disabled = true;
        btn.textContent = "Sincronizando...";
        
        // Aqui chamamos a lógica de refresh se necessário (igual ao app principal)
        // ... (Para simplificar este arquivo, assumimos que o token está válido ou o app principal renovou)
        // Idealmente, você pode copiar a função refreshStravaToken do app.js para cá se precisar.
        
        alert("Sincronização iniciada! (Lógica completa disponível no app principal)");
        btn.disabled = false;
        btn.innerHTML = "<i class='bx bx-refresh'></i> Sincronizar Agora";
    },

    loadWorkouts: () => {
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).orderByChild('date').limitToLast(20).on('value', snapshot => {
            const list = document.getElementById('workout-list');
            list.innerHTML = "";
            
            const workouts = [];
            snapshot.forEach(child => workouts.push({id: child.key, ...child.val()}));
            workouts.sort((a,b) => new Date(b.date) - new Date(a.date));

            workouts.forEach(w => {
                const el = document.createElement('div');
                el.className = 'workout-card';
                // Verifica se é prescrição da IA
                const isAI = w.createdBy === 'IA_COACH';
                
                el.innerHTML = `
                    <div class="workout-card-header">
                        <span class="date">${w.date}</span>
                        <span class="title">${w.title}</span>
                        <span class="status-tag ${isAI ? 'planejado' : 'realizado'}">${isAI ? '🤖 IA Coach' : 'Realizado'}</span>
                    </div>
                    <div class="workout-card-body">
                        <p>${w.description}</p>
                        ${w.stravaData ? `<p style="font-size:0.9rem; color:#fc4c02;">Distância: ${w.stravaData.distancia}</p>` : ''}
                    </div>
                `;
                list.appendChild(el);
            });
        });
    },

    // =================================================================
    // CÉREBRO IA: FISIOLOGISTA SÊNIOR
    // =================================================================
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            // 1. Pega histórico
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).limitToLast(15).once('value');
            const history = snap.val() || {};

            // 2. Prompt Fisiologista Sênior (Verdade Absoluta)
            const prompt = `
            ATUE COMO: Fisiologista Sênior da Seleção Brasileira e Treinador Olímpico.
            TAREFA: Criar uma microciclo de treinos (próxima semana) para este atleta.
            
            HISTÓRICO RECENTE (JSON):
            ${JSON.stringify(history)}

            REGRAS DE OURO (FISIOLOGIA):
            1. SEGURANÇA: Calcule o volume total da última semana. Aumente no máximo 10% para a próxima. Se não houve treino, prescreva retorno gradual.
            2. PERIODIZAÇÃO: Crie 3 ou 4 treinos para os próximos 7 dias a partir de hoje (${new Date().toISOString().split('T')[0]}).
            3. ESTRUTURA: Intercale dias fortes (Tiros/Tempo Run) com dias fáceis (Rodagem) e descanso.
            
            SAÍDA OBRIGATÓRIA (JSON PURO):
            Retorne APENAS um Array JSON válido com os novos treinos. Sem texto antes ou depois.
            Exemplo:
            [
                {
                    "date": "YYYY-MM-DD",
                    "title": "Rodagem Z2",
                    "description": "Aquecimento 10min + 30min Z2 + Desaquecimento. Foco na biomecânica.",
                    "structure": { "tipo": "Rodagem", "distancia": "6km" }
                }
            ]
            `;

            // 3. Chama Gemini
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const json = await res.json();
            const textResponse = json.candidates[0].content.parts[0].text;
            const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const newWorkouts = JSON.parse(cleanJson);

            // 4. Salva
            const updates = {};
            newWorkouts.forEach(workout => {
                const key = AppIA.db.ref().push().key;
                updates[`data/${AppIA.user.uid}/workouts/${key}`] = {
                    ...workout,
                    status: 'planejado',
                    createdBy: 'IA_COACH',
                    createdAt: new Date().toISOString()
                };
            });

            await AppIA.db.ref().update(updates);
            alert("✅ Planilha gerada com sucesso pelo Treinador Virtual!");

        } catch (e) {
            console.error(e);
            alert("Erro na IA: " + e.message);
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);
