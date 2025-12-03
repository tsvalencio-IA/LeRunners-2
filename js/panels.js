/* =================================================================== */
/* PANELS.JS V18.0 - BASE V2 ORIGINAL + PRESCRIÇÃO DETALHADA + IA
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state = { db, currentUser: user, athletes: {} };
        
        // CORREÇÃO: Liga elementos do Template V2
        AdminPanel.elements = {
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list'),
            analyzeAthleteBtnIa: document.getElementById('analyze-athlete-btn-ia'),
            iaHistoryList: document.getElementById('ia-history-list')
        };
        
        // Binds
        if(AdminPanel.elements.athleteSearch) AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);
        if(AdminPanel.elements.addWorkoutForm) AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        if(AdminPanel.elements.analyzeAthleteBtnIa) AdminPanel.elements.analyzeAthleteBtnIa.addEventListener('click', AdminPanel.handleAnalyzeAthleteIA);
        
        AdminPanel.loadAthletes();
        // O restante das funções V2 (pendentes, tabs, etc) dependem da seleção de atleta
    },

    loadAthletes: () => {
        AdminPanel.state.db.ref('users').on('value', snapshot => {
            AdminPanel.state.athletes = snapshot.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const { athleteList, athleteSearch } = AdminPanel.elements;
        const searchTerm = athleteSearch ? athleteSearch.value.toLowerCase() : "";
        if(!athleteList) return;
        athleteList.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, userData]) => {
            if (uid === AdminPanel.state.currentUser.uid) return;
            if (searchTerm && !userData.name.toLowerCase().includes(searchTerm)) return;

            const el = document.createElement('div');
            el.className = 'athlete-list-item';
            el.dataset.uid = uid;
            el.innerHTML = `<span>${userData.name}</span>`;
            el.addEventListener('click', () => AdminPanel.selectAthlete(uid, userData.name));
            athleteList.appendChild(el);
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        document.getElementById('athlete-detail-name').textContent = `Atleta: ${name}`;
        document.getElementById('athlete-detail-content').classList.remove('hidden');
        AdminPanel.loadWorkouts(uid);
    },

    // --- PRESCRIÇÃO DETALHADA V18 ---
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        const form = AdminPanel.elements.addWorkoutForm;
        
        // Coleta de dados do formulário DETALHADO (V2 Template)
        const modalidade = form.querySelector('#workout-modalidade').value;
        const tipo = form.querySelector('#workout-tipo-treino').value;
        const distancia = form.querySelector('#workout-distancia').value;
        const intensidade = form.querySelector('#workout-intensidade').value;
        const obs = form.querySelector('#workout-observacoes').value;
        
        // Constrói a descrição
        const fullDesc = `Modalidade: ${modalidade}, Tipo: ${tipo} (${intensidade})\nMeta: ${distancia}\n\nObservações: ${obs}`;

        const data = {
            date: form.querySelector('#workout-date').value,
            title: form.querySelector('#workout-title').value,
            description: fullDesc,
            modalidade: modalidade,
            intensidade: intensidade,
            status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data)
            .then(() => {
                alert("Treino salvo!");
                AdminPanel.loadWorkouts(uid);
            });
    },

    loadWorkouts: (athleteId) => {
        const { workoutsList } = AdminPanel.elements;
        if (!workoutsList) return;
        workoutsList.innerHTML = "<p>Carregando treinos...</p>";
        
        AdminPanel.state.db.ref(`data/${athleteId}/workouts`).orderByChild('date').on('value', snapshot => {
             workoutsList.innerHTML = ""; 
             snapshot.forEach(child => {
                 const card = AdminPanel.createWorkoutCard(child.key, child.val(), athleteId);
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
                ${data.stravaData ? `<span class="strava-pill">Strava: ${data.stravaData.distancia}</span>` : ''}
            </div>
        `;
        el.addEventListener('click', () => {
            AppPrincipal.openFeedbackModal(id, athleteId, data.title);
        });
        return el;
    },
    
    handleAnalyzeAthleteIA: async () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um aluno!");
        
        AppPrincipal.openIaAnalysisModal(); // Abre o modal
        const out = document.getElementById('ia-analysis-output');
        out.textContent = "Analisando...";
        
        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            if(!snap.exists()) throw new Error("Sem dados.");
            const res = await AppPrincipal.callGeminiTextAPI(`Analise os treinos: ${JSON.stringify(snap.val())}. Fale sobre Pace e Volume.`);
            out.textContent = res;
        } catch(e) { out.textContent = "Erro na análise: " + e.message; }
    },
    
    // Funções de Aprovação (V2)
    loadPendingApprovals: () => { /* V2 logic */ },
    approveAthlete: () => { /* V2 logic */ }
};

const AtletaPanel = {
    init: (user, db) => {
        // Lógica do Atleta V2
    }
};

const FeedPanel = {
    init: (user, db) => {
        // Lógica do Feed V2
    }
};