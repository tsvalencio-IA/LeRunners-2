/* =================================================================== */
/* ALUNO IA - MÓDULO DE CONSULTORIA ONLINE (V11.0 - CLONE RENDER)
/* CORREÇÃO FINAL: Usa PREPEND (pilha) igual ao Painel do Professor
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
        AppIA.setupModalListeners(); 
        
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
                        // CHAMA A CARGA DE TREINOS IMEDIATAMENTE
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

    setupModalListeners: () => {
        const closeBtn = document.getElementById('close-feedback-modal');
        const form = document.getElementById('feedback-form');
        const fileInput = document.getElementById('photo-upload-input');

        if(closeBtn) closeBtn.onclick = AppIA.closeFeedbackModal;
        if(form) form.addEventListener('submit', AppIA.handleFeedbackSubmit);
        if(fileInput) fileInput.addEventListener('change', AppIA.handlePhotoAnalysis);
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
    // IA VISION & UPLOAD (IGUAL AO APP.JS)
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
            
            if(!r.ok) throw new Error("Erro na API do Google");
            const d = await r.json();
            
            if(!d.candidates || !d.candidates[0]) throw new Error("IA não reconheceu a imagem.");
            const text = d.candidates[0].content.parts[0].text;
            
            let cleanJson = text;
            if(text.includes('```')) cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const data = JSON.parse(cleanJson);
            AppIA.stravaData = data; 
            
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
            
            if (fileInput.files[0]) {
                const file = fileInput.files[0];
                const MAX_SIZE_MB = 10;
                if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Foto muito grande. Máx 10MB.`);
                
                const f = new FormData();
                f.append('file', file);
                f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
                f.append('folder', `lerunners/${AppIA.user.uid}/workouts`);
                
                const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
                if (!r.ok) throw new Error("Erro no upload da foto.");
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
    // SISTEMA (STRAVA E GERAÇÃO)
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
        alert("Sincronização iniciada!"); 
        btn.disabled = false;
        btn.innerHTML = "<i class='bx bx-refresh'></i> Sincronizar Agora";
    },

    // ===================================================================
    // CORREÇÃO MÁXIMA: RENDERIZAÇÃO IGUAL AO PAINEL DO PROFESSOR
    // ===================================================================
    loadWorkouts: () => {
        // Ordenação pelo banco (Data) sem limites
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).orderByChild('date').on('value', snapshot => {
            const list = document.getElementById('workout-list');
            list.innerHTML = ""; // Limpa a lista para não duplicar
            
            if (!snapshot.exists()) {
                list.innerHTML = `<p style="text-align:center; padding:1rem; color:#666;">Você ainda não tem treinos.</p>`;
                return;
            }

            snapshot.forEach(childSnapshot => {
                const w = { id: childSnapshot.key, ...childSnapshot.val() };
                
                // Criação do Card (Cópia exata da estrutura visual do Professor)
                const el = document.createElement('div');
                el.className = 'workout-card';
                const isDone = w.status === 'realizado';
                
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
                        ${w.stravaData ? AppIA.createStravaDataDisplay(w.stravaData) : ''}
                        ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; max-height:200px; object-fit:cover; margin-top:10px; border-radius:8px;">` : ''}
                        ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; color:#666; margin-top:5px; border-left: 2px solid #ccc; padding-left: 5px;">"${w.feedback}"</p>` : ''}
                    </div>
                    ${actionButton}
                `;

                // Configura o clique no botão de ação
                const btn = el.querySelector('.btn-open-feedback');
                if(btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        AppIA.openFeedbackModal(w.id, w.title);
                    });
                }
                
                // Configura o clique no card inteiro (para facilitar no celular)
                el.addEventListener('click', (e) => {
                    // Só abre se não clicou num link ou botão específico
                    if (!e.target.closest('button') && !e.target.closest('a')) {
                        AppIA.openFeedbackModal(w.id, w.title);
                    }
                });

                // TRUQUE DO PROFESSOR: PREPEND (Empilha o mais novo visualmente no topo)
                list.prepend(el);
            });
        });
    },

    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';
        return `
            <div style="background:#fff5f0; border:1px solid #fc4c02; padding:10px; border-radius:5px; margin-top:10px;">
                <strong style="color:#fc4c02">Strava / IA:</strong>
                <div style="font-family:monospace;">
                    Dist: ${stravaData.distancia || "N/A"} | Tempo: ${stravaData.tempo || "N/A"} | Pace: ${stravaData.ritmo || "N/A"}
                </div>
            </div>
        `;
    },

    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            // Pega histórico sem limites para dar contexto total
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).orderByChild('date').once('value');
            
            // Converte snapshot em array para a IA
            let history = [];
            if(snap.exists()) {
                snap.forEach(c => history.push(c.val()));
                // Pega só os últimos 15 para não estourar o prompt
                history = history.slice(-15);
            }
            
            let prompt = "";
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];

            if (history.length === 0) {
                prompt = `
                ATUE COMO: Treinador de Elite (Fisiologista).
                OBJETIVO: Criar APENAS UM treino para amanhã (${dateStr}): Um "Teste de Nivelamento".
                SAÍDA OBRIGATÓRIA (JSON Array com 1 Item):
                [ { "date": "${dateStr}", "title": "Teste de Nivelamento (3km)", "description": "Teste máximo de 3km. Anote o tempo.", "structure": { "tipo": "Teste" } } ]
                Retorne APENAS o JSON.
                `;
            } else {
                prompt = `
                ATUE COMO: Treinador de Elite.
                HISTÓRICO RECENTE: ${JSON.stringify(history)}
                SAÍDA: JSON Array com 3 ou 4 treinos a partir de amanhã (${dateStr}).
                Formato: [{"date": "...", "title": "...", "description": "..."}]
                Retorne APENAS o JSON.
                `;
            }

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) {
                const err = await r.json();
                throw new Error(err.error?.message || "Erro na API do Google");
            }

            const json = await r.json();
            const textResponse = json.candidates[0].content.parts[0].text;
            let cleanJson = textResponse;
            if(textResponse.includes('```')) cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
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
            alert("✅ Nova planilha gerada com sucesso!");

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
