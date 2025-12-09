/* =================================================================== */
/* ALUNO IA - MÓDULO DE CONSULTORIA ONLINE (V3.0 - COM TESTE DE NIVELAMENTO)
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    stravaData: null,

    init: () => {
        if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        AppIA.auth = firebase.auth();
        AppIA.db = firebase.database();

        AppIA.setupAuthListeners();
        
        AppIA.auth.onAuthStateChanged(user => {
            const loader = document.getElementById('loader');
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            const pendingView = document.getElementById('pending-view');
            const loginForm = document.getElementById('login-form');
            const regForm = document.getElementById('register-form');

            loader.classList.add('hidden');

            if (user) {
                AppIA.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppIA.user = user;
                        authContainer.classList.add('hidden');
                        appContainer.classList.remove('hidden');
                        document.getElementById('user-name-display').textContent = snapshot.val().name;
                        
                        AppIA.checkStravaConnection();
                        AppIA.loadWorkouts();
                    } else {
                        AppIA.db.ref('pendingApprovals/' + user.uid).once('value', pendingSnap => {
                            authContainer.classList.remove('hidden');
                            appContainer.classList.add('hidden');
                            loginForm.classList.add('hidden');
                            regForm.classList.add('hidden');
                            pendingView.classList.remove('hidden'); 
                        });
                    }
                });
            } else {
                authContainer.classList.remove('hidden');
                appContainer.classList.add('hidden');
                pendingView.classList.add('hidden');
                loginForm.classList.remove('hidden');
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppIA.handleStravaCallback(urlParams.get('code'));
    },

    setupAuthListeners: () => {
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

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            AppIA.auth.signInWithEmailAndPassword(email, pass).catch(err => {
                document.getElementById('login-error').textContent = "Erro: " + err.message;
            });
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;

            AppIA.auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => {
                    return AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({
                        name: name,
                        email: email,
                        requestDate: new Date().toISOString(),
                        origin: "Consultoria Online IA"
                    });
                })
                .catch(err => {
                    document.getElementById('register-error').textContent = err.message;
                });
        });

        document.getElementById('btn-logout').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppIA.auth.signOut();
        
        document.getElementById('btn-generate-plan').onclick = AppIA.generatePlanWithAI;
    },

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
                btnSync.onclick = AppIA.syncStravaActivities;
            } else {
                btnConnect.classList.remove('hidden');
                btnSync.classList.add('hidden');
                status.textContent = "";
                btnConnect.onclick = () => {
                    const c = window.STRAVA_PUBLIC_CONFIG;
                    const redirect = window.location.href.split('?')[0]; 
                    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${c.clientID}&response_type=code&redirect_uri=${redirect}&approval_prompt=force&scope=read_all,activity:read_all`;
                };
            }
        });
    },

    handleStravaCallback: async (code) => {
        try {
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
                    window.location.href = "aluno-ia.html";
                }
            }, 500);
        } catch(e) { alert("Erro ao conectar Strava."); }
    },

    syncStravaActivities: async () => {
        const btn = document.getElementById('btn-sync-strava');
        btn.disabled = true;
        btn.textContent = "Sincronizando...";
        alert("Sincronização iniciada! Verifique o painel principal para detalhes completos.");
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

            if (workouts.length === 0) {
                list.innerHTML = `<p style="text-align:center; padding:1rem; color:#666;">Você ainda não tem treinos. Clique em "GERAR MINHA PLANILHA" para começar com um teste de nível.</p>`;
                return;
            }

            workouts.forEach(w => {
                const el = document.createElement('div');
                el.className = 'workout-card';
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
    // CÉREBRO IA: TREINADOR + TESTE DE NIVELAMENTO
    // =================================================================
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            // 1. Pega histórico
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).limitToLast(15).once('value');
            const history = snap.val();
            
            let prompt = "";
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            // 2. Lógica de Decisão: Tem histórico?
            if (!history) {
                // --- CENÁRIO A: NOVO ALUNO (SEM DADOS) ---
                console.log("IA: Novo aluno detectado. Gerando Teste de Nivelamento.");
                prompt = `
                ATUE COMO: Treinador de Elite (Fisiologista).
                SITUAÇÃO: Este é um aluno NOVO, sem nenhum histórico de treino na plataforma.
                OBJETIVO: Criar APENAS UM treino para amanhã (${dateStr}): Um "Teste de Nivelamento" (Teste de Campo) para descobrirmos o pace e zonas dele.
                
                PROTOCOLO RECOMENDADO: "Teste de 3km" (ou 12 min Cooper) se o aluno for ativo, ou "Caminhada Rápida" se for sedentário (assuma que ele pode correr leve).
                
                SAÍDA OBRIGATÓRIA (JSON Array com 1 Item):
                [
                    {
                        "date": "${dateStr}",
                        "title": "Teste de Nivelamento (3km)",
                        "description": "Aquecimento 10min leve.\\n\\nTESTE PRINCIPAL:\\nCorra 3km no seu melhor ritmo possível (forte, mas constante).\\n\\nDesaquecimento: 10min caminhada.\\nIMPORTANTE: Sincronize este treino com Strava para eu analisar seu VO2max depois.",
                        "structure": { "tipo": "Teste", "distancia": "3km" }
                    }
                ]
                Retorne APENAS o JSON.
                `;
            } else {
                // --- CENÁRIO B: ALUNO RECORRENTE (COM HISTÓRICO) ---
                console.log("IA: Histórico encontrado. Gerando Microciclo.");
                prompt = `
                ATUE COMO: Treinador de Elite.
                HISTÓRICO RECENTE (JSON): ${JSON.stringify(history)}
                
                TAREFA: Criar um microciclo de treinos (próxima semana) focado em evolução segura (Regra dos 10%).
                SAÍDA: JSON Array com 3 ou 4 treinos a partir de amanhã (${dateStr}).
                
                Formato JSON esperado:
                [{"date": "...", "title": "...", "description": "...", "structure": {...}}]
                Retorne APENAS o JSON.
                `;
            }

            // 3. Chama Gemini
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const json = await res.json();
            const textResponse = json.candidates[0].content.parts[0].text;
            // Limpeza de Markdown
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
            
            if (!history) {
                alert("🏃‍♂️ Bem-vindo ao time! Seu treinador virtual agendou um TESTE DE NIVELAMENTO para amanhã. Faça o teste para calibrarmos sua planilha.");
            } else {
                alert("✅ Nova planilha semanal gerada com sucesso!");
            }

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