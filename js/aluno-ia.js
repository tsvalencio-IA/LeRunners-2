/* =================================================================== */
/* ALUNO IA - MÓDULO DE CONSULTORIA ONLINE (V28.0 - FULL UI + FIX)
/* CORREÇÃO: Lógica de data corrigida + UI Rica restaurada (Strava/Splits)
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

    setupAuthListeners: () => {
        const btnGen = document.getElementById('btn-generate-plan');
        if(btnGen) btnGen.onclick = AppIA.generatePlanWithAI;
        const btnAnalyze = document.getElementById('btn-analyze-progress');
        if(btnAnalyze) btnAnalyze.onclick = AppIA.analyzeProgressWithAI;
        
        const btnOut = document.getElementById('btn-logout');
        if(btnOut) btnOut.onclick = () => AppIA.auth.signOut();
    },

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

    // --- HELPER DE DATAS (O FIX DA ORDENAÇÃO) ---
    parseDateScore: (dateStr) => {
        if (!dateStr) return 0;
        // Se for YYYY-MM-DD (Padrão Banco)
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return new Date(dateStr).getTime();
        }
        // Se for DD/MM/YYYY (Padrão BR)
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [dia, mes, ano] = dateStr.split('/');
            return new Date(`${ano}-${mes}-${dia}`).getTime();
        }
        return new Date(dateStr).getTime();
    },

    isStatusCompleted: (status) => {
        if (!status) return false;
        const s = status.toString().toLowerCase().trim();
        const validos = ['realizado', 'concluido', 'concluído', 'feito', 'done', 'ok', 'realizado_parcial'];
        return validos.some(val => s.includes(val));
    },

    // --- FUNÇÃO EXCLUIR TREINO (RESTAURADA) ---
    deleteWorkout: async (workoutId) => {
        if(confirm("Tem certeza que deseja excluir este treino da sua planilha?")) {
            try {
                await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${workoutId}`).remove();
            } catch(e) {
                alert("Erro ao excluir: " + e.message);
            }
        }
    },

    // --- CÉREBRO IA: ANÁLISE DE PROGRESSO (COM DEBUG ALERT) ---
    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        const modal = document.getElementById('ia-report-modal');
        const content = document.getElementById('ia-report-content');
        
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Buscando histórico completo...";
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            if(!snap.exists()) throw new Error("Sem histórico de treinos.");
            
            let history = [];
            snap.forEach(c => history.push(c.val()));
            
            // 2. ORDENAÇÃO ROBUSTA
            history.sort((a, b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            // 3. FILTRAGEM
            const cleanHistory = history
                .filter(w => AppIA.isStatusCompleted(w.status))
                .map(w => ({
                    date: w.date,
                    title: w.title,
                    status: "CONCLUÍDO",
                    feedback: w.feedback || "Sem feedback",
                    distancia: w.stravaData ? w.stravaData.distancia : "N/A",
                    pace: w.stravaData ? w.stravaData.ritmo : "N/A"
                }));

            if (cleanHistory.length === 0) throw new Error("Nenhum treino marcado como REALIZADO encontrado.");

            const ultimosTreinos = cleanHistory.slice(-10);

            // DEBUG ALERT (Pode remover depois que confirmar que funcionou)
            const datasParaIA = ultimosTreinos.map(t => t.date).join(" | ");
            alert(`🔍 DEBUG: A IA vai analisar estas datas:\n${datasParaIA}`);

            const todayStr = new Date().toLocaleDateString('pt-BR');

            const prompt = `
            ATUE COMO: Treinador de Corrida. HOJE É: ${todayStr}.
            
            DADOS DO ATLETA (Do mais antigo para o mais recente):
            ${JSON.stringify(ultimosTreinos)}
            
            INSTRUÇÃO CRÍTICA: O último item da lista acima é o treino MAIS RECENTE do atleta.
            
            TAREFA:
            1. Confirme qual foi o último treino realizado.
            2. Analise o ritmo (Pace) e distância.
            3. Dê uma dica curta para amanhã.
            `;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) throw new Error("Erro Google API");
            const json = await r.json();
            const report = json.candidates[0].content.parts[0].text;

            content.textContent = report; 
            modal.classList.remove('hidden');

        } catch(e) {
            alert("Erro: " + e.message);
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    },

    // --- GERAÇÃO DE PLANILHA (IA) ---
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Gerando planilha...";
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            let history = [];
            if(snap.exists()) snap.forEach(c => history.push(c.val()));
            
            history.sort((a, b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            const recentHistory = history.slice(-15).map(w => ({
                date: w.date,
                title: w.title,
                status: AppIA.isStatusCompleted(w.status) ? "FEITO" : "PENDENTE",
                distancia: w.stravaData ? w.stravaData.distancia : "N/A"
            }));

            const todayStr = new Date().toISOString().split('T')[0];
            const prompt = `
                ATUE COMO: Treinador. HOJE: ${todayStr}.
                HISTÓRICO: ${JSON.stringify(recentHistory)}
                Gere 3 treinos futuros a partir de amanhã.
                SAÍDA APENAS JSON: [ { "date": "YYYY-MM-DD", "title": "Treino", "description": "Detalhes" } ]
            `;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const json = await r.json();
            const text = json.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const newWorkouts = JSON.parse(text);

            const updates = {};
            newWorkouts.forEach(workout => {
                const key = AppIA.db.ref().push().key;
                updates[`data/${AppIA.user.uid}/workouts/${key}`] = { ...workout, status: 'planejado', createdBy: 'IA', createdAt: new Date().toISOString() };
            });
            await AppIA.db.ref().update(updates);
            alert("Planilha Atualizada!");

        } catch (e) { alert("Erro IA: " + e.message); } 
        finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- FUNÇÕES DE UI / MODAIS / ARQUIVOS ---
    openFeedbackModal: (workoutId, title, originalDate) => {
        AppIA.modalState.currentWorkoutId = workoutId;
        document.getElementById('feedback-modal-title').textContent = title;
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('workout-feedback-text').value = ''; 
        document.getElementById('photo-upload-input').value = null;
        
        // Reset Strava Display no Modal
        const stravaDisplay = document.getElementById('strava-data-display');
        if(stravaDisplay) stravaDisplay.classList.add('hidden');

        document.getElementById('feedback-modal').classList.remove('hidden');
        
        // Input de Data Seguro
        const form = document.getElementById('feedback-form');
        if (!document.getElementById('feedback-date-realized')) {
            const d = document.createElement('div');
            d.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:5px;">Data de Realização</label><input type="date" id="feedback-date-realized" style="width:100%; margin-bottom:10px; padding:8px; border:1px solid #ccc; border-radius:4px;">`;
            const statusGroup = form.querySelector('.form-group');
            statusGroup.parentNode.insertBefore(d, statusGroup.nextSibling);
        }
        document.getElementById('feedback-date-realized').value = originalDate || new Date().toISOString().split('T')[0];
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
            AppIA.closeFeedbackModal();
            alert("Treino Salvo!");
        } catch(err) { alert(err.message); } finally { btn.textContent = "Salvar"; btn.disabled = false; }
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
            if(!r.ok) throw new Error("Erro API Google");
            const d = await r.json();
            const text = d.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);
            
            AppIA.stravaData = data; 
            const display = document.getElementById('strava-data-display');
            if(display) {
                display.classList.remove('hidden');
                display.innerHTML = `<legend>IA Vision</legend><p>Dist: ${data.distancia}</p><p>Tempo: ${data.tempo}</p><p>Pace: ${data.ritmo}</p>`;
            }
            feedbackEl.textContent = "Dados extraídos!";
        } catch (err) { feedbackEl.textContent = "Falha na leitura IA."; }
    },

    fileToBase64: (file) => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.onerror = j; reader.readAsDataURL(file); }),

    // --- UI RENDER (V28 - RESTAURADO VISUAL RICO) ---
    loadWorkouts: () => {
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).on('value', snapshot => {
            const list = document.getElementById('workout-list');
            if(!list) return;
            list.innerHTML = "";
            if(!snapshot.exists()) { list.innerHTML = "<p style='text-align:center; padding:1rem;'>Sem treinos.</p>"; return; }
            
            let arr = [];
            snapshot.forEach(s => arr.push({id: s.key, ...s.val()}));
            // ORDENAÇÃO CORRETA (SCORE)
            arr.sort((a,b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            arr.forEach(w => {
                const el = document.createElement('div');
                el.className = 'workout-card';
                const isDone = AppIA.isStatusCompleted(w.status);
                
                // Botões de Ação
                const deleteBtnHtml = `
                    <button class="btn-delete" style="background: #ff4444; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Excluir Treino">
                        <i class='bx bx-trash'></i>
                    </button>
                `;
                const actionButtonHtml = isDone ? 
                    `<button class="btn-open-feedback" style="background: var(--primary-color); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"><i class='bx bx-edit'></i> Editar</button>` :
                    `<button class="btn-open-feedback" style="background: var(--success-color); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"><i class='bx bx-check-circle'></i> Registrar</button>`;

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
                
                // Event Listeners
                const btnFeed = el.querySelector('.btn-open-feedback');
                const btnDel = el.querySelector('.btn-delete');

                if(btnFeed) btnFeed.onclick = (e) => { e.stopPropagation(); AppIA.openFeedbackModal(w.id, w.title, w.date); };
                if(btnDel) btnDel.onclick = (e) => { e.stopPropagation(); AppIA.deleteWorkout(w.id); };
                el.onclick = (e) => { if (!e.target.closest('button')) AppIA.openFeedbackModal(w.id, w.title, w.date); };

                list.prepend(el); // Mais recente no topo
            });
        });
    },

    // --- HELPER VISUAL STRAVA (V28 - RESTAURADO) ---
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

    // SISTEMA AUXILIAR
    checkStravaConnection: () => { /* ... */ },
    handleStravaCallback: (c) => { /* ... */ },
    
    // AVULSO
    openLogActivityModal: () => document.getElementById('log-activity-modal').classList.remove('hidden'),
    closeLogActivityModal: () => document.getElementById('log-activity-modal').classList.add('hidden'),
    handleLogActivitySubmit: async (e) => {
        e.preventDefault();
        const data = {
            date: document.getElementById('log-date').value,
            title: document.getElementById('log-title').value,
            description: document.getElementById('log-description').value,
            status: 'realizado',
            createdAt: new Date().toISOString()
        };
        await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).push(data);
        AppIA.closeLogActivityModal();
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);
