/* =================================================================== */
/* PANELS.JS V2.0 - LÓGICA DE UI SEGURA (SEM INNERHTML INJECTION)
/* =================================================================== */

const panels = {}; // Namespace

// 1. ADMIN PANEL (COACH)
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel: Inicializando...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        // Mapear Elementos (Que já existem no DOM graças ao app.js)
        AdminPanel.elements = {
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            pendingList: document.getElementById('pending-list'),
            detailContent: document.getElementById('athlete-detail-content'),
            detailName: document.getElementById('athlete-detail-name'),
            workoutsList: document.getElementById('workouts-list'),
            iaHistoryList: document.getElementById('ia-history-list'),
            form: document.getElementById('add-workout-form')
        };

        // Bind Events
        if(AdminPanel.elements.form) {
            // Remover listener antigo para evitar duplicação (segurança)
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        if(AdminPanel.elements.athleteSearch) {
            AdminPanel.elements.athleteSearch.addEventListener('input', (e) => AdminPanel.renderAthleteList(e.target.value));
        }

        document.getElementById('delete-athlete-btn').onclick = AdminPanel.deleteAthlete;
        document.getElementById('analyze-athlete-btn-ia').onclick = AdminPanel.runIA;

        // Abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`admin-tab-${btn.dataset.tab}`).classList.add('active');
            };
        });

        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    loadAthletes: () => {
        AdminPanel.state.db.ref('users').orderByChild('name').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: (filter = "") => {
        const div = AdminPanel.elements.athleteList;
        div.innerHTML = "";
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (data.role === 'admin') return;
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;

            const el = document.createElement('div');
            el.className = 'athlete-list-item';
            if(uid === AdminPanel.state.selectedAthleteId) el.classList.add('selected');
            el.innerHTML = `<span>${data.name}</span>`;
            el.onclick = () => AdminPanel.selectAthlete(uid, data.name);
            div.appendChild(el);
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        AdminPanel.elements.detailName.textContent = name;
        AdminPanel.elements.detailContent.classList.remove('hidden');
        AdminPanel.renderAthleteList(); // Update selected class
        AdminPanel.loadWorkouts(uid);
        AdminPanel.loadIaHistory(uid);
    },

    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workoutsList;
        div.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(50).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const list = [];
            s.forEach(c => list.push({key:c.key, ...c.val()}));
            list.sort((a,b) => new Date(b.date) - new Date(a.date)); // Mais recentes primeiro

            list.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                
                let stravaInfo = "";
                if(w.stravaData) {
                    stravaInfo = `<div class="strava-pill" style="margin-top:5px; font-size:0.8rem; color:#fc4c02;">
                        <i class='bx bxl-strava'></i> ${w.stravaData.distancia} | ${w.stravaData.ritmo}
                    </div>`;
                }

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${new Date(w.date).toLocaleDateString('pt-BR')}</strong>
                        <span class="status-tag ${w.status}">${w.status}</span>
                    </div>
                    <div style="font-weight:bold; color:var(--primary-color)">${w.title}</div>
                    <div style="font-size:0.9rem; color:#666; white-space:pre-wrap;">${w.description}</div>
                    ${stravaInfo}
                    <div style="text-align:right; margin-top:5px;">
                        <button class="btn btn-small btn-danger" data-id="${w.key}">Excluir</button>
                    </div>
                `;
                
                // Listener de Exclusão
                card.querySelector('button').onclick = (e) => {
                    e.stopPropagation();
                    if(confirm("Excluir este treino?")) {
                        const u={}; 
                        u[`/data/${uid}/workouts/${w.key}`]=null; 
                        u[`/publicWorkouts/${w.key}`]=null;
                        AdminPanel.state.db.ref().update(u);
                    }
                };
                
                // Listener de Feedback (Clique no card)
                card.onclick = (e) => {
                    if(e.target.tagName !== 'BUTTON') AppPrincipal.openFeedbackModal(w.key, uid, w.title);
                };

                div.appendChild(card);
            });
        });
    },

    // --- SALVAR TREINO DETALHADO (V17 FORM) ---
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if (!uid) return alert("Selecione um atleta!");

        const f = e.target;
        // Captura Campos V17
        const modalidade = f.querySelector('#workout-modalidade').value;
        const tipo = f.querySelector('#workout-tipo-treino').value;
        const intensidade = f.querySelector('#workout-intensidade').value;
        const percurso = f.querySelector('#workout-percurso').value;
        
        const dist = f.querySelector('#workout-distancia').value;
        const tempo = f.querySelector('#workout-tempo').value;
        const pace = f.querySelector('#workout-pace').value;
        const obs = f.querySelector('#workout-observacoes').value;

        // Monta Descrição Rica
        let desc = `[${modalidade}] - ${tipo}\nIntensidade: ${intensidade}\nPercurso: ${percurso}`;
        if(dist) desc += `\nDistância: ${dist}km`;
        if(tempo) desc += ` | Tempo: ${tempo}`;
        if(pace) desc += ` | Pace: ${pace}`;
        if(obs) desc += `\n\nObs: ${obs}`;

        const data = {
            date: f.querySelector('#workout-date').value,
            title: f.querySelector('#workout-title').value,
            description: desc,
            status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString(),
            // Salva dados estruturados para futura IA usar
            structured: { modalidade, tipo, intensidade, dist, tempo, pace }
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data)
            .then(() => {
                alert("Treino prescrito!");
                // Não reseta a data para facilitar lançamentos em sequência
                f.querySelector('#workout-title').value = "";
                f.querySelector('#workout-observacoes').value = "";
            });
    },

    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "Nenhuma pendência."; return; }
            s.forEach(c => {
                const el = document.createElement('div');
                el.className = 'pending-item';
                el.innerHTML = `<span>${c.val().name}</span> <button class="btn btn-success btn-small">Aprovar</button>`;
                el.querySelector('button').onclick = () => AdminPanel.approve(c.key, c.val());
                div.appendChild(el);
            });
        });
    },

    approve: (uid, data) => {
        const u={};
        u[`/users/${uid}`] = { name: data.name, email: data.email, role: 'atleta', createdAt: new Date().toISOString() };
        u[`/data/${uid}`] = { workouts: {} };
        u[`/pendingApprovals/${uid}`] = null;
        AdminPanel.state.db.ref().update(u);
    },

    deleteAthlete: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(uid && confirm("Tem certeza? Isso apagará TUDO deste atleta.")) {
            const u={};
            u[`/users/${uid}`] = null;
            u[`/data/${uid}`] = null;
            AdminPanel.state.db.ref().update(u);
            AdminPanel.elements.detailContent.classList.add('hidden');
            AdminPanel.state.selectedAthleteId = null;
        }
    },

    // IA
    runIA: async () => {
        const uid = AdminPanel.state.selectedAthleteId;
        const name = AdminPanel.elements.detailName.textContent;
        const output = document.getElementById('ia-analysis-output');
        const modal = document.getElementById('ia-analysis-modal');
        const saveBtn = document.getElementById('save-ia-analysis-btn');
        
        modal.classList.remove('hidden');
        output.textContent = "Coletando dados e analisando com Gemini...";
        saveBtn.classList.add('hidden');

        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            const workouts = snap.val();
            
            const prompt = `
                Analise os últimos treinos do atleta ${name}.
                Dados JSON: ${JSON.stringify(workouts)}
                
                Gere um relatório curto (Markdown) com:
                1. Consistência (está treinando?)
                2. Intensidade (Paces do Strava vs Planejado)
                3. Sugestão para próxima semana.
            `;
            
            const result = await AppPrincipal.callGeminiTextAPI(prompt);
            output.textContent = result;
            
            // Prepara para salvar
            AppPrincipal.state.currentAnalysisData = {
                date: new Date().toISOString(),
                text: result,
                coachId: AdminPanel.state.currentUser.uid
            };
            saveBtn.classList.remove('hidden');

        } catch (err) {
            output.textContent = "Erro na IA: " + err.message;
        }
    },

    loadIaHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        div.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            s.forEach(c => {
                const h = c.val();
                div.innerHTML += `<div style="border-bottom:1px solid #eee; padding:5px; font-size:0.8rem;">
                    <b>${new Date(h.date).toLocaleDateString()}</b><br>${h.text.substring(0, 100)}...
                </div>`;
            });
        });
    }
};

// 2. ATLETA PANEL
const AtletaPanel = {
    init: (user, db) => {
        console.log("AtletaPanel: Init");
        const list = document.getElementById('atleta-workouts-list');
        const welcome = document.getElementById('atleta-welcome-name');
        if(welcome) welcome.textContent = AppPrincipal.state.userData.name;

        document.getElementById('log-manual-activity-btn').onclick = () => document.getElementById('log-activity-modal').classList.remove('hidden');

        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Nenhum treino encontrado.</p>"; return; }
            
            const arr = [];
            s.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.sort((a,b) => new Date(b.date) - new Date(a.date));

            arr.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                card.style.borderLeft = w.status === 'realizado' ? '5px solid #28a745' : '5px solid #ccc';
                
                let stravaHtml = "";
                if(w.stravaData) {
                    stravaHtml = `<div style="background:#fff3e0; color:#e65100; padding:5px; font-size:0.8rem; border-radius:4px; margin-top:5px;">
                        <i class='bx bxl-strava'></i> ${w.stravaData.distancia} | ${w.stravaData.tempo} | ${w.stravaData.ritmo}
                    </div>`;
                }

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <b>${new Date(w.date).toLocaleDateString('pt-BR')}</b>
                        <span class="status-tag ${w.status}">${w.status}</span>
                    </div>
                    <div style="font-size:1.1rem; font-weight:bold; margin:5px 0;">${w.title}</div>
                    <p style="white-space:pre-wrap; font-size:0.9rem;">${w.description}</p>
                    ${stravaHtml}
                    <div style="text-align:right; margin-top:10px;">
                        <button class="btn btn-primary btn-small">Feedback</button>
                    </div>
                `;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, user.uid, w.title);
                list.appendChild(card);
            });
        });
    }
};

// 3. FEED PANEL
const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(30).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) return;
            
            const arr = [];
            s.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.reverse();

            arr.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                
                let stravaBadge = w.stravaData ? `<i class='bx bxl-strava' style="color:#fc4c02"></i>` : "";

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="width:40px; height:40px; background:#eee; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#555;">
                            ${w.ownerName ? w.ownerName.charAt(0) : "U"}
                        </div>
                        <div>
                            <div style="font-weight:bold;">${w.ownerName || "Atleta"}</div>
                            <div style="font-size:0.8rem; color:#777;">${new Date(w.date).toLocaleDateString()} ${stravaBadge}</div>
                        </div>
                    </div>
                    <div style="font-weight:bold; margin-bottom:5px;">${w.title}</div>
                    <div style="font-size:0.9rem;">${w.feedback || w.description}</div>
                    <div style="margin-top:10px; display:flex; gap:15px; color:#666;">
                        <span><i class='bx bx-heart'></i> Curtir</span>
                        <span><i class='bx bx-comment'></i> Comentar</span>
                    </div>
                `;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title);
                list.appendChild(card);
            });
        });
    }
};

// Exportar para global
window.panels = {
    init: () => {}, // Placeholder, init is called by app.js specific logic
    cleanup: () => {
        // Remove listeners antigos se necessário
        if(AdminPanel.state.db) AdminPanel.state.db.ref().off();
    }
};
