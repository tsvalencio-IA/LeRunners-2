/* =================================================================== */
/* ARQUIVO DE MÓDULOS (V4.0 - PAINÉIS ESTÁVEIS)
/* ARQUITETURA: Compatível com Modo Dual (Coach/Atleta)
/* =================================================================== */

// ===================================================================
// 3. AdminPanel (Lógica do Painel Coach)
// ===================================================================
const AdminPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V4.0: Inicializado.");
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };

        AdminPanel.elements = {
            pendingList: document.getElementById('pending-list'),
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            deleteAthleteBtn: document.getElementById('delete-athlete-btn'),
            
            tabPrescreverBtn: document.querySelector('[data-tab="prescrever"]'),
            tabKpisBtn: document.querySelector('[data-tab="kpis"]'),
            adminTabPrescrever: document.getElementById('admin-tab-prescrever'),
            adminTabKpis: document.getElementById('admin-tab-kpis'),
            
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list'),

            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };

        AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        AdminPanel.elements.deleteAthleteBtn.addEventListener('click', AdminPanel.deleteAthlete);
        
        AdminPanel.elements.tabPrescreverBtn.addEventListener('click', () => AdminPanel.switchTab('prescrever'));
        AdminPanel.elements.tabKpisBtn.addEventListener('click', () => {
            AdminPanel.switchTab('kpis');
            if(AdminPanel.state.selectedAthleteId) {
                AdminPanel.loadIaHistory(AdminPanel.state.selectedAthleteId);
            }
        });
        AdminPanel.elements.analyzeAthleteBtnIa.addEventListener('click', AdminPanel.handleAnalyzeAthleteIA);
        
        AdminPanel.loadPendingApprovals();
        AdminPanel.loadAthletes();
    },

    switchTab: (tabName) => {
        const { tabPrescreverBtn, tabKpisBtn, adminTabPrescrever, adminTabKpis } = AdminPanel.elements;
        const isPrescrever = (tabName === 'prescrever');
        tabPrescreverBtn.classList.toggle('active', isPrescrever);
        adminTabPrescrever.classList.toggle('active', isPrescrever);
        tabKpisBtn.classList.toggle('active', !isPrescrever);
        adminTabKpis.classList.toggle('active', !isPrescrever);
    },

    loadPendingApprovals: () => {
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals');
        AppPrincipal.state.listeners['adminPending'] = pendingRef.on('value', snapshot => {
            const { pendingList } = AdminPanel.elements;
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
        AppPrincipal.state.listeners['adminAthletes'] = athletesRef.orderByChild('name').on('value', snapshot => {
            AdminPanel.state.athletes = snapshot.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const { athleteList, athleteSearch } = AdminPanel.elements;
        const searchTerm = athleteSearch.value.toLowerCase();
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
        console.log("Aprovando:", uid);
        const pendingRef = AdminPanel.state.db.ref('pendingApprovals/' + uid);
        
        pendingRef.once('value', snapshot => {
            if (!snapshot.exists()) return console.error("Usuário pendente não encontrado.");
            
            const pendingData = snapshot.val();
            
            const newUserProfile = { 
                name: pendingData.name, 
                email: pendingData.email, 
                role: "atleta", 
                createdAt: new Date().toISOString(),
                bio: "", 
                photoUrl: "" 
            };
            
            const updates = {};
            updates[`/users/${uid}`] = newUserProfile;
            updates[`/data/${uid}`] = { workouts: {} };     
            updates[`/iaAnalysisHistory/${uid}`] = {}; 
            updates[`/pendingApprovals/${uid}`] = null; 

            AdminPanel.state.db.ref().update(updates)
                .then(() => console.log("Atleta aprovado e movido com sucesso."))
                .catch(err => {
                    console.error("ERRO CRÍTICO AO APROVAR:", err);
                    alert("Falha ao aprovar o atleta. Verifique as Regras de Segurança. Detalhe: " + err.message);
                });
        });
    },

    rejectAthlete: (uid) => {
        if (!confirm("Tem certeza que deseja REJEITAR este atleta?")) return;
        AdminPanel.state.db.ref('pendingApprovals/' + uid).remove()
            .then(() => console.log("Solicitação rejeitada."))
            .catch(err => alert("Falha ao rejeitar: " + err.message));
    },

    deleteAthlete: () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return;
        
        const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
        if (!confirm(`ATENÇÃO: Isso irá apagar PERMANENTEMENTE o atleta "${athleteName}" e todos os seus dados.\n\nTem certeza?`)) {
            return;
        }

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
                .then(() => {
                    console.log("Atleta e seus dados públicos foram excluídos.");
                    AdminPanel.selectAthlete(null, null); 
                })
                .catch(err => alert("Erro ao excluir atleta: " + err.message));
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
            AdminPanel.loadIaHistory(uid); 
        }
        
        document.querySelectorAll('.athlete-list-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.uid === uid);
        });
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        const workoutsRef = AdminPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['adminWorkouts'] = workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino agendado.</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AdminPanel.createWorkoutCard(
                    childSnapshot.key,
                    childSnapshot.val(), 
                    athleteId
                );
                workoutsList.prepend(card);
            });
        });
    },
    
    loadIaHistory: (athleteId) => {
        const { iaHistoryList } = AdminPanel.elements;
        if (!iaHistoryList) return; 
        
        iaHistoryList.innerHTML = "<p>Carregando histórico de IA...</p>";
        
        const historyRef = AdminPanel.state.db.ref(`iaAnalysisHistory/${athleteId}`);
        AppPrincipal.state.listeners['adminIaHistory'] = historyRef.orderByChild('analysisDate').limitToLast(10).on('value', snapshot => {
            iaHistoryList.innerHTML = ""; 
            if (!snapshot.exists()) {
                iaHistoryList.innerHTML = "<p>Nenhuma análise de IA salva para este atleta.</p>";
                return;
            }

            let items = [];
            snapshot.forEach(childSnapshot => {
                items.push({
                    id: childSnapshot.key,
                    data: childSnapshot.val()
                });
            });

            items.reverse().forEach(item => {
                const card = AdminPanel.createIaHistoryCard(item.id, item.data);
                iaHistoryList.appendChild(card);
            });
        });
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
        
        if (observacoes) {
             description += `--- \nObservações:\n${observacoes}`;
        }

        const workoutData = {
            date: date,
            title: title,
            description: description, 
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
            .catch(err => alert("Falha ao salvar o treino: " + err.message));
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
            if (confirm("Tem certeza que deseja apagar este treino?")) {
                const updates = {};
                updates[`/data/${athleteId}/workouts/${id}`] = null;
                updates[`/publicWorkouts/${id}`] = null;
                updates[`/workoutComments/${id}`] = null;
                updates[`/workoutLikes/${id}`] = null;
                
                AdminPanel.state.db.ref().update(updates)
                    .catch(err => alert("Falha ao deletar: " + err.message));
            }
        });
        
        AdminPanel.loadWorkoutStats(el, id, athleteId);
        
        return el;
    },
    
    createIaHistoryCard: (id, data) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        const date = new Date(data.analysisDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const summary = data.analysisResult.split('\n').slice(0, 3).join('\n') + '...';

        el.innerHTML = `
            <div class="workout-card-header">
                <div>
                    <span class="date">Análise de ${date}</span>
                    <span class="title">Gerada por ${AppPrincipal.state.userCache[data.coachUid]?.name || 'Coach'}</span>
                </div>
            </div>
            <div class="workout-card-body">
                <p>${summary}</p>
            </div>
        `;

        el.addEventListener('click', () => {
            AppPrincipal.openIaAnalysisModal(data);
        });
        
        return el;
    },

    createStravaDataDisplay: (stravaData) => {
        return `
            <fieldset class="strava-data-display">
                <legend><i class='bx bxl-strava'></i> Dados Extraídos (Gemini Vision)</legend>
                <p>Distância: ${stravaData.distancia || "N/A"}</p>
                <p>Tempo:     ${stravaData.tempo || "N/A"}</p>
                <p>Ritmo:     ${stravaData.ritmo || "N/A"}</p>
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
        
        const likesListenerKey = `likes_${workoutId}`;
        const commentsListenerKey = `comments_${workoutId}`;

        const likesListener = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;

            if (snapshot.hasChild(AdminPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
            
            if (isOwner) {
                likeBtn.disabled = true;
            }

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => {
                    e.stopPropagation();
                    AppPrincipal.openWhoLikedModal(workoutId);
                };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        const commentsListener = commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const myLikeRef = likesRef.child(AdminPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        myLikeRef.remove(); 
                    } else {
                        myLikeRef.set(true); 
                    }
                });
            });
        }
        
        AppPrincipal.state.listeners[likesListenerKey] = likesListener;
        AppPrincipal.state.listeners[commentsListenerKey] = commentsListener;
    },

    handleAnalyzeAthleteIA: async () => {
        const { selectedAthleteId } = AdminPanel.state;
        if (!selectedAthleteId) return alert("Selecione um atleta.");
        
        AppPrincipal.openIaAnalysisModal(); 
        
        const iaAnalysisOutput = AppPrincipal.elements.iaAnalysisOutput;
        const saveBtn = AppPrincipal.elements.saveIaAnalysisBtn;
        
        iaAnalysisOutput.textContent = "Coletando dados do atleta...";
        saveBtn.classList.add('hidden'); 

        try {
            const athleteName = AdminPanel.state.athletes[selectedAthleteId].name;
            const dataRef = AdminPanel.state.db.ref(`data/${selectedAthleteId}/workouts`);
            const snapshot = await dataRef.orderByChild('date').limitToLast(10).once('value');
            
            if (!snapshot.exists()) {
                throw new Error("Nenhum dado de treino encontrado para este atleta.");
            }
            
            const workoutData = snapshot.val();
            
            const prompt = `
                ATUE COMO: Um Coach de Corrida Sênior (Leandro) analisando um atleta.
                OBJETIVO: Analisar os últimos 10 treinos de um atleta e fornecer um resumo e pontos de ação.
                
                ATLETA: ${athleteName}
                
                DADOS BRUTOS (JSON dos últimos 10 treinos):
                ${JSON.stringify(workoutData, null, 2)}
                
                ANÁLISE SOLICITADA:
                Com base nos dados acima (status, feedback do atleta, datas, e stravaData se houver), gere um relatório conciso em TÓPICOS (Markdown) respondendo:
                1.  **Consistência:** O atleta está treinando regularmente? (Compare as 'datas' dos treinos 'realizados').
                2.  **Percepção de Esforço:** Qual é o sentimento geral do atleta? (Analise os campos 'feedback').
                3.  **Performance (Dados):** O atleta registrou dados do Strava (stravaData)? Se sim, os ritmos são condizentes com os treinos?
                4.  **Pontos de Atenção:** Existem sinais de alerta? (Ex: Dores, status 'nao_realizado' frequente, feedbacks negativos).
                5.  **Sugestão de Foco:** Qual deve ser o foco para a próxima semana? (Ex: Focar em recuperação, aumentar volume, etc.).
            `;
            
            iaAnalysisOutput.textContent = "Enviando dados para análise (Gemini)...";
            
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
            console.error("Erro na Análise IA:", err);
            iaAnalysisOutput.textContent = `ERRO: ${err.message}`;
            saveBtn.classList.add('hidden'); 
        }
    }
};

// ===================================================================
// 4. AtletaPanel (Lógica do Painel Atleta)
// ===================================================================
const AtletaPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("AtletaPanel V4.0: Inicializado.");
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { 
            workoutsList: document.getElementById('atleta-workouts-list'),
            logManualActivityBtn: document.getElementById('log-manual-activity-btn')
        };

        AtletaPanel.elements.logManualActivityBtn.addEventListener('click', AppPrincipal.openLogActivityModal);

        AtletaPanel.loadWorkouts(user.uid);
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AtletaPanel.elements;
        workoutsList.innerHTML = "<p>Carregando seus treinos...</p>";
        
        const workoutsRef = AtletaPanel.state.db.ref(`data/${athleteId}/workouts`);
        AppPrincipal.state.listeners['atletaWorkouts'] = workoutsRef.orderByChild('date').on('value', snapshot => {
            workoutsList.innerHTML = ""; 
            if (!snapshot.exists()) {
                workoutsList.innerHTML = "<p>Nenhum treino encontrado. Fale com seu coach!</p>";
                return;
            }
            snapshot.forEach(childSnapshot => {
                const card = AtletaPanel.createWorkoutCard(
                    childSnapshot.key, 
                    childSnapshot.val(), 
                    athleteId
                );
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
                <button class="btn btn-primary btn-small" data-action="feedback">
                    <i class='bx bx-edit'></i> Feedback
                </button>
            </div>
        `;

        const feedbackBtn = el.querySelector('[data-action="feedback"]');
        feedbackBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button')) {
                 AppPrincipal.openFeedbackModal(id, athleteId, data.title);
             }
        });
        
        AtletaPanel.loadWorkoutStats(el, id, athleteId);
        
        return el;
    },
    
    createStravaDataDisplay: (stravaData) => {
        return `
            <fieldset class="strava-data-display">
                <legend><i class='bx bxl-strava'></i> Dados Extraídos (Gemini Vision)</legend>
                <p>Distância: ${stravaData.distancia || "N/A"}</p>
                <p>Tempo:     ${stravaData.tempo || "N/A"}</p>
                <p>Ritmo:     ${stravaData.ritmo || "N/A"}</p>
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
        
        const likesListenerKey = `likes_${workoutId}`;
        const commentsListenerKey = `comments_${workoutId}`;

        const likesListener = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;

            if (snapshot.hasChild(AtletaPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }

            if (isOwner) {
                likeBtn.disabled = true;
            }

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => {
                    e.stopPropagation();
                    AppPrincipal.openWhoLikedModal(workoutId);
                };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        const commentsListener = commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(AtletaPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        myLikeRef.remove(); 
                    } else {
                        myLikeRef.set(true); 
                    }
                });
            });
        }
        
        cardElement.querySelector('.btn-comment').addEventListener('click', (e) => {
             e.stopPropagation(); 
        });
        
        AppPrincipal.state.listeners[likesListenerKey] = likesListener;
        AppPrincipal.state.listeners[commentsListenerKey] = commentsListener;
    }
};

// ===================================================================
// 5. FeedPanel (Lógica do Feed Social)
// ===================================================================
const FeedPanel = {
    state: {},
    elements: {},

    init: (user, db) => {
        console.log("FeedPanel V4.0: Inicializado.");
        FeedPanel.state = { db, currentUser: user };
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        
        FeedPanel.loadFeed();
    },

    loadFeed: () => {
        const { feedList } = FeedPanel.elements;
        feedList.innerHTML = "<p>Carregando feed...</p>";
        
        const feedRef = FeedPanel.state.db.ref('publicWorkouts');
        AppPrincipal.state.listeners['feedData'] = feedRef.orderByChild('realizadoAt').limitToLast(20).on('value', snapshot => {
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

            feedItems.reverse().forEach(item => {
                const card = FeedPanel.createFeedCard(
                    item.id,
                    item.data,
                    item.data.ownerId
                );
                feedList.appendChild(card);
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

        const avatarEl = el.querySelector('.athlete-avatar');
        const nameEl = el.querySelector('.athlete-name');

        const openProfile = (e) => {
            e.stopPropagation(); 
            AppPrincipal.openViewProfileModal(ownerId);
        };

        avatarEl.addEventListener('click', openProfile);
        nameEl.addEventListener('click', openProfile);
        
        el.addEventListener('click', (e) => {
             if (!e.target.closest('button')) { 
                AppPrincipal.openFeedbackModal(id, ownerId, data.title);
             }
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
        
        const likesListenerKey = `feed_likes_${workoutId}`;
        const commentsListenerKey = `feed_comments_${workoutId}`;
        
        const likesListener = likesRef.on('value', snapshot => {
            const count = snapshot.numChildren();
            likeCount.textContent = count;
            
            if (snapshot.hasChild(FeedPanel.state.currentUser.uid)) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }

            if (isOwner) {
                likeBtn.disabled = true;
            }

            if (count > 0) {
                likeCount.classList.add('like-count-btn');
                likeCount.onclick = (e) => {
                    e.stopPropagation();
                    AppPrincipal.openWhoLikedModal(workoutId);
                };
            } else {
                likeCount.classList.remove('like-count-btn');
                likeCount.onclick = null;
            }
        });
        
        const commentsListener = commentsRef.on('value', snapshot => {
            commentCount.textContent = snapshot.numChildren();
        });

        if (!isOwner) {
            likeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const myLikeRef = likesRef.child(FeedPanel.state.currentUser.uid);
                myLikeRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        myLikeRef.remove(); 
                    } else {
                        myLikeRef.set(true); 
                    }
                });
            });
        }
        
        AppPrincipal.state.listeners[likesListenerKey] = likesListener;
        AppPrincipal.state.listeners[commentsListenerKey] = commentsListener;
    }
};
