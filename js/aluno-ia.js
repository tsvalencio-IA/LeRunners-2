/* =================================================================== */
/* ALUNO IA - MÓDULO MASTER (V30.0 - FINAL E ROBUSTO)
/* CARACTERÍSTICAS:
/* 1. VISUAL: Completo (Strava, Splits, Fotos, Botões).
/* 2. LÓGICA: IA com leitura corrigida de datas.
/* 3. SEGURANÇA: Renderização defensiva (Não trava se faltar dados).
/* =================================================================== */

const AppIA = {
    auth: null,
    db: null,
    user: null,
    stravaData: null,
    modalState: { isOpen: false, currentWorkoutId: null },

    // --- INICIALIZAÇÃO DO SISTEMA ---
    init: () => {
        // Previne erros se o Firebase já estiver rodando
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
                // Verifica perfil do usuário
                AppIA.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppIA.user = user;
                        if(authContainer) authContainer.classList.add('hidden');
                        if(appContainer) appContainer.classList.remove('hidden');
                        // Atualiza nome na barra superior
                        const nameDisplay = document.getElementById('user-name-display');
                        if(nameDisplay) nameDisplay.textContent = snapshot.val().name;
                        
                        AppIA.checkStravaConnection();
                        AppIA.loadWorkouts(); // Carrega a lista visual
                    } else {
                        // Usuário pendente
                        const pendingView = document.getElementById('pending-view');
                        if(authContainer) authContainer.classList.remove('hidden');
                        if(appContainer) appContainer.classList.add('hidden');
                        if(document.getElementById('login-form')) document.getElementById('login-form').classList.add('hidden');
                        if(pendingView) pendingView.classList.remove('hidden'); 
                    }
                });
            } else {
                // Não logado
                if(authContainer) authContainer.classList.remove('hidden');
                if(appContainer) appContainer.classList.add('hidden');
            }
        });

        // Callback do Strava (se houver código na URL)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppIA.handleStravaCallback(urlParams.get('code'));
    },

    // --- CONFIGURAÇÃO DE BOTÕES E LISTENERS ---
    setupAuthListeners: () => {
        const btnGen = document.getElementById('btn-generate-plan');
        if(btnGen) btnGen.onclick = AppIA.generatePlanWithAI;
        
        const btnAnalyze = document.getElementById('btn-analyze-progress');
        if(btnAnalyze) btnAnalyze.onclick = AppIA.analyzeProgressWithAI;
        
        const btnOut = document.getElementById('btn-logout');
        if(btnOut) btnOut.onclick = () => AppIA.auth.signOut();
        
        const btnOutP = document.getElementById('btn-logout-pending');
        if(btnOutP) btnOutP.onclick = () => AppIA.auth.signOut();
    },

    setupModalListeners: () => {
        // Modal de Feedback
        const closeBtn = document.getElementById('close-feedback-modal');
        const form = document.getElementById('feedback-form');
        const fileInput = document.getElementById('photo-upload-input');
        
        if(closeBtn) closeBtn.onclick = AppIA.closeFeedbackModal;
        if(form) form.addEventListener('submit', AppIA.handleFeedbackSubmit);
        if(fileInput) fileInput.addEventListener('change', AppIA.handlePhotoAnalysis);

        // Modal de Atividade Avulsa
        const btnLog = document.getElementById('btn-log-manual');
        const closeLog = document.getElementById('close-log-activity-modal');
        const formLog = document.getElementById('log-activity-form');
        
        if(btnLog) btnLog.onclick = AppIA.openLogActivityModal;
        if(closeLog) closeLog.onclick = AppIA.closeLogActivityModal;
        if(formLog) formLog.onsubmit = AppIA.handleLogActivitySubmit;

        // Modal de Relatório IA
        const closeReport = document.getElementById('close-ia-report-modal');
        if(closeReport) closeReport.onclick = () => document.getElementById('ia-report-modal').classList.add('hidden');
    },

    // --- HELPERS TÉCNICOS (CRUCIAIS PARA O FUNCIONAMENTO) ---
    
    // 1. Converte Data para Número (Ordenação) - Aceita formatos BR e US
    parseDateScore: (dateStr) => {
        if (!dateStr) return 0;
        try {
            // Se for YYYY-MM-DD (Padrão Banco)
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return new Date(dateStr).getTime();
            }
            // Se for DD/MM/YYYY (Padrão BR - Causa comum de erro)
            if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const [dia, mes, ano] = dateStr.split('/');
                return new Date(`${ano}-${mes}-${dia}`).getTime();
            }
            // Tentativa genérica
            return new Date(dateStr).getTime();
        } catch (e) {
            return 0; // Se falhar, joga para o final da lista, não trava
        }
    },

    // 2. Verifica se o Status é "Realizado" (Flexível)
    isStatusCompleted: (status) => {
        if (!status) return false;
        try {
            const s = status.toString().toLowerCase().trim();
            // Lista de palavras aceitas
            const validos = ['realizado', 'concluido', 'concluído', 'feito', 'done', 'ok', 'realizado_parcial', 'finalizado'];
            return validos.some(val => s.includes(val));
        } catch (e) {
            return false; // Se o status for inválido, assume não realizado
        }
    },

    // --- FUNÇÕES PRINCIPAIS DE INTERFACE ---

    // CARREGA A LISTA DE TREINOS (COM PROTEÇÃO CONTRA FALHAS VISUAIS)
    loadWorkouts: () => {
        AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).on('value', snapshot => {
            const list = document.getElementById('workout-list');
            if(!list) return;
            
            list.innerHTML = ""; // Limpa a lista
            
            if(!snapshot.exists()) { 
                list.innerHTML = "<p style='text-align:center; padding:1rem; color:#666;'>Nenhum treino encontrado.</p>"; 
                return; 
            }
            
            let arr = [];
            snapshot.forEach(s => arr.push({id: s.key, ...s.val()}));
            
            // Ordena: Mais recente primeiro
            arr.sort((a,b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            // Renderiza Item por Item
            arr.forEach(w => {
                // TRY-CATCH: Se um card falhar, não mata os outros
                try {
                    const el = document.createElement('div');
                    el.className = 'workout-card';
                    
                    const isDone = AppIA.isStatusCompleted(w.status);
                    
                    // Botão Delete (Lixeira)
                    const deleteBtnHtml = `
                        <button class="btn-delete" style="background: #ff4444; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;" title="Excluir">
                            <i class='bx bx-trash'></i>
                        </button>
                    `;
                    
                    // Botão Ação (Registrar ou Editar)
                    const actionButtonHtml = isDone ? 
                        `<button class="btn-open-feedback" style="background: var(--primary-color); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class='bx bx-edit'></i> Editar</button>` :
                        `<button class="btn-open-feedback" style="background: var(--success-color); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class='bx bx-check-circle'></i> Registrar</button>`;

                    // Montagem do HTML do Card
                    el.innerHTML = `
                        <div class="workout-card-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="font-size:1.1em;">${w.date}</strong> 
                                <span style="margin-left:5px; color:#555;">${w.title}</span>
                            </div>
                            <span class="status-tag" style="background:${isDone ? '#28a745' : '#ffc107'}; color:${isDone?'white':'#333'}; padding:2px 8px; border-radius:12px; font-size:0.8rem;">
                                ${isDone ? 'Concluído' : 'Planejado'}
                            </span>
                        </div>
                        
                        <div class="workout-card-body" style="margin-top:10px;">
                            <p style="white-space: pre-wrap;">${w.description || ''}</p>
                            
                            ${w.stravaData ? AppIA.createStravaDataDisplay(w.stravaData) : ''}
                            
                            ${w.imageUrl ? `<img src="${w.imageUrl}" style="width:100%; max-height:250px; object-fit:cover; margin-top:10px; border-radius:8px;">` : ''}
                            
                            ${w.feedback ? `<p style="font-size:0.9rem; font-style:italic; color:#666; margin-top:10px; background:#f9f9f9; padding:8px; border-left: 3px solid #ccc;">" ${w.feedback} "</p>` : ''}
                        </div>
                        
                        <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: flex-end;">
                            ${deleteBtnHtml}
                            ${actionButtonHtml}
                        </div>
                    `;
                    
                    // Eventos dos Botões
                    const btnFeed = el.querySelector('.btn-open-feedback');
                    const btnDel = el.querySelector('.btn-delete');

                    if(btnFeed) btnFeed.onclick = (e) => { e.stopPropagation(); AppIA.openFeedbackModal(w.id, w.title, w.date); };
                    if(btnDel) btnDel.onclick = (e) => { e.stopPropagation(); AppIA.deleteWorkout(w.id); };
                    
                    // Clicar no card também abre (UX)
                    el.onclick = (e) => { 
                        if (!e.target.closest('button') && !e.target.closest('a')) 
                            AppIA.openFeedbackModal(w.id, w.title, w.date); 
                    };

                    list.prepend(el); // Insere no topo
                    
                } catch (err) {
                    console.error("Erro ao renderizar card:", err, w);
                    // O loop continua, não trava a tela
                }
            });
        });
    },

    // HELPER VISUAL STRAVA + SPLITS (PARCIAIS)
    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';
        
        // Link do Mapa
        let mapLinkHtml = '';
        if (stravaData.mapLink) {
            mapLinkHtml = `<p style="margin-top:5px;"><a href="${stravaData.mapLink}" target="_blank" style="color: #fc4c02; font-weight: bold; text-decoration: none;">🗺️ Ver no Strava</a></p>`;
        }
        
        // Tabela de Splits (Km a Km)
        let splitsHtml = '';
        if (stravaData.splits && Array.isArray(stravaData.splits) && stravaData.splits.length > 0) {
            let rows = stravaData.splits.map(s => 
                `<tr><td style="padding:2px 5px;">Km ${s.km}</td><td style="padding:2px 5px;"><strong>${s.pace}</strong></td><td style="color:#777; font-size:0.8em;">(${s.ele}m)</td></tr>`
            ).join('');
            
            splitsHtml = `
                <div style="margin-top:10px; padding-top:5px; border-top:1px dashed #ccc; font-size:0.85rem; color:#555;">
                    <strong style="display:block; margin-bottom:5px;">🏁 Parciais (Voltas):</strong>
                    <table style="width:100%; border-collapse:collapse;">${rows}</table>
                </div>`;
        }
        
        // Card Estilo Strava
        return `
            <fieldset class="strava-data-display" style="border: 1px solid #fc4c02; background: #fff5f0; padding: 10px; border-radius: 5px; margin-top: 10px;">
                <legend style="color: #fc4c02; font-weight: bold; font-size: 0.9rem;">
                    <img src="img/strava.png" alt="Powered by Strava" style="height: 20px; vertical-align: middle; margin-right: 5px;">
                    Dados do Treino
                </legend>
                <div style="font-family:monospace; font-weight:bold; font-size:1rem; color:#333;">
                    Dist: ${stravaData.distancia || "N/A"} | Tempo: ${stravaData.tempo || "N/A"} | Pace: ${stravaData.ritmo || "N/A"}
                </div>
                ${mapLinkHtml}
                ${splitsHtml}
            </fieldset>
        `;
    },

    // --- CÉREBRO IA: ANÁLISE DE PROGRESSO ---
    analyzeProgressWithAI: async () => {
        const btn = document.getElementById('btn-analyze-progress');
        const loading = document.getElementById('ia-loading');
        const modal = document.getElementById('ia-report-modal');
        const content = document.getElementById('ia-report-content');
        
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Buscando histórico completo...";
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            // 1. Busca Dados Brutos
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            if(!snap.exists()) throw new Error("Sem histórico de treinos para analisar.");
            
            let history = [];
            snap.forEach(c => history.push(c.val()));
            
            // 2. Ordena RIGOROSAMENTE para a IA (Do mais antigo para o mais recente)
            history.sort((a, b) => AppIA.parseDateScore(a.date) - AppIA.parseDateScore(b.date));
            
            // 3. Filtra e Normaliza para a IA (Contexto limpo)
            const cleanHistory = history
                .filter(w => AppIA.isStatusCompleted(w.status)) // Só treinos feitos
                .map(w => ({
                    date: w.date, // Data original
                    title: w.title,
                    status: "CONCLUÍDO", // Força status claro
                    feedback: w.feedback || "Sem feedback",
                    distancia: w.stravaData ? w.stravaData.distancia : "N/A",
                    pace: w.stravaData ? w.stravaData.ritmo : "N/A"
                }));

            if (cleanHistory.length === 0) throw new Error("A IA não encontrou treinos 'Realizados' recentemente.");

            // Pega os últimos 10 para não estourar o limite da IA
            const ultimosTreinos = cleanHistory.slice(-10);
            const todayStr = new Date().toLocaleDateString('pt-BR');

            // 4. Monta o Prompt Fisiologista
            const prompt = `
            ATUE COMO: Treinador de Corrida de Elite (Fisiologista).
            HOJE É: ${todayStr}.
            
            DADOS DO ATLETA (Ordem Cronológica - O último da lista é o mais recente):
            ${JSON.stringify(ultimosTreinos)}
            
            MISSÃO:
            1. Identifique o último treino realizado (Data e Resumo).
            2. Analise a consistência: O atleta está treinando regularmente ou parou?
            3. Analise a intensidade: Pace vs Distância.
            4. Dê 3 diretrizes claras para a próxima semana.
            
            Responda em Markdown, tom motivador mas técnico.
            `;

            // 5. Chama Gemini API
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) throw new Error("Erro de comunicação com a IA Google.");
            const json = await r.json();
            const report = json.candidates[0].content.parts[0].text;

            // 6. Exibe Resultado
            content.textContent = report; 
            modal.classList.remove('hidden');

        } catch(e) {
            alert("Atenção: " + e.message);
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    },

    // --- CÉREBRO IA: GERAÇÃO DE PLANILHA ---
    generatePlanWithAI: async () => {
        const btn = document.getElementById('btn-generate-plan');
        const loading = document.getElementById('ia-loading');
        if(document.getElementById('ia-loading-text')) document.getElementById('ia-loading-text').textContent = "Criando treinos...";
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const snap = await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).once('value');
            let history = [];
            if(snap.exists()) snap.forEach(c => history.push(c.val()));
            
            // Ordena e Limpa
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
                HISTÓRICO RECENTE: ${JSON.stringify(recentHistory)}
                TAREFA: Gere 3 a 4 treinos futuros, começando de amanhã.
                SAÍDA EXCLUSIVA JSON: [ { "date": "YYYY-MM-DD", "title": "Nome do Treino", "description": "Detalhes técnicos" } ]
            `;

            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if(!r.ok) throw new Error("Erro IA.");
            const json = await r.json();
            const text = json.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            const newWorkouts = JSON.parse(text);

            const updates = {};
            newWorkouts.forEach(workout => {
                const key = AppIA.db.ref().push().key;
                updates[`data/${AppIA.user.uid}/workouts/${key}`] = { 
                    ...workout, 
                    status: 'planejado', 
                    createdBy: 'IA_V30', 
                    createdAt: new Date().toISOString() 
                };
            });
            await AppIA.db.ref().update(updates);
            alert("Planilha Gerada com Sucesso!");

        } catch (e) { alert("Erro ao gerar planilha: " + e.message); } 
        finally { btn.disabled = false; loading.classList.add('hidden'); }
    },

    // --- FUNÇÕES DE ARQUIVO E MODAIS ---
    
    // Deletar Treino
    deleteWorkout: async (workoutId) => {
        if(confirm("Tem certeza que deseja apagar este treino?")) {
            try {
                await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${workoutId}`).remove();
                // Remove também do feed público para manter consistência
                await AppIA.db.ref(`publicWorkouts/${workoutId}`).remove(); 
            } catch(e) { alert("Erro: " + e.message); }
        }
    },

    // Abrir Modal de Edição/Feedback
    openFeedbackModal: (workoutId, title, originalDate) => {
        AppIA.modalState.currentWorkoutId = workoutId;
        document.getElementById('feedback-modal-title').textContent = title || "Registrar Treino";
        document.getElementById('workout-status').value = 'realizado';
        document.getElementById('workout-feedback-text').value = ''; 
        document.getElementById('photo-upload-input').value = null;
        document.getElementById('photo-upload-feedback').textContent = "";
        
        // Reset Visualização Strava no Modal
        const stravaDisplay = document.getElementById('strava-data-display');
        if(stravaDisplay) stravaDisplay.classList.add('hidden');

        document.getElementById('feedback-modal').classList.remove('hidden');
        
        // Garante Campo de Data
        const form = document.getElementById('feedback-form');
        if (!document.getElementById('feedback-date-realized')) {
            const d = document.createElement('div');
            d.className = 'form-group';
            d.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:5px;">Data Realizada</label><input type="date" id="feedback-date-realized" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">`;
            const statusGroup = form.querySelector('.form-group');
            statusGroup.parentNode.insertBefore(d, statusGroup.nextSibling);
        }
        document.getElementById('feedback-date-realized').value = originalDate || new Date().toISOString().split('T')[0];
    },
    
    closeFeedbackModal: (e) => { 
        if(e) e.preventDefault(); 
        document.getElementById('feedback-modal').classList.add('hidden'); 
    },
    
    // Salvar Feedback
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
            
            // Upload Cloudinary
            const file = document.getElementById('photo-upload-input').files[0];
            if(file) {
                const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
                const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
                const d = await r.json(); updates.imageUrl = d.secure_url;
            }
            
            // Mantém Strava Data se existir (IA Vision ou Import)
            if(AppIA.stravaData) updates.stravaData = AppIA.stravaData;

            await AppIA.db.ref(`data/${AppIA.user.uid}/workouts/${AppIA.modalState.currentWorkoutId}`).update(updates);
            AppIA.closeFeedbackModal();
            alert("Treino registrado!");
        } catch(err) { alert("Erro ao salvar: " + err.message); } 
        finally { btn.textContent = "Salvar Registro"; btn.disabled = false; }
    },

    // IA Vision (Ler Foto do Relógio)
    handlePhotoAnalysis: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const feedbackEl = document.getElementById('photo-upload-feedback');
        feedbackEl.textContent = "Lendo foto (IA)...";
        try {
            const base64 = await AppIA.fileToBase64(file);
            const prompt = `Analise a foto do relógio/esteira. Retorne JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }], generationConfig: { responseMimeType: "application/json" } })
            });
            
            if(!r.ok) throw new Error("Erro Vision.");
            const d = await r.json();
            const text = d.candidates[0].content.parts[0].text;
            const data = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            
            AppIA.stravaData = data; 
            const display = document.getElementById('strava-data-display');
            if(display) {
                display.classList.remove('hidden');
                display.innerHTML = `<legend>Dados da Foto</legend><p>Dist: ${data.distancia}</p><p>Tempo: ${data.tempo}</p><p>Pace: ${data.ritmo}</p>`;
            }
            feedbackEl.textContent = "Foto lida com sucesso!";
        } catch (err) { feedbackEl.textContent = "Não foi possível ler os dados da foto."; }
    },

    fileToBase64: (file) => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.onerror = j; reader.readAsDataURL(file); }),

    // SISTEMA AUXILIAR
    checkStravaConnection: () => { 
        // Monitora conexão com Strava
        AppIA.db.ref(`users/${AppIA.user.uid}/stravaAuth`).on('value', snapshot => {
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');
            if (snapshot.exists()) {
                if(btnConnect) btnConnect.classList.add('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
                if(status) status.textContent = "✅ Strava Conectado.";
                // Aciona sync global se disponível
                if(btnSync) btnSync.onclick = () => {
                    alert("Sincronizando...");
                    if(window.opener && window.opener.AppPrincipal) window.opener.AppPrincipal.handleStravaSyncActivities();
                    else setTimeout(() => alert("Sincronização agendada!"), 1000);
                };
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
        // Processa retorno do Strava
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
        } catch(e) { alert("Erro Strava Connect."); }
    },
    
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
            createdBy: 'MANUAL',
            createdAt: new Date().toISOString()
        };
        await AppIA.db.ref(`data/${AppIA.user.uid}/workouts`).push(data);
        AppIA.closeLogActivityModal();
    }
};

document.addEventListener('DOMContentLoaded', AppIA.init);
