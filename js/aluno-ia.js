/* =================================================================== */
/* ALUNO IA - MÓDULO DE CONSULTORIA ONLINE (V26.0 - SENIOR FIX)
/* CORREÇÃO: Normalização de Status e Forçamento de Contexto para a IA.
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

            if(loader) loader.classList.add('hidden');

            if (user) {
                AppIA.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppIA.user = user;
                        if(authContainer) authContainer.classList.add('hidden');
                        if(appContainer) appContainer.classList.remove('hidden');
                        if(document.getElementById('user-name-display')) 
                            document.getElementById('user-name-display').textContent = snapshot.val().name;
                        
                        AppIA.checkStravaConnection();
                        AppIA.loadWorkouts(); 
                    } else {
                        AppIA.db.ref('pendingApprovals/' + user.uid).once('value', pendingSnap => {
                            if(authContainer) authContainer.classList.remove('hidden');
                            if(appContainer) appContainer.classList.add('hidden');
                            if(loginForm) loginForm.classList.add('hidden');
                            if(regForm) regForm.classList.add('hidden');
                            if(pendingView) pendingView.classList.remove('hidden'); 
                        });
                    }
                });
            } else {
                if(authContainer) authContainer.classList.remove('hidden');
                if(appContainer) appContainer.classList.add('hidden');
                if(pendingView) pendingView.classList.add('hidden');
                if(loginForm) loginForm.classList.remove('hidden');
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppIA.handleStravaCallback(urlParams.get('code'));
    },

    setupAuthListeners: () => {
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        if(toReg) toReg.onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        if(toLog) toLog.onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        const loginF = document.getElementById('login-form');
        if(loginF) loginF.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            AppIA.auth.signInWithEmailAndPassword(email, pass).catch(err => document.getElementById('login-error').textContent = "Erro: " + err.message);
        });

        const regF = document.getElementById('register-form');
        if(regF) regF.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;
            AppIA.auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({ name, email, requestDate: new Date().toISOString(), origin: "Consultoria IA" }))
                .catch(err => document.getElementById('register-error').textContent = err.message);
        });

        const btnOut = document.getElementById('btn-logout');
        if(btnOut) btnOut.onclick = () => AppIA.auth.signOut();
        const btnOutP = document.getElementById('btn-logout-pending');
        if(btnOutP) btnOutP.onclick = () => AppIA.auth.signOut();
        
        // Listeners dos botões de IA
        const btnGen = document.getElementById('btn-generate-plan');
        if(btnGen) btnGen.onclick = AppIA.generatePlanWithAI;
        const btnAnalyze = document.getElementById('btn-analyze-progress');
        if(btnAnalyze) btnAnalyze.onclick = AppIA.analyzeProgressWithAI;
    },

    setupModalListeners: () => {
        // Modal Feedback
        const closeBtn = document.getElementById('close-feedback-modal');
        const form = document.getElementById('feedback-form');
        const fileInput = document.getElementById('photo-upload-input');
        if(closeBtn) closeBtn.onclick = AppIA.closeFeedbackModal;
        if(form) form.addEventListener('submit', AppIA.handleFeedbackSubmit);
        if(fileInput) fileInput.addEventListener('change', AppIA.handlePhotoAnalysis);

        // Modal Avulso
        const btnLog = document.getElementById('btn-log-manual');
        const closeLog = document.getElementById('close-log-activity-modal');
        const formLog = document.getElementById('log-activity-form');
        if(btnLog) btnLog.onclick = AppIA.openLogActivityModal;
        if(closeLog) closeLog.onclick = AppIA.closeLogActivityModal;
        if(formLog) formLog.onsubmit = AppIA.handleLogActivitySubmit;

        // Modal Relatório
        const closeReport = document.getElementById('close-ia-report-modal');
        if(closeReport) closeReport.onclick = () => document.getElementById('ia-report-modal').classList.add('hidden');
    },

    // --- HELPER: NORMALIZAR STATUS (FIX PARA O ERRO DA IA) ---
    isStatusCompleted: (status) => {
        if (!status) return false;
        const s = status.toString().toLowerCase().trim();
        // Lista de palavras que indicam sucesso, independente de como foi escrito
        const validos = ['realizado', 'concluido', 'concluído', 'feito', 'done', 'finished', 'executado', 'ok', 'realizado_parcial'];
        return validos.some(val => s.includes(val));
    },

    // --- FUNÇÃO EXCLUIR TREINO ---
    deleteWorkout: async (workoutId) => {
        if(confirm("Tem certeza que deseja excluir este treino da sua planilha?")) {
            try {
                await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${workoutId}`).remove();
            } catch(e) {
                alert("Erro ao excluir: " + e.message);
            }
        }
    },

    // --- ATIVIDADE AVULSA ---
    openLogActivityModal: () => {
        document.getElementById('log-activity-form').reset();
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('log-activity-modal').classList.remove('hidden');
    },
    closeLogActivityModal: (e) => {
        if(e) e.preventDefault();
        document.getElementById('log-activity-modal').classList.add('hidden');
    },
    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        try {
            const workoutData = {
                date: document.getElementById('log-date').value,
                title: document.getElementById('log-title').value,
                description: document.getElementById('log-description').value,
                status: 'realizado',
                realizadoAt: new Date().toISOString(),
                createdBy: 'ALUNO_IA_MANUAL',
                createdAt: new Date().toISOString(),
                feedback: "Atividade registrada manualmente (Avulsa)."
            };
            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).push(workoutData);
            AppIA.closeLogActivityModal();
            alert("Atividade registrada com sucesso!");
        } catch(err) { alert("Erro: " + err.message); } finally { btn.disabled = false; }
    },

    // --- FEEDBACK COM DATA FLEXÍVEL ---
    openFeedbackModal: (workoutId, title, originalDate) => {
        AppIA.modalState.currentWorkoutId = workoutId;
        document.getElementById('feedback-modal-title').textContent = `Registro: ${title}`;
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('photo-upload-input').value = null;
        document.getElementById('photo-upload-feedback').textContent = '';
        document.getElementById('strava-data-display').classList.add('hidden');
        
        const form = document.getElementById('feedback-form');
        if (!document.getElementById('feedback-date-realized')) {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'form-group';
            dateGroup.innerHTML = `
                <label for="feedback-date-realized" style="display:block; font-weight:bold; margin-bottom:5px;">Data de Realização</label>
                <input type="date" id="feedback-date-realized" class="form-control" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            `;
            const statusGroup = form.querySelector('.form-group'); 
            statusGroup.parentNode.insertBefore(dateGroup, statusGroup.nextSibling);
        }
        document.getElementById('feedback-date-realized').value = originalDate || new Date().toISOString().split('T')[0];
        document.getElementById('feedback-modal').classList.remove('hidden');
    },

    closeFeedbackModal: (e) => {
        if(e) e.preventDefault();
        document.getElementById('feedback-modal').classList.add('hidden');
    },

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

            const realizedDate = document.getElementById('feedback-date-realized').value;
            const updates = {
                status: document.getElementById('workout-status').value,
                feedback: document.getElementById('workout-feedback-text').value,
                realizadoAt: new Date().toISOString(),
                date: realizedDate 
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

    // --- SISTEMA ---
    checkStravaConnection: () => {
        AppIA.db.ref(`users/${AppIA.user.uid}/stravaAuth`).on('value', snapshot => {
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');
            if (snapshot.exists()) {
                AppIA.stravaData = snapshot.val();
                if(btnConnect) btnConnect.classList.add('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
                if(status) status.textContent = "✅ Strava Conectado.";
                if(btnSync) btnSync.onclick = AppIA.syncStravaActivities;
            } else {
                if(btnConnect) btnConnect.classList.remove('hidden');
                if(btnSync) btnSync.classList.add('hidden');
                if(status) status.textContent = "";
                if(btnConnect) btnConnect.onclick = () => {
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
        alert("Sincronização iniciada! Aguarde a atualização da página."); 
        // A lógica real está no app.js, aqui apenas dispara a UI
        if(window.opener && window.opener.AppPrincipal) {
             window.opener.AppPrincipal.handleStravaSyncActivities();
        } else {
            // Fallback se não encontrar o controller principal
             setTimeout(() => { btn.disabled = false; btn.innerHTML = "<i class='bx bx-refresh'></i> Sincronizar Agora"; }, 3000);
        }
    },

    // --- RENDERIZAÇÃO ---
    loadWorkouts: () => {
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).orderByChild('date').on('value', snapshot => {
            const list = document.getElementById('workout-list');
            if(!list) return;
            list.innerHTML = "";
            if (!snapshot.exists()) {
                list.innerHTML = `<p style="text-align:center; padding:1rem; color:#666;">Você ainda não tem treinos.</p>`;
                return;
            }
            snapshot.forEach(childSnapshot => {
                const w = { id: childSnapshot.key, ...childSnapshot.val() };
                const el = document.createElement('div');
                el.className = 'workout-card';
                // Usando a nova verificação robusta para a UI
                const isDone = AppIA.isStatusCompleted(w.status);
                
                const deleteBtnHtml = `
                    <button class="btn-delete" style="background: #ff4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Excluir Treino">
                        <i class='bx bx-trash'></i>
                    </button>
                `;

                let actionButtonHtml = '';
                if (!isDone) {
                    actionButtonHtml = `
                        <button class="btn-open-feedback" style="background: var(--success-color); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                            <i class='bx bx-check-circle'></i> Registrar Treino
                        </button>
                    `;
                } else {
                    actionButtonHtml = `
                        <button class="btn-open-feedback" style="background: var(--primary-color); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                            <i class='bx bx-edit'></i> Editar
                        </button>
                    `;
                }

                el.innerHTML = `
                    <div class="workout-card-header">
                        <span class="date">${w.date}</span>
                        <span class="title">${w.title}</span>
                        <span class="status-tag ${isDone ? 'realizado' : 'planejado'}">${isDone ? 'Concluído' : 'Planejado'}</span>
                    </div>
                    <div class="workout-card-body">
                        <p>${w.description || ''}</p>
                        ${w.stravaData ? AppIA.createStravaDataDisplay(w.stravaData) : ''}
                        ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; max-height:200px; object-fit:cover; margin-top:10px; border-radius:8px;">` : ''}
                        ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; color:#666; margin-top:5px; border-left: 2px solid #ccc; padding-left: 5px;">"${w.feedback}"</p>` : ''}
                    </div>
                    <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: flex-end;">
                        ${deleteBtnHtml}
                        ${actionButtonHtml}
                    </div>
                `;
                
                const btn = el.querySelector('.btn-open-feedback');
                const btnDel = el.querySelector('.btn-delete');

                if(btn) btn.addEventListener('click', (e) => { e.stopPropagation(); AppIA.openFeedbackModal(w.id, w.title, w.date); });
                if(btnDel) btnDel.addEventListener('click', (e) => { e.stopPropagation(); AppIA.deleteWorkout(w.id); });

                el.addEventListener('click', (e) => {
                     if (!e.target.closest('button') && !e.target.closest('a')) AppIA.openFeedbackModal(w.id, w.title, w.date);
                });
                
                list.prepend(el);
            });
        });
    },

    // --- EXIBIÇÃO DE DADOS ---
    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';
        let mapLinkHtml = '';
        if (stravaData.mapLink) {
            mapLinkHtml = `<p style="margin-top:5px;"><a href="${stravaData.mapLink}" target="_blank" style="color: #fc4c02; font-weight: bold; text-decoration: none;">🗺️ Ver no Strava</a></p>`;
        }
        let splitsHtml = '';
        if (stravaData.splits && Array.isArray(stravaData.splits) && stravaData.splits.length > 0) {
            splitsHtml = `<div style="margin-top:10px; padding-top:5px; border-top:1px dashed #ccc; font-size:0.85rem; color:#555;"><strong>Parciais:</strong><br>`;
            stravaData.splits.forEach(s => { splitsHtml += `Km ${s.km}: ${s.pace} <span style="font-size:0.8em; color:#999;">(${s.ele}m)</span><br>`; });
            splitsHtml += `</div>`;
        }
        return `
            <fieldset class="strava-data-display" style="border: 1px solid #fc4c02; background: #fff5f0; padding: 10px; border-radius: 5px; margin-top: 10px;">
                <legend style="color: #fc4c02; font-weight: bold; font-size: 0.9rem;">
                    <img src="img/strava.png" alt="Powered by Strava" style="height: 20px; vertical-align: middle; margin-right: 5px;">
                    Dados do Treino
                </legend>
                <div style="font-family:monospace; font-weight:bold; font-size:1rem;">
                    Dist: ${stravaData.distancia || "N/A"} | Tempo: ${stravaData.tempo || "N/A"} | Pace: ${stravaData.ritmo || "N/A"}
                </div>
                ${splitsHtml}
                ${mapLinkHtml}
            </fieldset>
        `;
    },

    // --- CÉREBRO IA 1: GERAÇÃO DE TREINOS ---
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Analisando volume, intensidade e carga...";
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            
            let history = [];
            if(snap.exists()) {
                snap.forEach(c => history.push(c.val()));
            }
            
            history.sort((a, b) => new Date(a.date) - new Date(b.date));
            const recentHistory = history.slice(-20); 

            // HIGIENE DE DADOS PARA O PROMPT DE GERAÇÃO
            const cleanHistory = recentHistory.map(w => ({
                date: w.date,
                title: w.title,
                status: AppIA.isStatusCompleted(w.status) ? "CONCLUÍDO" : "NÃO REALIZADO", // Normalização
                feedback: w.feedback || "",
                distancia: w.stravaData ? w.stravaData.distancia : "N/A",
                tempo: w.stravaData ? w.stravaData.tempo : "N/A",
                pace: w.stravaData ? w.stravaData.ritmo : "N/A"
            }));
            
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = tomorrow.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];

            let prompt = "";
            if (cleanHistory.length === 0) {
                prompt = `ATUE COMO: Fisiologista Sênior. OBJETIVO: Criar Teste de Nivelamento para ${dateStr}. SAÍDA: JSON Array com 1 treino.`;
            } else {
                prompt = `
                ATUE COMO: Fisiologista Sênior e Treinador de Elite (Nível Olímpico).
                CONTEXTO: Hoje é ${todayStr}. Você é um sistema inteligente (tipo Garmin Coach).
                HISTÓRICO RECENTE DO ATLETA (LIMPO E CRONOLÓGICO):
                ${JSON.stringify(cleanHistory)}
                SUA MISSÃO (MICRO-CICLO SEMANAL):
                1. ANÁLISE DE CARGA: Verifique a Carga Aguda vs Crônica.
                2. DISTRIBUIÇÃO TEMPORAL: Gere 3 a 4 treinos para os PRÓXIMOS 7 DIAS a partir de ${dateStr}.
                3. OBRIGATÓRIO: Intercale dias de descanso (OFF). Não agende 4 dias seguidos de corrida.
                SAÍDA: Gere a planilha.
                FORMATO JSON OBRIGATÓRIO (Array):
                [ { "date": "YYYY-MM-DD", "title": "...", "description": "...", "structure": { "tipo": "Qualidade", "distancia": "X km" } } ]
                IMPORTANTE: Responda APENAS o JSON.
                `;
            }

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) throw new Error("Erro na API do Google");
            const json = await r.json();
            const textResponse = json.candidates[0].content.parts[0].text;
            let cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const newWorkouts = JSON.parse(cleanJson);

            const updates = {};
            newWorkouts.forEach(workout => {
                const key = AppIA.db.ref().push().key;
                updates[`data/${AppIA.user.uid}/workouts/${key}`] = {
                    ...workout,
                    status: 'planejado',
                    createdBy: 'IA_PHYSIO',
                    createdAt: new Date().toISOString()
                };
            });
            await AppIA.db.ref().update(updates);
            if (cleanHistory.length > 0) alert("✅ Planilha gerada com sucesso!");
            else alert("✅ Protocolo de Teste gerado!");

        } catch (e) { alert("Erro na IA: " + e.message); } 
        finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- CÉREBRO IA 2: ANÁLISE DE PROGRESSO (CORRIGIDO PARA LER STATUS MISTOS) ---
    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        const modal = document.getElementById('ia-report-modal');
        const content = document.getElementById('ia-report-content');
        
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Fisiologista está analisando seu histórico...";
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            // 1. LÊ TUDO DO BANCO
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            if(!snap.exists()) throw new Error("Você precisa de pelo menos 1 treino realizado para analisar.");
            
            let history = [];
            snap.forEach(c => history.push(c.val()));
            
            // 2. ORDENAÇÃO MANUAL POR DATA
            history.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // 3. FILTRO E LIMPEZA ROBUSTA (AQUI ESTAVA O ERRO)
            // Agora usa a função helper 'isStatusCompleted' que aceita "Concluído", "Realizado", "Done"...
            const cleanHistory = history.filter(w => AppIA.isStatusCompleted(w.status)).slice(-15).map(w => ({
                date: w.date,
                title: w.title,
                // FORÇA O STATUS "CONCLUÍDO" PARA A IA NÃO SE CONFUNDIR
                status: "CONCLUÍDO", 
                feedback: w.feedback || "Sem feedback",
                distancia: w.stravaData ? w.stravaData.distancia : "N/A",
                tempo: w.stravaData ? w.stravaData.tempo : "N/A",
                pace: w.stravaData ? w.stravaData.ritmo : "N/A"
            }));

            if (cleanHistory.length === 0) {
                throw new Error("Nenhum treino concluído encontrado recentemente. Verifique se marcou como 'Realizado'.");
            }

            const todayStr = new Date().toISOString().split('T')[0];

            const prompt = `
            ATUE COMO: Seu Treinador Pessoal Sênior.
            HOJE É: ${todayStr}.
            FALE DIRETAMENTE COM O ATLETA (Use "Você").
            
            DADOS DO ATLETA (Últimos treinos REALIZADOS, limpos e em ordem cronológica):
            ${JSON.stringify(cleanHistory)}
            
            TAREFA: Avaliar o progresso recente com base nesses dados reais.
            1. Analise o Volume e Constância (Verifique as datas: ele treinou recentemente? Compare as datas com ${todayStr}).
            2. Analise a Intensidade e Feedback (O que ele escreveu nos feedbacks?).
            3. Dê 3 Conselhos Práticos para a próxima semana.
            
            Gere um relatório curto, motivador e técnico em Texto Corrido (Markdown).
            `;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) throw new Error("Erro na API");
            const json = await r.json();
            const report = json.candidates[0].content.parts[0].text;

            content.textContent = report; 
            modal.classList.remove('hidden');

        } catch(e) {
            alert("Erro na Análise: " + e.message);
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);
