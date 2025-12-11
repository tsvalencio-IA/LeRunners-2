/* =================================================================== */
/* ALUNO IA - MÓDULO V42.0 (ARQUITETURA ESPELHO)
/* GARANTIA: A IA lê da memória visual, não do banco. Se aparece na tela, a IA vê.
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    stravaData: null,
    // NOVO: Cache de memória para garantir que a IA veja o mesmo que o usuário
    workoutsCache: [], 
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
                        document.getElementById('user-name-display').textContent = snapshot.val().name;
                        
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

    // --- 2. LISTENERS ---
    setupAuthListeners: () => {
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        if(toReg) toReg.onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        if(toLog) toLog.onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        const loginF = document.getElementById('login-form');
        if(loginF) loginF.addEventListener('submit', (e) => {
            e.preventDefault();
            AppIA.auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .catch(err => alert("Erro Login: " + err.message));
        });

        const regF = document.getElementById('register-form');
        if(regF) regF.addEventListener('submit', (e) => {
            e.preventDefault();
            AppIA.auth.createUserWithEmailAndPassword(document.getElementById('registerEmail').value, document.getElementById('registerPassword').value)
                .then((cred) => AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({ name: document.getElementById('registerName').value, email: document.getElementById('registerEmail').value }))
                .catch(err => alert("Erro Registro: " + err.message));
        });

        document.getElementById('btn-logout').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppIA.auth.signOut();
        document.getElementById('btn-generate-plan').onclick = AppIA.generatePlanWithAI;
        document.getElementById('btn-analyze-progress').onclick = AppIA.analyzeProgressWithAI;
    },

    setupModalListeners: () => {
        document.getElementById('close-feedback-modal').onclick = AppIA.closeFeedbackModal;
        document.getElementById('feedback-form').addEventListener('submit', AppIA.handleFeedbackSubmit);
        document.getElementById('photo-upload-input').addEventListener('change', AppIA.handlePhotoAnalysis);
        
        document.getElementById('btn-log-manual').onclick = AppIA.openLogActivityModal;
        document.getElementById('close-log-activity-modal').onclick = AppIA.closeLogActivityModal;
        document.getElementById('log-activity-form').onsubmit = AppIA.handleLogActivitySubmit;
        
        document.getElementById('close-ia-report-modal').onclick = () => document.getElementById('ia-report-modal').classList.add('hidden');
    },

    // --- 3. DATA ENGINE (ROBUSTO) ---
    getTimestamp: (dateStr) => {
        if (!dateStr) return 0;
        try {
            let s = dateStr.toString().trim().replace(/[\s\.]/g, '-');
            if (s.match(/^\d{2}[\/-]\d{2}[\/-]\d{4}$/)) {
                const p = s.split(/[\/-]/);
                return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
            }
            return new Date(s).getTime();
        } catch (e) { return 0; }
    },
    
    getReadableDate: (dateStr) => {
        let ts = AppIA.getTimestamp(dateStr);
        return ts ? new Date(ts).toLocaleDateString('pt-BR') : dateStr;
    },

    // --- 4. RENDERIZAÇÃO + CACHE (A MÁGICA ACONTECE AQUI) ---
    loadWorkouts: () => {
        const list = document.getElementById('workout-list');
        if(!list) return;
        
        list.innerHTML = "<p style='text-align:center; padding:1rem;'>Carregando...</p>";
        
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).on('value', snapshot => {
            list.innerHTML = ""; 
            // 1. Limpa o Cache da IA
            AppIA.workoutsCache = []; 
            
            if(!snapshot.exists()) { 
                list.innerHTML = "<p style='text-align:center;'>Nenhum treino.</p>"; 
                return; 
            }
            
            let arr = [];
            snapshot.forEach(childSnapshot => {
                arr.push({ id: childSnapshot.key, ...childSnapshot.val() });
            });

            // Ordena
            arr.sort((a,b) => AppIA.getTimestamp(a.date) - AppIA.getTimestamp(b.date));
            
            // 2. Popula o Cache (Cópia exata do que vai pra tela)
            AppIA.workoutsCache = arr;

            // Renderiza na tela
            arr.forEach(w => {
                const card = AppIA.createWorkoutCard(w);
                list.prepend(card); 
            });
        });
    },

    createWorkoutCard: (w) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        const s = (w.status || 'planejado').toLowerCase();
        const isDone = s.includes('realizado') || s.includes('concluido') || s.includes('feito');

        const btnHtml = isDone ? 
            `<button class="btn-open-feedback" style="background:var(--primary-color); color:white; border:none; padding:6px 10px; border-radius:4px;"><i class='bx bx-edit'></i> Editar</button>` :
            `<button class="btn-open-feedback" style="background:var(--success-color); color:white; border:none; padding:6px 10px; border-radius:4px;"><i class='bx bx-check-circle'></i> Registrar</button>`;

        el.innerHTML = `
            <div class="workout-card-header">
                <div><strong style="font-size:1.1em;">${w.date}</strong> <span style="color:#555;">${w.title}</span></div>
                <span class="status-tag" style="background:${isDone ? '#28a745' : '#ffc107'}; color:${isDone?'white':'#333'}; padding:2px 8px; border-radius:12px; font-size:0.8rem;">${isDone ? 'Concluído' : 'Planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${w.description || ''}</p>
                ${w.stravaData ? AppIA.createStravaDataDisplay(w.stravaData) : ''}
                ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; margin-top:10px; border-radius:8px;">` : ''}
                ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; background:#f9f9f9; padding:8px;">"${w.feedback}"</p>` : ''}
            </div>
            <div style="margin-top:10px; display:flex; justify-content:flex-end; gap:5px;">
                <button class="btn-delete" style="background:#ff4444; color:white; border:none; padding:6px 10px; border-radius:4px;"><i class='bx bx-trash'></i></button>
                ${btnHtml}
            </div>
        `;

        el.querySelector('.btn-open-feedback').onclick = (e) => { e.stopPropagation(); AppIA.openFeedbackModal(w.id, w.title, w.date); };
        el.querySelector('.btn-delete').onclick = (e) => { e.stopPropagation(); AppIA.deleteWorkout(w.id); };
        el.onclick = (e) => { if (!e.target.closest('button')) AppIA.openFeedbackModal(w.id, w.title, w.date); };
        return el;
    },

    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';
        let splits = '';
        if (stravaData.splits) {
            splits = stravaData.splits.map(s => `<tr><td>${s.km}</td><td>${s.pace}</td></tr>`).join('');
            splits = `<table style="width:100%; font-size:0.8rem;">${splits}</table>`;
        }
        return `<fieldset style="background:#fff5f0; border:1px solid #fc4c02; padding:10px; margin-top:10px;"><legend style="color:#fc4c02; font-weight:bold;"><img src="img/strava.png" height="20"> Strava</legend><div>Dist: ${stravaData.distancia} | Pace: ${stravaData.ritmo}</div>${splits}</fieldset>`;
    },

    // --- 5. CÉREBRO IA: ANÁLISE (LÊ DO CACHE, NÃO DO BANCO) ---
    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        
        btn.disabled = true; loading.classList.remove('hidden');

        try {
            // AQUI É A MUDANÇA: Usamos o Cache que já está carregado na tela
            // Se aparece na tela, está no workoutsCache.
            let history = AppIA.workoutsCache;

            if (!history || history.length === 0) throw new Error("A lista de treinos parece vazia na tela.");

            // Ordena (Garante Antigo -> Novo)
            history.sort((a,b) => AppIA.getTimestamp(a.date) - AppIA.getTimestamp(b.date));

            // Pega os últimos 15
            const lastWorkouts = history.slice(-15).map(w => {
                let status = (w.status || '').toLowerCase();
                let isDone = status.includes('realizado') || status.includes('concluido');
                return {
                    data: AppIA.getReadableDate(w.date),
                    treino: w.title,
                    isDone: isDone,
                    feedback: w.feedback || "",
                    strava: w.stravaData ? w.stravaData.distancia : "N/A"
                };
            });

            // DEBUG: Confirme que 10/12 aparece aqui
            const debugText = lastWorkouts.map(w => `[${w.data}] ${w.treino} (${w.isDone?'FEITO':'PENDENTE'})`).join('\n');
            alert(`🔍 IA VAI LER DA TELA:\n\n${debugText}`);

            const todayStr = new Date().toLocaleDateString('pt-BR');
            const prompt = `ATUE COMO: Treinador. HOJE: ${todayStr}. 
            DADOS REAIS (Lidos da tela do aluno): ${JSON.stringify(lastWorkouts)}.
            O ÚLTIMO DA LISTA É O MAIS RECENTE.
            MISSÃO: Identifique o último treino FEITO e analise.`;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const json = await r.json();
            document.getElementById('ia-report-content').textContent = json.candidates[0].content.parts[0].text; 
            document.getElementById('ia-report-modal').classList.remove('hidden');

        } catch(e) { alert("Erro: " + e.message); } finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- 6. GERAÇÃO DE PLANILHA ---
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true; loading.classList.remove('hidden');
        try {
            // Usa o cache aqui também para consistência
            let history = AppIA.workoutsCache;
            const recent = history.slice(-15).map(w => ({ date: w.date, title: w.title }));
            
            const prompt = `ATUE COMO: Treinador. HISTÓRICO: ${JSON.stringify(recent)}. Gere 3 treinos futuros. SAÍDA JSON: [ { "date": "YYYY-MM-DD", "title": "...", "description": "..." } ]`;

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
            alert("Planilha Criada!");
        } catch (e) { alert(e.message); } finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- 7. FUNÇÕES GERAIS ---
    deleteWorkout: async (workoutId) => {
        if(confirm("Apagar?")) {
            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${workoutId}`).remove();
            await AppIA.db.ref(`publicWorkouts/${workoutId}`).remove();
        }
    },

    openFeedbackModal: (workoutId, title, originalDate) => {
        AppIA.modalState.currentWorkoutId = workoutId;
        document.getElementById('feedback-modal-title').textContent = title;
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('photo-upload-input').value = null;
        document.getElementById('strava-data-display').classList.add('hidden');
        document.getElementById('feedback-modal').classList.remove('hidden');
        
        const form = document.getElementById('feedback-form');
        if (!document.getElementById('feedback-date-realized')) {
            const d = document.createElement('div'); d.className = 'form-group';
            d.innerHTML = `<label>Data Realizada</label><input type="date" id="feedback-date-realized" style="width:100%;">`;
            form.prepend(d); 
        }
        
        const ts = AppIA.getTimestamp(originalDate);
        const iso = ts ? new Date(ts).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        document.getElementById('feedback-date-realized').value = iso;
    },
    
    closeFeedbackModal: () => document.getElementById('feedback-modal').classList.add('hidden'),
    
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-feedback-btn'); btn.disabled = true;
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
            document.getElementById('feedback-modal').classList.add('hidden');
            alert("Salvo!");
        } catch(err) { alert(err.message); } finally { btn.disabled = false; }
    },

    handlePhotoAnalysis: async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
            const base64 = await new Promise((r,j)=>{const d=new FileReader();d.onload=()=>r(d.result.split(',')[1]);d.readAsDataURL(file)});
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({contents:[{parts:[{text:"Analise foto. JSON: {distancia, tempo, ritmo}"},{inlineData:{mimeType:file.type,data:base64}}]}]})
            });
            const d = await r.json();
            const text = d.candidates[0].content.parts[0].text.replace(/```json/g,'').replace(/```/g,'').trim();
            AppIA.stravaData = JSON.parse(text);
            const disp = document.getElementById('strava-data-display');
            disp.classList.remove('hidden');
            disp.innerHTML = `<legend>Foto</legend>${AppIA.stravaData.distancia}`;
        } catch(e) { alert("Erro IA"); }
    },

    // Strava e Manual
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
                if (user) { clearInterval(checkUser); const token = await user.getIdToken(); await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({code}) }); window.location.href = "aluno-ia.html"; }
            }, 500);
        } catch(e) { alert("Erro Strava."); }
    },
    
    openLogActivityModal: () => document.getElementById('log-activity-modal').classList.remove('hidden'),
    closeLogActivityModal: () => document.getElementById('log-activity-modal').classList.add('hidden'),
    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const data = { date: document.getElementById('log-date').value, title: document.getElementById('log-title').value, description: document.getElementById('log-description').value, status: 'realizado', createdBy: 'MANUAL', createdAt: new Date().toISOString() };
        await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).push(data); 
        document.getElementById('log-activity-modal').classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);
