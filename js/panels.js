/* =================================================================== */
/* ARQUIVO DE MÓDULOS (V7.2 - FINAL: IA FISIOLOGISTA & STRAVA COMPLIANCE)
/* =================================================================== */

// ===================================================================
// 3. AdminPanel (Lógica do Painel Coach)
// ===================================================================
const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V7.2: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'),
            
            // Abas
            tabPrescreverBtn: document.querySelector('[data-tab="prescrever"]'),
            tabKpisBtn: document.querySelector('[data-tab="kpis"]'),
            adminTabPrescrever: document.getElementById('admin-tab-prescrever'),
            adminTabKpis: document.getElementById('admin-tab-kpis'),
            
            // Conteúdo Aba 1 (Prescrição)
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list'),

            // Conteúdo Aba 2 (IA)
            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        // Bind de eventos (Com verificações básicas)
        if (AdminPanel.elements.addWorkoutForm)
            AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        
        if (AdminPanel.elements.athleteSearch)
            AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        
        if (AdminPanel.elements.deleteAthleteBtn)
            AdminPanel.elements.deleteAthleteBtn.addEventListener('click', AdminPanel.deleteAthlete);
        
        // Listeners Abas - Lógica Original V2 Restaurada
        if(AdminPanel.elements.tabPrescreverBtn) {
            AdminPanel.elements.tabPrescreverBtn.addEventListener('click', () => AdminPanel.switchTab('prescrever'));
        }
        
        if(AdminPanel.elements.tabKpisBtn) {
            AdminPanel.elements.tabKpisBtn.addEventListener('click', () => {
                AdminPanel.switchTab('kpis');
                // Força recarregamento ao clicar na aba (igual ao original)
                if(AdminPanel.state.selectedAthleteId) {
                    AdminPanel.loadIaHistory(AdminPanel.state.selectedAthleteId);
                }
            });
        }
        
        // Listener Botão IA
        if (AdminPanel.elements.analyzeAthleteBtnIa) {
            AdminPanel.elements.analyzeAthleteBtnIa.addEventListener('click', AdminPanel.handleAnalyzeAthleteIA);
        }
        
        // Carregar dados iniciais
        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
    },

    switchTab: (tabName) => {
        const { tabPrescreverBtn, tabKpisBtn, adminTabPrescrever, adminTabKpis } = AdminPanel.elements;
        const isPrescrever = (tabName === 'prescrever');
        
        if(tabPrescreverBtn) tabPrescreverBtn.classList.toggle('active', isPrescrever);
        if(adminTabPrescrever) adminTabPrescrever.classList.toggle('active', isPrescrever);
        
        if(tabKpisBtn) tabKpisBtn.classList.toggle('active', !isPrescrever);
        if(adminTabKpis) adminTabKpis.classList.toggle('active', !isPrescrever);
    },

    loadPendingApprovals: () => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals');
        AppPrincipal.state.listeners['adminPending'] = pendingRef;
        
        pendingRef.on('value', snapshot => {
            const { pendingList } = AdminPanel.elements;
            if(!pendingList) return;
            
            pendingList.innerHTML = "";
            if (!snapshot.exists()) {
                pendingList.innerHTML = "<p>Nenhuma solicitação pendente.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const uid = childSnapshot.key;
                const data = childSnapshot.val();
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.innerHTML = `
                    <div class="pending-item-info">
                        <strong>${data.name}</strong><br>
                        <span>${data.email}</span>
                    </div>
                    <div class="pending-item-actions">
                        <button class="btn btn-success btn-small" data-action="approve" data-uid="${uid}">Aprovar</button>
                        <button class="btn btn-danger btn-small" data-action="reject" data-uid="${uid}">Rejeitar</button>
                    </div>
                `;
                pendingList.appendChild(item);
            });

            pendingList.querySelectorAll('[data-action="approve"]').forEach(btn => 
                btn.addEventListener('click', e => AdminPanel.approveAthlete(e.target.dataset.uid))
            );
            pendingList.querySelectorAll('[data-action="reject"]').forEach(btn => 
                btn.addEventListener('click', e => AdminPanel.rejectAthlete(e.target.dataset.uid))
            );
        });
    },

    loadAthletes: () => {
        const athletesRef = AdminPanel.state.db.ref('users');
        const query = athletesRef.orderByChild('name');
        AppPrincipal.state.listeners['adminAthletes'] = query;
        
        query.on('value', snapshot => {
            AdminPanel.state.athletes = snapshot.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const { athleteList, athleteSearch } = AdminPanel.elements;
        if(!athleteList) return;
        
        const searchTerm = athleteSearch ? athleteSearch.value.toLowerCase() : "";
        athleteList.innerHTML = "";
        
        if (AdminPanel.state.selectedAthleteId && !AdminPanel.state.athletes[AdminPanel.state.selectedAthleteId]) {
            AdminPanel.selectAthlete(null, null);
        }

        Object.entries(AdminPanel.state.athletes).forEach(([uid, userData]) => {
            if (uid === AdminPanel.state.currentUser.uid) return;
            if (searchTerm && !userData.name.toLowerCase().includes(searchTerm)) {
                return;
            }

            const el = document.createElement('div');
            el.className = 'athlete-list-item';
            el.dataset.uid = uid;
            el.innerHTML = `<span>${userData.name}</span>`;
            el.addEventListener('click', () => AdminPanel.selectAthlete(uid, userData.name));
            
            if (uid === AdminPanel.state.selectedAthleteId) {
                el.classList.add('selected');
            }
            athleteList.appendChild(el);
        });
    },

    approveAthlete: (uid) => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals/' + uid);
        pendingRef.once('value', snapshot => {
            if (!snapshot.exists()) return;
            const pendingData = snapshot.val();
            const newUserProfile = { 
                name: pendingData.name, 
                email: pendingData.email, 
                role: "atleta", 
                createdAt: new Date().toISOString(),
                bio: "", photoUrl: ""
            };
            const updates = {};
            updates[`/users/${uid}`] = newUserProfile;
            updates[`/data/${uid}`] = { workouts: {} };     
            updates[`/iaAnalysisHistory/${uid}`] = {}; 
            updates[`/pendingApprovals/${uid}`] = null; 

            AdminPanel.state.db.ref().update(updates)
                .catch(err => alert("Falha ao aprovar: " + err.message));
        });
    },

    rejectAthlete: (uid) => {
        if (!confirm("Tem certeza que deseja REJEITAR?")) return;
        AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
            .catch(err => alert("Falha ao rejeitar: " + err.message));
    },

    deleteAthlete: () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return;
        const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
        if (!confirm(`ATENÇÃO: Apagar PERMANENTEMENTE o atleta "${athleteName}"?`)) return;

        const updates = {};
        updates[`/users/${selectedAthleteId}`] = null;
        updates[`/data/${selectedAthleteId}`] = null;
        updates[`/iaAnalysisHistory/${selectedAthleteId}`] = null; 
        
        const feedRef = AdminPanel.state.db.ref('publicWorkouts');
        feedRef.orderByChild('ownerId').equalTo(selectedAthleteId).once('value', snapshot => {
            snapshot.forEach(childSnapshot => {
                const workoutId = childSnapshot.key;
                updates[`/publicWorkouts/${workoutId}`] = null;
                updates[`/workoutComments/${workoutId}`] = null;
                updates[`/workoutLikes/${workoutId}`] = null;
            });
            AdminPanel.state.db.ref().update(updates)
                .then(() => AdminPanel.selectAthlete(null, null))
                .catch(err => alert("Erro ao excluir: " + err.message));
        });
    },

    selectAthlete: (uid, name) => {
        AppPrincipal.cleanupListeners(true);

        if (uid === null) {
            AdminPanel.state.selectedAthleteId = null;
            AdminPanel.elements.athleteDetailName.textContent = "Selecione um Atleta";
            AdminPanel.elements.athleteDetailContent.classList.add('hidden');
        } else {
            AdminPanel.state.selectedAthleteId = uid;
            AdminPanel.elements.athleteDetailName.textContent = `Atleta: ${name}`;
            AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
            AdminPanel.switchTab('prescrever'); 
            
            AdminPanel.loadWorkouts(uid);
            // IMPORTANTE: Carrega histórico também ao selecionar (igual V2)
            AdminPanel.loadIaHistory(uid);
        }
        
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        if(!workoutsList) return;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
        const query = workoutsRef.orderByChild('date'); 
        
        AppPrincipal.state.listeners['adminWorkouts'] = query;
        
        query.on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino agendado.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                try {
                    const card = AdminPanel.createWorkoutCard(childSnapshot.key, childSnapshot.val(), athleteId);
                    workoutsList.prepend(card); 
                } catch (e) { console.error(e); }
            });
        });
    },
    
    // RESTAURAÇÃO CRÍTICA (V2 Pura): Query com orderByChild('analysisDate')
    loadIaHistory: (athleteId) => {
        const { iaHistoryList } = AdminPanel.elements;
        if (!iaHistoryList) return; 
        
        iaHistoryList.innerHTML = "<p>Carregando histórico...</p>";
        
        const historyRef = AdminPanel.state.db.ref(`iaAnalysisHistory/${athleteId}`);
        // Restaura a lógica que funcionava no seu ZIP
        const query = historyRef.orderByChild('analysisDate').limitToLast(50);
        
        // Remove listener anterior se existir
        if (AppPrincipal.state.listeners['adminIaHistory']) {
            if(typeof AppPrincipal.state.listeners['adminIaHistory'].off === 'function') {
                AppPrincipal.state.listeners['adminIaHistory'].off();
            }
        }
        AppPrincipal.state.listeners['adminIaHistory'] = query;
        
        query.on('value', snapshot => {
            iaHistoryList.innerHTML = ""; 
            if (!snapshot.exists()) {
                iaHistoryList.innerHTML = "<p>Nenhuma análise salva.</p>";
                return;
            }
            
            let items = [];
            snapshot.forEach(childSnapshot => {
                items.push({
                    id: childSnapshot.key,
                    data: childSnapshot.val()
                });
            });
            
            // Inverte para exibir o mais recente no topo
            items.reverse().forEach(item => {
                const card = AdminPanel.createIaHistoryCard(item.id, item.data);
                iaHistoryList.appendChild(card);
            });
        });
    },

    // ===================================================================
    // NOVA IA: MODO FISIOLOGISTA SÊNIOR (SUBSTITUIÇÃO COMPLETA)
    // ===================================================================
    handleAnalyzeAthleteIA: async () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return alert("Selecione um atleta.");
        
        // Lógica robusta para pegar o nome do atleta (evita "undefined")
        let athleteName = "Atleta";
        if (AdminPanel.state.athletes && AdminPanel.state.athletes[selectedAthleteId]) {
            athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
        } else if (AppPrincipal.state.userCache && AppPrincipal.state.userCache[selectedAthleteId]) {
            athleteName = AppPrincipal.state.userCache[selectedAthleteId].name;
        } else {
            const domName = document.getElementById('athlete-detail-name').textContent;
            if(domName) athleteName = domName.replace("Atleta: ", "");
        }
        
        AppPrincipal.openIaAnalysisModal(); 
        const iaAnalysisOutput = AppPrincipal.elements.iaAnalysisOutput;
        const saveBtn = AppPrincipal.elements.saveIaAnalysisBtn;
        
        iaAnalysisOutput.textContent = `Coletando dados fisiológicos de ${athleteName}...`;
        saveBtn.classList.add('hidden'); 

        try {
            // Aumentamos para 15 treinos para a IA ter mais contexto de evolução
            const dataRef = AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`);
            const snapshot = await dataRef.orderByChild('date').limitToLast(15).once('value');
            
            if (!snapshot.exists()) throw new Error("Dados insuficientes para análise.");
            const workoutData = snapshot.val();
            
            // --- NOVO CÉREBRO DA IA (Prompt Fisiologista) ---
            const prompt = `
            ATUE COMO: Fisiologista Sênior e Treinador de Elite da Seleção Brasileira de Atletismo.
            DESTINATÁRIO: Treinador Leandro (Head Coach da LeRunners).
            ATLETA EM ANÁLISE: ${athleteName}.
            
            DADOS TÉCNICOS (HISTÓRICO RECENTE JSON):
            ${JSON.stringify(workoutData, null, 2)}

            DIRETRIZES RÍGIDAS DE ANÁLISE (ZERO ALUCINAÇÃO):
            1. VERDADE ABSOLUTA: Use ESTRITAMENTE os dados do JSON acima. Se o campo "stravaData" não existir num treino, assuma que não foi feito ou não foi sincronizado.
            2. COMPARAÇÃO TÉCNICA: Compare o campo "structure" (O que o Leandro pediu) com "stravaData" (O que o atleta entregou).
               - Verifique discrepância de volume (km) e intensidade (pace).
            3. TOM DE VOZ: Profissional, técnico, direto e motivador quando merecido.

            GERE O RELATÓRIO NESTE FORMATO:
            
            ### 📊 Diagnóstico de Carga e Execução
            - **Volume Semanal:** O atleta bateu a quilometragem? (Cite números).
            - **Intensidade:** Respeitou as zonas (Leve/Forte)? (Ex: "Era rodagem leve a 6:00, mas fez a 5:00").
            - **Consistência:** Faltou a algum treino chave?

            ### ⚠️ Pontos de Atenção (Fisiologia)
            - Identifique riscos de lesão (aumento súbito de carga) ou destreino.
            - Analise os "Feedbacks" escritos pelo atleta no JSON (dores, cansaço).

            ### 🎯 Recomendação para o Treinador Leandro
            - Sugestão prática para a próxima semana (Ex: "Manter volume", "Fazer tapering", "Ajustar pace do longo").
            `;
            // ----------------------------------------
            
            iaAnalysisOutput.textContent = "Processando análise de performance (Gemini Pro)...";
            const analysisResult = await AppPrincipal.callGeminiTextAPI(prompt);
            
            iaAnalysisOutput.textContent = analysisResult;
            AppPrincipal.state.currentAnalysisData = {
                analysisDate: new Date().toISOString(),
                coachUid: AdminPanel.state.currentUser.uid,
                prompt: prompt,
                analysisResult: analysisResult
            };
            saveBtn.classList.remove('hidden'); 

        } catch (err) {
            iaAnalysisOutput.textContent = `ERRO NA ANÁLISE: ${err.message}`;
        }
    },
    
    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AdminPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
                <button class="btn btn-danger btn-small" data-action="delete"><i class="bx bx-trash"></i></button>
            </div>
        `;
        
        el.querySelector('.btn-comment').addEventListener('click', () => {
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        
        el.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm("Apagar este treino?")) {
                const updates = {};
                updates[`/data/${athleteId}/workouts/${id}`] = null;
                updates[`/publicWorkouts/${id}`] = null;
                updates[`/workoutComments/${id}`] = null;
                updates[`/workoutLikes/${id}`] = null;
                AdminPanel.state.db.ref().update(updates).catch(err => alert("Erro: " + err.message));
            }
        });
        
        AdminPanel.loadWorkoutStats(el, id, athleteId);
        return el;
    },
    
    createIaHistoryCard: (id, data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        let dateStr = "Data desconhecida";
        try {
            if (data.analysisDate) {
                dateStr = new Date(data.analysisDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            }
        } catch (e) { console.error(e); }

        const summary = data.analysisResult ? (data.analysisResult.split('\n').slice(0, 3).join('\n') + '...') : 'Sem resumo';
        
        el.innerHTML = `
            <div class="workout-card-header">
                <div><span class="date">Análise de ${dateStr}</span></div>
            </div>
            <div class="workout-card-body"><p>${summary}</p></div>
        `;
        el.addEventListener('click', () => AppPrincipal.openIaAnalysisModal(data));
        return el;
    },

    // ========================================================
    // ATUALIZAÇÃO STRAVA ADMIN (COMPLIANCE)
    // ========================================================
    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';

        // Regra Strava: Link obrigatório e visível
        let mapLinkHtml = '';
        if (stravaData.mapLink) {
            mapLinkHtml = `<p style="margin-top:10px; text-align:center;"><a href="${stravaData.mapLink}" target="_blank" style="display:inline-block; color:#fc4c02; text-decoration:underline; font-weight:bold;">View on Strava</a></p>`;
        }

        let splitsHtml = '';
        if (stravaData.splits && Array.isArray(stravaData.splits) && stravaData.splits.length > 0) {
            let rows = stravaData.splits.map(split => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:4px;">${split.km}</td>
                    <td style="padding:4px;">${split.pace}</td>
                    <td style="padding:4px;">${split.ele}</td>
                </tr>
            `).join('');

            splitsHtml = `
                <details style="margin-top: 10px; background: #fff; padding: 10px; border-radius: 5px; border: 1px solid #ddd;">
                    <summary style="cursor:pointer; font-weight:bold; color:#00008B;">📊 Ver Parciais (Km a Km)</summary>
                    <table style="width:100%; margin-top:10px; border-collapse:collapse; font-size:0.9rem;">
                        <thead>
                            <tr style="background:#f4f4f4; text-align:left;">
                                <th style="padding:4px;">Km</th>
                                <th style="padding:4px;">Pace</th>
                                <th style="padding:4px;">Elev.</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </details>
            `;
        }

        return `
            <fieldset class="strava-data-display" style="border-color:#fc4c02; background:#fff5f0;">
                <legend style="color:#fc4c02; font-weight:bold;">
                    <img src="img/strava.png" alt="Powered by Strava" style="height: 20px; vertical-align: middle; margin-right: 5px;">
                    Dados do Treino
                </legend>
                <div style="font-family:monospace; font-size:1rem; color:#333;">
                    <p><strong>Distância:</strong> ${stravaData.distancia || "N/A"}</p>
                    <p><strong>Tempo:</strong>     ${stravaData.tempo || "N/A"}</p>
                    <p><strong>Ritmo Médio:</strong> ${stravaData.ritmo || "N/A"}</p>
                </div>
                ${mapLinkHtml}
                ${splitsHtml}
            </fieldset>
        `;
    },
    
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        const isOwner = (AdminPanel.state.currentUser.uid === ownerId);
        
        const likesRef = AdminPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AdminPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`likes_${workoutId}`] = likesRef;
        
        likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(AdminPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`comments_${workoutId}`] = commentsRef;
        
        commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const myLikeRef = likesRef.child(AdminPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const { selectedAthleteId } = AdminPanel.state;
        const { addWorkoutForm } = AdminPanel.elements;
        
        if (!selectedAthleteId) return alert("Selecione um atleta.");

        const date = addWorkoutForm.querySelector('#workout-date').value;
        const title = addWorkoutForm.querySelector('#workout-title').value;
        
        if (!date || !title) return alert("Data e Título são obrigatórios.");

        const modalidade = addWorkoutForm.querySelector('#workout-modalidade').value;
        const tipoTreino = addWorkoutForm.querySelector('#workout-tipo-treino').value;
        const intensidade = addWorkoutForm.querySelector('#workout-intensidade').value;
        const percurso = addWorkoutForm.querySelector('#workout-percurso').value;
        
        const distancia = addWorkoutForm.querySelector('#workout-distancia').value.trim();
        const tempo = addWorkoutForm.querySelector('#workout-tempo').value.trim();
        const pace = addWorkoutForm.querySelector('#workout-pace').value.trim();
        const velocidade = addWorkoutForm.querySelector('#workout-velocidade').value.trim();
        const observacoes = addWorkoutForm.querySelector('#workout-observacoes').value.trim();

        let description = `[${modalidade}] - [${tipoTreino}]\n`;
        description += `Intensidade: ${intensidade}\n`;
        description += `Percurso: ${percurso}\n`;
        description += `--- \n`;
        if (distancia) description += `Distância: ${distancia}\n`;
        if (tempo) description += `Tempo: ${tempo}\n`;
        if (pace) description += `Pace: ${pace}\n`;
        if (velocidade) description += `Velocidade: ${velocidade}\n`;
        if (observacoes) description += `--- \nObservações:\n${observacoes}`;

        const workoutData = {
            date: date,
            title: title,
            description: description,
            structure: {
                modalidade, tipoTreino, intensidade, percurso, distancia, tempo, pace, velocidade
            },
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString(),
            status: "planejado",
            feedback: "",
            imageUrl: null,
            stravaData: null
        };

        AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`).push(workoutData)
            .then(() => {
                addWorkoutForm.querySelector('#workout-distancia').value = "";
                addWorkoutForm.querySelector('#workout-tempo').value = "";
                addWorkoutForm.querySelector('#workout-pace').value = "";
                addWorkoutForm.querySelector('#workout-velocidade').value = "";
                addWorkoutForm.querySelector('#workout-observacoes').value = "";
                addWorkoutForm.querySelector('#workout-title').value = "";
            })
            .catch(err => alert("Falha ao salvar: " + err.message));
    }
};

// ===================================================================
// 4. FinancePanel (MÓDULO FINANCEIRO - V5.0 - ANUAL/TOTAL)
// ===================================================================
const FinancePanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FinancePanel V5.0: Inicializado.");
        FinancePanel.state = { db, currentUser: user, inventory: {}, transactions: [] };
        
        FinancePanel.elements = {
            totalReceita: document.getElementById('fin-total-receita'),
            totalDespesa: document.getElementById('fin-total-despesa'),
            saldo: document.getElementById('fin-saldo'),
            
            tabLancamentosBtn: document.querySelector('[data-fin-tab="lancamentos"]'),
            tabEstoqueBtn: document.querySelector('[data-fin-tab="estoque"]'),
            tabLancamentosContent: document.getElementById('fin-tab-lancamentos'),
            tabEstoqueContent: document.getElementById('fin-tab-estoque'),
            
            transForm: document.getElementById('finance-transaction-form'),
            prodForm: document.getElementById('finance-product-form'),
            
            finType: document.getElementById('fin-type'),
            finCategory: document.getElementById('fin-category'),
            finStudentSelector: document.getElementById('fin-student-selector'),
            finStudentSelect: document.getElementById('fin-student-select'),
            finProductSelector: document.getElementById('fin-product-selector'),
            finProductSelect: document.getElementById('fin-product-select'),
            
            transactionsList: document.getElementById('finance-transactions-list'),
            inventoryList: document.getElementById('finance-inventory-list')
        };

        if(FinancePanel.elements.tabLancamentosBtn)
            FinancePanel.elements.tabLancamentosBtn.addEventListener('click', () => FinancePanel.switchTab('lancamentos'));
        if(FinancePanel.elements.tabEstoqueBtn)
            FinancePanel.elements.tabEstoqueBtn.addEventListener('click', () => FinancePanel.switchTab('estoque'));
        
        if(FinancePanel.elements.finType)
            FinancePanel.elements.finType.addEventListener('change', FinancePanel.handleTypeChange);
        if(FinancePanel.elements.finCategory)
            FinancePanel.elements.finCategory.addEventListener('change', FinancePanel.handleCategoryChange);
        
        if(FinancePanel.elements.transForm)
            FinancePanel.elements.transForm.addEventListener('submit', FinancePanel.handleTransactionSubmit);
        if(FinancePanel.elements.prodForm)
            FinancePanel.elements.prodForm.addEventListener('submit', FinancePanel.handleProductSubmit);

        FinancePanel.populateStudents();
        FinancePanel.loadData();
    },

    switchTab: (tab) => {
        const { tabLancamentosBtn, tabEstoqueBtn, tabLancamentosContent, tabEstoqueContent } = FinancePanel.elements;
        const isLanc = (tab === 'lancamentos');
        
        if(tabLancamentosBtn) tabLancamentosBtn.classList.toggle('active', isLanc);
        if(tabLancamentosContent) tabLancamentosContent.classList.toggle('active', isLanc);
        if(tabLancamentosContent) tabLancamentosContent.classList.toggle('hidden', !isLanc);
        
        if(tabEstoqueBtn) tabEstoqueBtn.classList.toggle('active', !isLanc);
        if(tabEstoqueContent) tabEstoqueContent.classList.toggle('active', !isLanc);
        if(tabEstoqueContent) tabEstoqueContent.classList.toggle('hidden', isLanc);
    },

    populateStudents: () => {
        const { finStudentSelect } = FinancePanel.elements;
        if(!finStudentSelect) return;
        
        finStudentSelect.innerHTML = '<option value="">Selecione o Aluno...</option>';
        Object.entries(AppPrincipal.state.userCache).forEach(([uid, data]) => {
            const opt = document.createElement('option');
            opt.value = uid;
            opt.textContent = data.name;
            finStudentSelect.appendChild(opt);
        });
    },

    handleTypeChange: () => {
        const type = FinancePanel.elements.finType.value;
        const cat = FinancePanel.elements.finCategory;
        cat.innerHTML = "";
        if (type === 'receita') {
            cat.innerHTML += '<option value="Mensalidade">Mensalidade</option>';
            cat.innerHTML += '<option value="Venda">Venda de Produto</option>';
            cat.innerHTML += '<option value="Outro">Outro</option>';
        } else {
            cat.innerHTML += '<option value="Conta">Conta a Pagar</option>';
            cat.innerHTML += '<option value="Equipamento">Equipamento</option>';
            cat.innerHTML += '<option value="Outro">Outro</option>';
        }
        FinancePanel.handleCategoryChange();
    },

    handleCategoryChange: () => {
        const cat = FinancePanel.elements.finCategory.value;
        const type = FinancePanel.elements.finType.value;
        const { finStudentSelector, finProductSelector } = FinancePanel.elements;
        if(!finStudentSelector || !finProductSelector) return;
        
        if (type === 'receita' && cat === 'Mensalidade') {
            finStudentSelector.classList.remove('hidden');
            finProductSelector.classList.add('hidden');
        } else if (type === 'receita' && cat === 'Venda') {
            finStudentSelector.classList.remove('hidden');
            finProductSelector.classList.remove('hidden');
        } else {
            finStudentSelector.classList.add('hidden');
            finProductSelector.classList.add('hidden');
        }
    },

    loadData: () => {
        const uid = FinancePanel.state.currentUser.uid;
        const financeRef = FinancePanel.state.db.ref(`data/${uid}/finance`);
        
        AppPrincipal.state.listeners['financeData'] = financeRef;
        
        financeRef.on('value', snapshot => {
            const data = snapshot.val() || {};
            FinancePanel.state.transactions = data.transactions ? Object.entries(data.transactions) : [];
            FinancePanel.state.inventory = data.inventory || {};
            
            FinancePanel.renderTransactions();
            FinancePanel.renderInventory();
            FinancePanel.updateSummary();
            FinancePanel.populateProductSelect();
        });
    },

    populateProductSelect: () => {
        const { finProductSelect } = FinancePanel.elements;
        if(!finProductSelect) return;
        
        finProductSelect.innerHTML = '<option value="">Selecione o Produto...</option>';
        Object.entries(FinancePanel.state.inventory).forEach(([key, prod]) => {
            if (prod.qty > 0) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${prod.name} (R$ ${prod.price} - Qtd: ${prod.qty})`;
                finProductSelect.appendChild(opt);
            }
        });
    },

    updateSummary: () => {
        let recYear = 0, despYear = 0;
        let totalSaldo = 0;
        
        const now = new Date();
        const currentYear = now.getFullYear();
        
        FinancePanel.state.transactions.forEach(([key, t]) => {
            const val = parseFloat(t.amount);
            const tDate = new Date(t.date); 
            const parts = t.date.split('-');
            const safeDate = new Date(parts[0], parts[1]-1, parts[2]); 
            
            if (t.type === 'receita') totalSaldo += val;
            else totalSaldo -= val;

            if (safeDate.getFullYear() === currentYear) {
                if (t.type === 'receita') recYear += val;
                else despYear += val;
            }
        });

        const cards = document.querySelectorAll('.finance-card h3');
        if(cards[0]) cards[0].textContent = `Receitas (${currentYear})`;
        if(cards[1]) cards[1].textContent = `Despesas (${currentYear})`;

        if(FinancePanel.elements.totalReceita) FinancePanel.elements.totalReceita.textContent = `R$ ${recYear.toFixed(2)}`;
        if(FinancePanel.elements.totalDespesa) FinancePanel.elements.totalDespesa.textContent = `R$ ${despYear.toFixed(2)}`;
        if(FinancePanel.elements.saldo) {
            FinancePanel.elements.saldo.textContent = `R$ ${totalSaldo.toFixed(2)}`;
            FinancePanel.elements.saldo.style.color = totalSaldo >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        }
    },

    renderTransactions: () => {
        const list = FinancePanel.elements.transactionsList;
        if(!list) return;
        list.innerHTML = "";
        
        const sorted = [...FinancePanel.state.transactions].sort((a,b) => new Date(b[1].date) - new Date(a[1].date));

        sorted.forEach(([key, t]) => {
            const tr = document.createElement('tr');
            const parts = t.date.split('-');
            const dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${t.description}</td>
                <td>${t.category}</td>
                <td style="color: ${t.type === 'receita' ? 'green' : 'red'}; font-weight: bold;">
                    R$ ${parseFloat(t.amount).toFixed(2)}
                </td>
                <td><button class="btn btn-danger btn-small delete-trans" data-key="${key}"><i class='bx bx-trash'></i></button></td>
            `;
            tr.querySelector('.delete-trans').addEventListener('click', () => FinancePanel.deleteTransaction(key));
            list.appendChild(tr);
        });
    },

    renderInventory: () => {
        const list = FinancePanel.elements.inventoryList;
        if(!list) return;
        list.innerHTML = "";
        
        Object.entries(FinancePanel.state.inventory).forEach(([key, prod]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${prod.name}</td>
                <td>R$ ${parseFloat(prod.price).toFixed(2)}</td>
                <td>${prod.qty} un</td>
                <td><button class="btn btn-danger btn-small delete-prod" data-key="${key}"><i class='bx bx-trash'></i></button></td>
            `;
            tr.querySelector('.delete-prod').addEventListener('click', () => FinancePanel.deleteProduct(key));
            list.appendChild(tr);
        });
    },

    handleTransactionSubmit: async (e) => {
        e.preventDefault();
        const uid = FinancePanel.state.currentUser.uid;
        
        const type = FinancePanel.elements.finType.value;
        const category = FinancePanel.elements.finCategory.value;
        const desc = document.getElementById('fin-description').value;
        const amount = parseFloat(document.getElementById('fin-amount').value);
        const date = document.getElementById('fin-date').value;
        const studentId = document.getElementById('fin-student-select').value;
        const productId = document.getElementById('fin-product-select').value;

        if (category === 'Venda' && !productId) return alert("Selecione o produto vendido.");

        if (type === 'receita' && category === 'Venda') {
            const prod = FinancePanel.state.inventory[productId];
            if (!prod || prod.qty <= 0) return alert("Produto sem estoque.");
            
            await FinancePanel.state.db.ref(`data/${uid}/finance/inventory/${productId}`).update({
                qty: prod.qty - 1
            });
        }

        const transaction = {
            type, category, description: desc, amount, date,
            studentId: studentId || null,
            productId: productId || null,
            createdAt: new Date().toISOString()
        };

        await FinancePanel.state.db.ref(`data/${uid}/finance/transactions`).push(transaction);
        alert("Lançamento salvo!");
        FinancePanel.elements.transForm.reset();
        FinancePanel.handleTypeChange();
    },

    handleProductSubmit: async (e) => {
        e.preventDefault();
        const uid = FinancePanel.state.currentUser.uid;
        
        const prod = {
            name: document.getElementById('prod-name').value,
            price: parseFloat(document.getElementById('prod-price').value),
            cost: parseFloat(document.getElementById('prod-cost').value) || 0,
            qty: parseInt(document.getElementById('prod-qty').value)
        };

        await FinancePanel.state.db.ref(`data/${uid}/finance/inventory`).push(prod);
        alert("Produto cadastrado!");
        FinancePanel.elements.prodForm.reset();
    },

    deleteTransaction: (key) => {
        if(confirm("Apagar transação?")) {
            FinancePanel.state.db.ref(`data/${FinancePanel.state.currentUser.uid}/finance/transactions/${key}`).remove();
        }
    },
    
    deleteProduct: (key) => {
        if(confirm("Apagar produto?")) {
            FinancePanel.state.db.ref(`data/${FinancePanel.state.currentUser.uid}/finance/inventory/${key}`).remove();
        }
    }
};

// ===================================================================
// 5. AtletaPanel (Lógica do Painel Atleta)
// ===================================================================
const AtletaPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AtletaPanel V3.3: Inicializado.");
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { 
            workoutsList: document.getElementById('atleta-workouts-list'),
            logManualActivityBtn: document.getElementById('log-manual-activity-btn')
        };
        
        if(AtletaPanel.elements.logManualActivityBtn)
            AtletaPanel.elements.logManualActivityBtn.addEventListener('click', AppPrincipal.openLogActivityModal);
        
        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        if(!workoutsList) return;
        workoutsList.innerHTML = "<p>Carregando seus treinos...</p>";
        
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
        const query = workoutsRef.orderByChild('date');
        
        AppPrincipal.state.listeners['atletaWorkouts'] = query;
        
        query.on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino encontrado. Fale com seu coach!</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AtletaPanel.createWorkoutCard(childSnapshot.key, childSnapshot.val(), athleteId);
                workoutsList.prepend(card);
            });
        });
    },

    createWorkoutCard: (id, data, athleteId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status || 'planejado'}">${data.status || 'planejado'}</span>
            </div>
            <div class="workout-card-body">
                <p>${data.description || "Sem descrição."}</p>
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AtletaPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
                <button class="btn btn-primary btn-small" data-action="feedback"><i class='bx bx-edit'></i> Feedback</button>
            </div>
        `;

        const feedbackBtn = el.querySelector('[data-action="feedback"]');
        feedbackBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button') && !e.target.closest('a')) {
                 AppPrincipal.openFeedbackModal(id, athleteId, data.title);
             }
        });
        
        AtletaPanel.loadWorkoutStats(el, id, athleteId);
        return el;
    },
    
    // ========================================================
    // ATUALIZAÇÃO STRAVA ATLETA (COMPLIANCE)
    // ========================================================
    createStravaDataDisplay: (stravaData) => {
        if (!stravaData) return '';

        // Regra Strava: Link obrigatório e visível
        let mapLinkHtml = '';
        if (stravaData.mapLink) {
            mapLinkHtml = `<p style="margin-top:10px; text-align:center;"><a href="${stravaData.mapLink}" target="_blank" style="display:inline-block; color:#fc4c02; text-decoration:underline; font-weight:bold;">View on Strava</a></p>`;
        }

        let splitsHtml = '';
        if (stravaData.splits && Array.isArray(stravaData.splits) && stravaData.splits.length > 0) {
            let rows = stravaData.splits.map(split => `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:4px;">${split.km}</td>
                    <td style="padding:4px;">${split.pace}</td>
                    <td style="padding:4px;">${split.ele}</td>
                </tr>
            `).join('');

            splitsHtml = `
                <details style="margin-top: 10px; background: #fff; padding: 10px; border-radius: 5px; border: 1px solid #ddd;">
                    <summary style="cursor:pointer; font-weight:bold; color:#00008B;">📊 Ver Parciais (Km a Km)</summary>
                    <table style="width:100%; margin-top:10px; border-collapse:collapse; font-size:0.9rem;">
                        <thead>
                            <tr style="background:#f4f4f4; text-align:left;">
                                <th style="padding:4px;">Km</th>
                                <th style="padding:4px;">Pace</th>
                                <th style="padding:4px;">Elev.</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </details>
            `;
        }

        return `
            <fieldset class="strava-data-display" style="border-color:#fc4c02; background:#fff5f0;">
                <legend style="color:#fc4c02; font-weight:bold;">
                    <img src="img/strava.png" alt="Powered by Strava" style="height: 20px; vertical-align: middle; margin-right: 5px;">
                    Dados do Treino
                </legend>
                <div style="font-family:monospace; font-size:1rem; color:#333;">
                    <p><strong>Distância:</strong> ${stravaData.distancia || "N/A"}</p>
                    <p><strong>Tempo:</strong>     ${stravaData.tempo || "N/A"}</p>
                    <p><strong>Ritmo Médio:</strong> ${stravaData.ritmo || "N/A"}</p>
                </div>
                ${mapLinkHtml}
                ${splitsHtml}
            </fieldset>
        `;
    },
    
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        
        const isOwner = (AtletaPanel.state.currentUser.uid === ownerId);
        const likesRef = AtletaPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = AtletaPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`likes_${workoutId}`] = likesRef;
        
        likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(AtletaPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`comments_${workoutId}`] = commentsRef;
        
        commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(AtletaPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    }
};

// ===================================================================
// 6. FeedPanel (Lógica do Feed Social)
// ===================================================================
const FeedPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FeedPanel V6.0: Inicializado.");
        FeedPanel.state = { db, currentUser: user };
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        const { feedList } = FeedPanel.elements;
        if(!feedList) return;
        feedList.innerHTML = "<p>Carregando feed...</p>";
        const feedRef = FeedPanel.state.db.ref('publicWorkouts');
        
        // RESTAURAÇÃO CRÍTICA FEED V2: 
        // Restaurada query por realizadoAt para garantir ordem cronológica
        const query = feedRef.orderByChild('realizadoAt').limitToLast(50);
        
        AppPrincipal.state.listeners['feedData'] = query;
        
        query.on('value', snapshot => {
            feedList.innerHTML = "";
            if (!snapshot.exists()) {
                feedList.innerHTML = "<p>Nenhum treino realizado pela equipe ainda.</p>";
                return;
            }
            let feedItems = [];
            snapshot.forEach(childSnapshot => {
                feedItems.push({
                    id: childSnapshot.key,
                    data: childSnapshot.val()
                });
            });
            
            // Inverte para mostrar o mais recente (último inserido) no topo
            feedItems.reverse().forEach(item => {
                try {
                    const card = FeedPanel.createFeedCard(item.id, item.data, item.data.ownerId);
                    feedList.appendChild(card);
                } catch (err) {
                    console.error("Erro no card do feed:", item.id, err);
                }
            });
        });
    },
    
    createFeedCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        const athleteData = AppPrincipal.state.userCache[ownerId];
        const athleteName = athleteData?.name || data.ownerName || "Atleta";
        const athleteAvatar = athleteData?.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=LR';
        
        el.innerHTML = `
            <div class="workout-card-header">
                <img src="${athleteAvatar}" alt="Avatar de ${athleteName}" class="athlete-avatar">
                <span class="athlete-name">${athleteName}</span>
                <div>
                    <span class="date">${data.date}</span>
                    <span class="title">${data.title}</span>
                </div>
                <span class="status-tag ${data.status || 'planejado'}">${data.status}</span>
            </div>
            <div class="workout-card-body">
                ${data.description ? `<p>${data.description}</p>` : ''}
                ${data.feedback ? `<p class="feedback-text">${data.feedback}</p>` : ''}
                ${data.stravaData ? AtletaPanel.createStravaDataDisplay(data.stravaData) : ''}
                ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Foto do treino" class="workout-image">` : ''}
            </div>
            <div class="workout-card-footer">
                <div class="workout-actions">
                    <button class="action-btn btn-like"><i class='bx bx-heart'></i> <span class="like-count">0</span></button>
                    <button class="action-btn btn-comment"><i class='bx bx-comment'></i> <span class="comment-count">0</span></button>
                </div>
            </div>
        `;

        const openProfile = (e) => { e.stopPropagation(); AppPrincipal.openViewProfileModal(ownerId); };
        el.querySelector('.athlete-avatar').addEventListener('click', openProfile);
        el.querySelector('.athlete-name').addEventListener('click', openProfile);
        
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button') && !e.target.closest('a')) AppPrincipal.openFeedbackModal(id, ownerId, data.title);
        });

        FeedPanel.loadWorkoutStats(el, id, ownerId);
        return el;
    },
    
    loadWorkoutStats: (cardElement, workoutId, ownerId) => {
        const likeBtn = cardElement.querySelector('.btn-like');
        const likeCount = cardElement.querySelector('.like-count');
        const commentCount = cardElement.querySelector('.comment-count');
        const isOwner = (FeedPanel.state.currentUser.uid === ownerId);

        const likesRef = FeedPanel.state.db.ref(`workoutLikes/${workoutId}`);
        const commentsRef = FeedPanel.state.db.ref(`workoutComments/${workoutId}`);
        
        AppPrincipal.state.listeners[`feed_likes_${workoutId}`] = likesRef;
        
        likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            if (snapshot.hasChild(FeedPanel.state.currentUser.uid)) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
            if (isOwner) likeBtn.disabled = true;

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => { e.stopPropagation(); AppPrincipal.openWhoLikedModal(workoutId); };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        AppPrincipal.state.listeners[`feed_comments_${workoutId}`] = commentsRef;
        
        commentsRef.on('value', snapshot => commentCount.textContent = snapshot.numChildren());

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(FeedPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) myLikeRef.remove(); else myLikeRef.set(true);
                });
            });
        }
    }
};
