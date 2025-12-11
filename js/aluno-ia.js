/* =================================================================== */
/* ALUNO IA - MÓDULO INTEGRAL (V39.0 - SEM CORTES)
/* STATUS: Correção de Data IA + Todas as funções expandidas.
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    stravaData: null,
    modalState: { isOpen: false, currentWorkoutId: null },

    // --- 1. INICIALIZAÇÃO ---
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

            if(loader) loader.classList.add('hidden');

            if (user) {
                AppIA.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppIA.user = user;
                        if(authContainer) authContainer.classList.add('hidden');
                        if(appContainer) appContainer.classList.remove('hidden');
                        
                        const nameDisplay = document.getElementById('user-name-display');
                        if(nameDisplay) nameDisplay.textContent = snapshot.val().name;
                        
                        AppIA.checkStravaConnection();
                        AppIA.loadWorkouts(); 
                    } else {
                        if(authContainer) authContainer.classList.remove('hidden');
                        if(appContainer) appContainer.classList.add('hidden');
                        if(loginForm) loginForm.classList.add('hidden');
                        if(pendingView) pendingView.classList.remove('hidden'); 
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

    // --- 2. LISTENERS DE AUTENTICAÇÃO ---
    setupAuthListeners: () => {
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        
        if(toReg) toReg.onclick = (e) => { 
            e.preventDefault(); 
            document.getElementById('login-form').classList.add('hidden'); 
            document.getElementById('register-form').classList.remove('hidden'); 
        };
        if(toLog) toLog.onclick = (e) => { 
            e.preventDefault(); 
            document.getElementById('register-form').classList.add('hidden'); 
            document.getElementById('login-form').classList.remove('hidden'); 
        };

        const loginF = document.getElementById('login-form');
        if(loginF) loginF.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            AppIA.auth.signInWithEmailAndPassword(email, pass).catch(err => alert("Erro Login: " + err.message));
        });

        const regF = document.getElementById('register-form');
        if(regF) regF.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;
            AppIA.auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => {
                    AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({ 
                        name, email, requestDate: new Date().toISOString(), origin: "Consultoria IA" 
                    });
                })
                .catch(err => alert("Erro Registro: " + err.message));
        });

        const btnOut = document.getElementById('btn-logout');
        if(btnOut) btnOut.onclick = () => AppIA.auth.signOut();
        const btnOutP = document.getElementById('btn-logout-pending');
        if(btnOutP) btnOutP.onclick = () => AppIA.auth.signOut();

        const btnGen = document.getElementById('btn-generate-plan');
        if(btnGen) btnGen.onclick = AppIA.generatePlanWithAI;
        const btnAnalyze = document.getElementById('btn-analyze-progress');
        if(btnAnalyze) btnAnalyze.onclick = AppIA.analyzeProgressWithAI;
    },

    // --- 3. LISTENERS DE MODAIS ---
    setupModalListeners: () => {
        const closeBtn = document.getElementById('close-feedback-modal');
        const form = document.getElementById('feedback-form');
        const fileInput = document.getElementById('photo-upload-input');
        if(closeBtn) closeBtn.onclick = AppIA.closeFeedbackModal;
        if(form) form.addEventListener('submit', AppIA.handleFeedbackSubmit);
        if(fileInput) fileInput.addEventListener('change', AppIA.handlePhotoAnalysis);

        const btnLog = document.getElementById('btn-log-manual');
        const closeLog = document.getElementById('close-log-activity-modal');
        const formLog = document.getElementById('log-activity-form');
        if(btnLog) btnLog.onclick = AppIA.openLogActivityModal;
        if(closeLog) closeLog.onclick = AppIA.closeLogActivityModal;
        if(formLog) formLog.onsubmit = AppIA.handleLogActivitySubmit;

        const closeReport = document.getElementById('close-ia-report-modal');
        if(closeReport) closeReport.onclick = () => document.getElementById('ia-report-modal').classList.add('hidden');
    },

    // --- 4. ENGINE DE DATAS (O FIX CRÍTICO) ---
    // Resolve o conflito de "2025 12 10" vs "2025-11-30"
    parseDateScore: (dateStr) => {
        if (!dateStr) return 0;
        try {
            // 1. Limpeza: Troca espaços e pontos por hífen
            let s = dateStr.toString().trim().replace(/[\s\.]/g, '-');
            
            // 2. Detecção de formato BR (DD-MM-YYYY ou DD/MM/YYYY)
            // Se o primeiro número for dia (ex: 30-11-2025)
            if (s.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) {
                const p = s.split(/[\/-]/);
                return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
            }
            
            // 3. Formato ISO ou Banco (YYYY-MM-DD)
            return new Date(s).getTime();
        } catch (e) { return 0; }
    },

    // --- 5. RENDERIZAÇÃO DA LISTA ---
    loadWorkouts: () => {
        const list = document.getElementById('workout-list');
        if(!list) return;
        
        list.innerHTML = "<p style='text-align:center; padding:1rem;'>Carregando...</p>";
        
        // Busca tudo do banco
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).on('value', snapshot => {
            list.innerHTML = ""; 
            if(!snapshot.exists()) { 
                list.innerHTML = "<p style='text-align:center; padding:1rem; color:#666;'>Nenhum treino encontrado.</p>"; 
                return; 
            }
            
            // Converte para array para poder ordenar no braço
            let arr = [];
            snapshot.forEach(childSnapshot => {
                arr.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });

            // ORDENAÇÃO MANUAL ROBUSTA (Usa parseDateScore)
            // Ordem: Mais antigo -> Mais recente
            arr.sort((a,b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            // Renderiza (Prepend inverte visualmente: Recente no topo)
            arr.forEach(w => {
                try {
                    const card = AppIA.createWorkoutCard(w);
                    list.prepend(card); 
                } catch (err) { console.error("Erro render:", err); }
            });
        });
    },

    createWorkoutCard: (w) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        const status = (w.status || 'planejado').toLowerCase();
        const isDone = status.includes('realizado') || status.includes('concluido') || status.includes('feito');

        const deleteBtnHtml = `<button class="btn-delete" style="background:#ff4444; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; margin-right:5px;"><i class='bx bx-trash'></i></button>`;
        const actionButtonHtml = isDone ? 
            `<button class="btn-open-feedback" style="background:var(--primary-color); color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;"><i class='bx bx-edit'></i> Editar</button>` :
            `<button class="btn-open-feedback" style="background:var(--success-color); color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;"><i class='bx bx-check-circle'></i> Registrar</button>`;

        el.innerHTML = `
            <div class="workout-card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong style="font-size:1.1em;">${w.date}</strong> <span style="margin-left:5px; color:#555;">${w.title}</span></div>
                <span class="status-tag" style="background:${isDone ? '#28a745' : '#ffc107'}; color:${isDone?'white':'#333'}; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${isDone ? 'Concluído' : 'Planejado'}</span>
            </div>
            <div class="workout-card-body" style="margin-top:10px;">
                <p>${w.description || ''}</p>
                ${w.stravaData ? AppIA.createStravaDataDisplay(w.stravaData) : ''}
                ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; max-height:250px; object-fit:cover; margin-top:10px; border-radius:8px;">` : ''}
                ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; color:#666; margin-top:10px; background:#f9f9f9; padding:8px; border-left:3px solid #ccc;">" ${w.feedback} "</p>` : ''}
            </div>
            <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px; display:flex; justify-content:flex-end;">
                ${deleteBtnHtml} ${actionButtonHtml}
            </div>
        `;

        const btnFeed = el.querySelector('.btn-open-feedback');
        const btnDel = el.querySelector('.btn-delete');
        if(btnFeed) btnFeed.onclick = (e) => { e.stopPropagation(); AppIA.openFeedbackModal(w.id, w.title, w.date); };
        if(btnDel) btnDel.onclick = (e) => { e.stopPropagation(); AppIA.deleteWorkout(w.id); };
        el.onclick = (e) => { if (!e.target.closest('button')) AppIA.openFeedbackModal(w.id, w.title, w.date); };

        return el;
    },

    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';
        let mapLinkHtml = stravaData.mapLink ? `<p style="margin-top:5px;"><a href="${stravaData.mapLink}" target="_blank" style="color:#fc4c02; font-weight:bold; text-decoration:none;">🗺️ Ver no Strava</a></p>` : '';
        let splitsHtml = '';
        if (stravaData.splits && Array.isArray(stravaData.splits) && stravaData.splits.length > 0) {
            let rows = stravaData.splits.map(s => `<tr><td style="padding:2px 5px;">Km ${s.km}</td><td style="padding:2px 5px;"><strong>${s.pace}</strong></td><td style="color:#777; font-size:0.8em;">(${s.ele}m)</td></tr>`).join('');
            splitsHtml = `<div style="margin-top:10px; padding-top:5px; border-top:1px dashed #ccc; font-size:0.85rem; color:#555;"><strong style="display:block; margin-bottom:5px;">🏁 Parciais:</strong><table style="width:100%; border-collapse:collapse;">${rows}</table></div>`;
        }
        return `<fieldset class="strava-data-display" style="border:1px solid #fc4c02; background:#fff5f0; padding:10px; border-radius:5px; margin-top:10px;"><legend style="color:#fc4c02; font-weight:bold; font-size:0.9rem;"><img src="img/strava.png" alt="Strava" style="height:20px; vertical-align:middle; margin-right:5px;">Dados</legend><div style="font-family:monospace; font-weight:bold; font-size:1rem; color:#333;">Dist: ${stravaData.distancia||"N/A"} | Tempo: ${stravaData.tempo||"N/A"} | Pace: ${stravaData.ritmo||"N/A"}</div>${mapLinkHtml}${splitsHtml}</fieldset>`;
    },

    // --- 6. CÉREBRO IA: ANÁLISE ---
    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        const modal = document.getElementById('ia-report-modal');
        const content = document.getElementById('ia-report-content');
        
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Consultando histórico...";
        btn.disabled = true; loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            if(!snap.exists()) throw new Error("Sem treinos.");
            
            let history = [];
            snap.forEach(c => history.push(c.val()));
            
            // 1. PREPARAÇÃO DE DADOS (Correção da Ordem)
            const preparedHistory = history.map(w => {
                // Remove caracteres estranhos da data para a IA ler limpo
                let cleanDate = w.date.toString().replace(/ /g, '-').replace(/\./g, '-');
                
                return {
                    originalDate: w.date, // Para referência
                    sortKey: AppIA.parseDateScore(w.date), // Para ordenar
                    title: w.title,
                    isDone: (w.status || '').toLowerCase().includes('realizado') || (w.status || '').toLowerCase().includes('concluido'),
                    stats: w.stravaData ? `${w.stravaData.distancia} em ${w.stravaData.tempo}` : "Sem GPS",
                    feedback: w.feedback || ""
                };
            });

            // 2. ORDENAÇÃO MATEMÁTICA (Ascendente: Antigo -> Novo)
            preparedHistory.sort((a, b) => a.sortKey - b.sortKey);

            // 3. SELEÇÃO (Pega os últimos 15, independente de status)
            // A IA precisa ver os "planejados" recentes também para saber se você faltou.
            const lastWorkouts = preparedHistory.slice(-15);

            const todayStr = new Date().toLocaleDateString('pt-BR');
            
            const prompt = `
            ATUE COMO: Treinador de Corrida. HOJE: ${todayStr}.
            
            ABAIXO ESTÁ O HISTÓRICO DO ATLETA (Ordem Cronológica - O último é o mais recente):
            ${JSON.stringify(lastWorkouts, null, 2)}
            
            LEGENDA:
            - "isDone": true -> Treino CONCLUÍDO.
            - "isDone": false -> Treino PENDENTE ou FALTOSO.
            
            MISSÃO:
            1. Identifique o treino CONCLUÍDO mais recente (Verifique as datas de Dezembro com atenção).
            2. Se houver treinos em Dezembro marcados como "isDone": true, use-os como base.
            3. Analise o volume e a consistência.
            `;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            
            if(!r.ok) throw new Error("Erro na API da IA.");
            const json = await r.json();
            
            content.textContent = json.candidates[0].content.parts[0].text; 
            modal.classList.remove('hidden');

        } catch(e) { 
            alert("Erro na análise: " + e.message); 
        } finally { 
            btn.disabled = false; loading.classList.add('hidden'); 
        }
    },

    // --- 7. GERAÇÃO DE PLANILHA ---
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true; loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            let history = [];
            if(snap.exists()) snap.forEach(c => history.push(c.val()));
            
            const preparedHistory = history.map(w => ({
                date: w.date,
                sortKey: AppIA.parseDateScore(w.date),
                title: w.title,
                status: (w.status || '').toLowerCase().includes('realizado') ? "FEITO" : "PENDENTE"
            }));
            preparedHistory.sort((a, b) => a.sortKey - b.sortKey);
            
            const recent = preparedHistory.slice(-15);
            const todayStr = new Date().toISOString().split('T')[0];
            
            const prompt = `ATUE COMO: Treinador. HOJE: ${todayStr}. HISTÓRICO: ${JSON.stringify(recent)}. 
            TAREFA: Gere 3 treinos futuros a partir de amanhã.
            SAÍDA JSON: [ { "date": "YYYY-MM-DD", "title": "...", "description": "..." } ]`;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const json = await r.json();
            const text = json.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const newW = JSON.parse(text);

            const updates = {};
            newW.forEach(w => {
                const k = AppIA.db.ref().push().key;
                updates[`data/${AppIA.user.uid}/workouts/${k}`] = { ...w, status: 'planejado', createdBy: 'IA', createdAt: new Date().toISOString() };
            });
            await AppIA.db.ref().update(updates);
            alert("Planilha Atualizada!");
        } catch (e) { alert(e.message); } finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- 8. FUNÇÕES GERAIS ---
    deleteWorkout: async (workoutId) => {
        if(confirm("Apagar treino?")) {
            try { 
                await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${workoutId}`).remove(); 
                await AppIA.db.ref(`publicWorkouts/${workoutId}`).remove(); 
            } catch(e){ alert(e.message); }
        }
    },

    openFeedbackModal: (workoutId, title, originalDate) => {
        AppIA.modalState.currentWorkoutId = workoutId;
        document.getElementById('feedback-modal-title').textContent = title || "Treino";
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('workout-feedback-text').value = ''; 
        document.getElementById('photo-upload-input').value = null;
        const stravaDisplay = document.getElementById('strava-data-display');
        if(stravaDisplay) stravaDisplay.classList.add('hidden');
        document.getElementById('feedback-modal').classList.remove('hidden');
        
        const form = document.getElementById('feedback-form');
        if (!document.getElementById('feedback-date-realized')) {
            const d = document.createElement('div'); d.className = 'form-group';
            d.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:5px;">Data Realizada</label><input type="date" id="feedback-date-realized" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">`;
            const s = form.querySelector('.form-group'); s.parentNode.insertBefore(d, s.nextSibling);
        }
        
        // Usa parseDateScore para garantir data válida no input, depois converte para YYYY-MM-DD
        const ts = AppIA.parseDateScore(originalDate);
        const dateObj = ts ? new Date(ts) : new Date();
        const dateInputVal = dateObj.toISOString().split('T')[0];
        document.getElementById('feedback-date-realized').value = dateInputVal;
    },
    
    closeFeedbackModal: (e) => { if(e) e.preventDefault(); document.getElementById('feedback-modal').classList.add('hidden'); },
    
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-feedback-btn');
        btn.textContent = "Salvando..."; btn.disabled = true;
        try {
            const updates = {
                status: document.getElementById('workout-status').value,
                feedback: document.getElementById('workout-feedback-text').value,
                date: document.getElementById('feedback-date-realized').value,
                realizadoAt: new Date().toISOString()
            };
            const file = document.getElementById('photo-upload-input').files[0];
            if(file) {
                const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
                const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
                const d = await r.json(); updates.imageUrl = d.secure_url;
            }
            if(AppIA.stravaData) updates.stravaData = AppIA.stravaData;
            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${AppIA.modalState.currentWorkoutId}`).update(updates);
            AppIA.closeFeedbackModal(); alert("Salvo!");
        } catch(err) { alert(err.message); } finally { btn.textContent = "Salvar"; btn.disabled = false; }
    },

    handlePhotoAnalysis: async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const feedbackEl = document.getElementById('photo-upload-feedback'); feedbackEl.textContent = "Lendo...";
        try {
            const base64 = await AppIA.fileToBase64(file);
            const prompt = `Analise foto. JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }] })
            });
            const d = await r.json();
            const text = d.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);
            AppIA.stravaData = data; 
            const display = document.getElementById('strava-data-display');
            if(display) { display.classList.remove('hidden'); display.innerHTML = `<legend>Foto</legend><p>Dist: ${data.distancia} | Pace: ${data.ritmo}</p>`; }
            feedbackEl.textContent = "Ok!";
        } catch (err) { feedbackEl.textContent = "Erro leitura."; }
    },

    fileToBase64: (file) => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.onerror = j; reader.readAsDataURL(file); }),
    
    // --- 9. STRAVA CONNECT & CALLBACK ---
    checkStravaConnection: () => {
        AppIA.db.ref(`users/${AppIA.user.uid}/stravaAuth`).on('value', snapshot => {
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');
            if (snapshot.exists()) {
                if(btnConnect) btnConnect.classList.add('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
                if(status) status.textContent = "✅ Conectado.";
                if(btnSync) btnSync.onclick = () => { alert("Sincronizando..."); if(window.opener && window.opener.AppPrincipal) window.opener.AppPrincipal.handleStravaSyncActivities(); };
            } else {
                if(btnConnect) btnConnect.classList.remove('hidden');
                if(btnSync) btnSync.classList.add('hidden');
                if(status) status.textContent = "";
                if(btnConnect) btnConnect.onclick = () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.location.href.split('?')[0]}&approval_prompt=force&scope=read_all,activity:read_all`; };
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
        } catch(e) { alert("Erro Strava."); }
    },
    
    // --- 10. ATIVIDADE MANUAL ---
    openLogActivityModal: () => document.getElementById('log-activity-modal').classList.remove('hidden'),
    closeLogActivityModal: () => document.getElementById('log-activity-modal').classList.add('hidden'),
    
    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const data = { 
            date: document.getElementById('log-date').value, 
            title: document.getElementById('log-title').value, 
            description: document.getElementById('log-description').value, 
            status: 'realizado', 
            createdBy: 'MANUAL', 
            createdAt: new Date().toISOString() 
        };
        await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).push(data); 
        AppIA.closeLogActivityModal();
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);
