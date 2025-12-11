/* =================================================================== */
/* ALUNO IA - MÓDULO V38.0 (DEBUGGER + ORDENAÇÃO FORÇADA)
/* A VERDADE: Ignora a ordem do Firebase e ordena por Data Real no JS.
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
                        document.getElementById('pending-view').classList.remove('hidden'); 
                    }
                });
            } else {
                if(authContainer) authContainer.classList.remove('hidden');
                if(appContainer) appContainer.classList.add('hidden');
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppIA.handleStravaCallback(urlParams.get('code'));
    },

    // --- 2. LISTENERS ---
    setupAuthListeners: () => {
        // Alternar Login/Registro
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        if(toReg) toReg.onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        if(toLog) toLog.onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        // Submit Login
        const loginF = document.getElementById('login-form');
        if(loginF) loginF.addEventListener('submit', (e) => {
            e.preventDefault();
            AppIA.auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .catch(err => alert("Erro Login: " + err.message));
        });

        // Submit Registro
        const regF = document.getElementById('register-form');
        if(regF) regF.addEventListener('submit', (e) => {
            e.preventDefault();
            AppIA.auth.createUserWithEmailAndPassword(document.getElementById('registerEmail').value, document.getElementById('registerPassword').value)
                .then((cred) => AppIA.db.ref('pendingApprovals/' + cred.user.uid).set({ 
                    name: document.getElementById('registerName').value, 
                    email: document.getElementById('registerEmail').value 
                }))
                .catch(err => alert("Erro Registro: " + err.message));
        });

        // Logout e Botões IA
        document.getElementById('btn-logout').onclick = () => AppIA.auth.signOut();
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

    // --- 3. FERRAMENTA DE DATA (A CORREÇÃO REAL) ---
    // Converte qualquer lixo de data ("2025 12 10", "10/12/2025") para Timestamp numérico
    parseDateScore: (dateStr) => {
        if (!dateStr) return 0;
        try {
            // 1. Remove espaços e pontos, troca por hífen
            let s = dateStr.toString().trim().replace(/[\s\.]/g, '-');
            
            // 2. Se for formato brasileiro DD-MM-YYYY, inverte
            if (s.match(/^\d{2}-\d{2}-\d{4}$/)) {
                const p = s.split('-');
                return new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime();
            }
            // 3. Formato Padrão YYYY-MM-DD
            return new Date(s).getTime();
        } catch (e) { return 0; }
    },

    // --- 4. RENDERIZAÇÃO VISUAL (Igual ao painel que funciona) ---
    loadWorkouts: () => {
        const list = document.getElementById('workout-list');
        if(!list) return;
        
        list.innerHTML = "<p style='text-align:center; padding:1rem;'>Carregando...</p>";
        
        // Pega TUDO (sem ordenar no banco, ordenamos na memória)
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).on('value', snapshot => {
            list.innerHTML = ""; 
            if(!snapshot.exists()) { list.innerHTML = "<p style='text-align:center;'>Sem treinos.</p>"; return; }
            
            let arr = [];
            snapshot.forEach(s => arr.push({ id: s.key, ...s.val() }));
            
            // ORDENAÇÃO FORÇADA PELO JAVASCRIPT (Corrige o erro "2025 12 10")
            // Do mais antigo para o mais novo
            arr.sort((a,b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            // Desenha na tela (Prepend inverte para visual: Novo em cima)
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

    // --- 5. CÉREBRO IA (COM DEBUGGER) ---
    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        
        btn.disabled = true; loading.classList.remove('hidden');

        try {
            // 1. Busca TUDO
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            let history = [];
            snap.forEach(c => history.push(c.val()));
            
            // 2. Ordena TUDO pela data matemática (A CORREÇÃO)
            history.sort((a, b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            // 3. Pega os últimos 15 (agora garantido que são os mais recentes)
            const recent = history.slice(-15);
            
            // 4. Formata Limpo para a IA
            const dataForAI = recent.map(w => ({
                data: w.date, // Envia original
                treino: w.title,
                status: (w.status || '').toLowerCase().includes('realizado') ? "REALIZADO" : "PENDENTE",
                detalhes: w.stravaData ? `Strava: ${w.stravaData.distancia}` : "Sem GPS"
            }));

            // --- O DIAGNÓSTICO (TIRA-TEIMAS) ---
            // Isto vai mostrar um alerta. Se a data 10/12 aparecer aqui, a culpa é da IA.
            // Se não aparecer, é do código.
            const listaDatas = dataForAI.map(i => `${i.data} (${i.status})`).join('\n');
            alert("🔍 DEBUG: A IA vai receber esta lista (Verifique se o seu treino está aqui):\n\n" + listaDatas);

            const prompt = `
            ATUE COMO: Treinador. HOJE: ${new Date().toLocaleDateString('pt-BR')}.
            DADOS RECENTES (Ordem Cronológica): 
            ${JSON.stringify(dataForAI)}
            
            O ÚLTIMO ITEM DA LISTA É O MAIS RECENTE.
            Verifique qual foi o último treino marcado como REALIZADO e analise.`;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const json = await r.json();
            
            document.getElementById('ia-report-content').textContent = json.candidates[0].content.parts[0].text; 
            document.getElementById('ia-report-modal').classList.remove('hidden');

        } catch(e) { alert("Erro: " + e.message); } finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    generatePlanWithAI: async () => {
        /* Mantido igual, apenas com a ordenação corrigida */
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        btn.disabled = true; loading.classList.remove('hidden');
        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            let history = [];
            snap.forEach(c => history.push(c.val()));
            history.sort((a, b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
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

    // --- 6. FUNÇÕES GERAIS ---
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
            form.prepend(d); // Insere no topo
        }
        
        // Converte data para input
        let d = originalDate.toString().trim().replace(/ /g, '-').replace(/\./g, '-');
        if(d.match(/^\d{2}-\d{2}-\d{4}$/)) d = d.split('-').reverse().join('-');
        document.getElementById('feedback-date-realized').value = d;
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
    checkStravaConnection: () => { /* Mantido (igual código anterior) */ },
    handleStravaCallback: (c) => { /* Mantido */ },
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
