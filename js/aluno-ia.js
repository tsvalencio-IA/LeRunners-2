/* =================================================================== */
/* ALUNO IA - MÓDULO DE CONSULTORIA ONLINE (V6.0 - PROFESSIONAL)
/* INCLUI: GERAÇÃO DE TREINO, UPLOAD BLINDADO, VISÃO IA E MODAL
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    stravaData: null,
    modalState: { isOpen: false, currentWorkoutId: null },

    init: () => {
        if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        AppIA.auth = firebase.auth();
        AppIA.db = firebase.database();

        AppIA.setupAuthListeners();
        AppIA.setupModalListeners(); // Inicia ouvintes do modal
        
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
        document.getElementById('toggleToRegister').onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        document.getElementById('toggleToLogin').onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            AppIA.auth.signInWithEmailAndPassword(email, pass).catch(err => document.getElementById('login-error').textContent = "Erro: " + err.message);
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;
            AppIA.auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({ name, email, requestDate: new Date().toISOString(), origin: "Consultoria IA" }))
                .catch(err => document.getElementById('register-error').textContent = err.message);
        });

        document.getElementById('btn-logout').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-generate-plan').onclick = AppIA.generatePlanWithAI;
    },

    // ===================================================================
    // MODAL LISTENERS (Para abrir e fechar o feedback)
    // ===================================================================
    setupModalListeners: () => {
        const closeBtn = document.getElementById('close-feedback-modal');
        const form = document.getElementById('feedback-form');
        const fileInput = document.getElementById('photo-upload-input');

        if(closeBtn) closeBtn.onclick = AppIA.closeFeedbackModal;
        if(form) form.addEventListener('submit', AppIA.handleFeedbackSubmit);
        if(fileInput) fileInput.addEventListener('change', AppIA.handlePhotoAnalysis); // IA Vision Trigger
    },

    openFeedbackModal: (workoutId, title) => {
        AppIA.modalState.currentWorkoutId = workoutId;
        document.getElementById('feedback-modal-title').textContent = `Registro: ${title}`;
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('photo-upload-input').value = null;
        document.getElementById('photo-upload-feedback').textContent = '';
        document.getElementById('strava-data-display').classList.add('hidden');
        document.getElementById('feedback-modal').classList.remove('hidden');
    },

    closeFeedbackModal: (e) => {
        if(e) e.preventDefault();
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    // ===================================================================
    // IA VISION & UPLOAD (TECNOLOGIA DO APP PRINCIPAL TRANSPLANTADA)
    // ===================================================================
    handlePhotoAnalysis: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const feedbackEl = document.getElementById('photo-upload-feedback');
        feedbackEl.textContent = "Analisando com IA...";
        
        try {
            const base64 = await AppIA.fileToBase64(file);
            const prompt = `Analise a imagem. Retorne JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
            
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }], generationConfig: { responseMimeType: "application/json" } })
            });
            
            if(!r.ok) {
                const err = await r.json();
                throw new Error(err.error?.message || "Erro na API do Google");
            }
            
            const d = await r.json();
            const text = d.candidates[0].content.parts[0].text;
            
            // Limpa JSON (Markdown)
            let cleanJson = text;
            if(text.includes('```')) cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const data = JSON.parse(cleanJson);
            AppIA.stravaData = data; // Armazena dados extraídos
            
            const display = document.getElementById('strava-data-display');
            display.classList.remove('hidden');
            display.innerHTML = `<legend>IA Vision</legend><p>Dist: ${data.distancia}</p><p>Tempo: ${data.tempo}</p><p>Pace: ${data.ritmo}</p>`;
            feedbackEl.textContent = "Dados extraídos com sucesso!";

        } catch (err) {
            console.error(err);
            feedbackEl.textContent = `Falha na leitura IA: ${err.message}. Digite manualmente.`;
        }
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-feedback-btn');
        btn.disabled = true;
        btn.textContent = "Salvando...";

        try {
            let imageUrl = null;
            const fileInput = document.getElementById('photo-upload-input');
            
            // UPLOAD BLINDADO (Verificação de tamanho)
            if (fileInput.files[0]) {
                const file = fileInput.files[0];
                const MAX_SIZE_MB = 10;
                if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Foto muito grande (${(file.size/1024/1024).toFixed(1)}MB). Máx 10MB.`);
                
                const f = new FormData();
                f.append('file', file);
                f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
                f.append('folder', `lerunners/${AppIA.user.uid}/workouts`);
                
                const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
                
                if (!r.ok) {
                    const errData = await r.json();
                    throw new Error(errData.error?.message || "Erro no upload da foto.");
                }
                
                const d = await r.json();
                imageUrl = d.secure_url;
            }

            const updates = {
                status: document.getElementById('workout-status').value,
                feedback: document.getElementById('workout-feedback-text').value,
                realizadoAt: new Date().toISOString()
            };
            if (imageUrl) updates.imageUrl = imageUrl;
            if (AppIA.stravaData) updates.stravaData = AppIA.stravaData; 

            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${AppIA.modalState.currentWorkoutId}`).update(updates);
            
            AppIA.closeFeedbackModal();
            alert("Treino registrado com sucesso!");

        } catch (err) {
            alert("Erro ao salvar: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Salvar Registro";
        }
    },

    fileToBase64: (file) => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.onerror = j; reader.readAsDataURL(file); }),

    // ===================================================================
    // FUNÇÕES DE SISTEMA
    // ===================================================================
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
                const isDone = w.status === 'realizado';
                
                // Botão de ação (Abre o Modal agora)
                let actionButton = '';
                if (!isDone) {
                    actionButton = `
                        <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; text-align: right;">
                            <button class="btn-open-feedback" style="background: var(--success-color); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                                <i class='bx bx-check-circle'></i> Registrar Treino
                            </button>
                        </div>
                    `;
                }

                el.innerHTML = `
                    <div class="workout-card-header">
                        <span class="date">${w.date}</span>
                        <span class="title">${w.title}</span>
                        <span class="status-tag ${isDone ? 'realizado' : 'planejado'}">${isDone ? 'Concluído' : 'Planejado'}</span>
                    </div>
                    <div class="workout-card-body">
                        <p>${w.description}</p>
                        ${w.stravaData ? `<p style="font-size:0.9rem; color:#fc4c02;">Distância: ${w.stravaData.distancia} | Ritmo: ${w.stravaData.ritmo}</p>` : ''}
                        ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; max-height:200px; object-fit:cover; margin-top:10px; border-radius:8px;">` : ''}
                        ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; color:#666; margin-top:5px; border-left: 2px solid #ccc; padding-left: 5px;">"${w.feedback}"</p>` : ''}
                    </div>
                    ${actionButton}
                `;

                // Listener para o botão de Feedback
                const btn = el.querySelector('.btn-open-feedback');
                if(btn) {
                    btn.addEventListener('click', () => AppIA.openFeedbackModal(w.id, w.title));
                }

                list.appendChild(el);
            });
        });
    },

    // GERAÇÃO DE PLANILHA COM PROTEÇÃO DE ERRO
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).limitToLast(15).once('value');
            const history = snap.val();
            
            let prompt = "";
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            if (!history) {
                prompt = `
                ATUE COMO: Treinador de Elite (Fisiologista).
                SITUAÇÃO: Este é um aluno NOVO, sem nenhum histórico de treino na plataforma.
                OBJETIVO: Criar APENAS UM treino para amanhã (${dateStr}): Um "Teste de Nivelamento" (Teste de Campo) para descobrirmos o pace e zonas dele.
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
                prompt = `
                ATUE COMO: Treinador de Elite.
                HISTÓRICO RECENTE (JSON): ${JSON.stringify(history)}
                TAREFA: Criar um microciclo de treinos (próxima semana) focado em evolução segura.
                SAÍDA: JSON Array com 3 ou 4 treinos a partir de amanhã (${dateStr}).
                Formato JSON esperado:
                [{"date": "...", "title": "...", "description": "...", "structure": {...}}]
                Retorne APENAS o JSON.
                `;
            }

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) {
                const err = await r.json();
                throw new Error(err.error?.message || "Erro na API do Google");
            }

            const json = await r.json();
            const textResponse = json.candidates[0].content.parts[0].text;
            const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const newWorkouts = JSON.parse(cleanJson);

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
            
            if (!history) alert("🏃‍♂️ Bem-vindo! Teste de Nivelamento agendado.");
            else alert("✅ Nova planilha gerada com sucesso!");

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
