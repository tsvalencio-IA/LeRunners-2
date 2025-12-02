/* =================================================================== */
/* PANELS.JS V8.0 - DASHBOARD SISRUN + CORREÇÃO DE EXIBIÇÃO
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        // 1. INJEÇÃO DO DASHBOARD BONITO (Mantido da V3)
        const mainContent = document.getElementById('app-main-content');
        mainContent.innerHTML = `
            <div class="admin-dashboard">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <span class="user-display" style="font-size:0.9rem; color:#666;">Coach</span>
                </div>
                
                <div class="dashboard-grid">
                    <div class="dash-card" onclick="AdminPanel.showSection('feedbacks')">
                        <i class='bx bx-message-square-check'></i>
                        <span>Feedbacks <span id="badge-feed" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('alunos')">
                        <i class='bx bx-group'></i>
                        <span>Meus Alunos <span id="badge-alunos" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('aprovacoes')">
                        <i class='bx bx-user-plus'></i>
                        <span>Aprovações <span id="badge-aprovacoes" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('planilhas')">
                        <i class='bx bx-spreadsheet'></i>
                        <span>Modelos</span>
                    </div>
                </div>

                <div id="admin-content-area" class="panel" style="min-height: 400px;">
                    </div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        AdminPanel.showSection('alunos'); // Inicia na lista de alunos
    },

    loadData: () => {
        // Carrega Alunos
        AdminPanel.state.db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(document.getElementById('badge-alunos')) 
                document.getElementById('badge-alunos').textContent = Object.keys(AdminPanel.state.athletes).length;
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });
        
        // Carrega Feedbacks Pendentes (Exemplo)
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            if(s.exists() && document.getElementById('badge-feed'))
                document.getElementById('badge-feed').textContent = s.numChildren();
        });
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'alunos') {
            area.innerHTML = `
                <h3><i class='bx bx-list-ul'></i> Gestão de Alunos</h3>
                <input type="text" id="athlete-search" class="search-input" placeholder="Buscar aluno..." onkeyup="AdminPanel.renderAthleteList(this.value)">
                <div id="athlete-list-container"></div>
                
                <div id="athlete-workspace" class="hidden" style="margin-top:20px; border-top:1px solid #eee;">
                    <div style="display:flex; justify-content:space-between; margin-top:10px;">
                        <h3 id="workspace-title" style="color:var(--primary-color)">Aluno</h3>
                        <button class="btn btn-secondary btn-small" onclick="AdminPanel.closeWorkspace()">Fechar</button>
                    </div>
                    <div id="prescription-area" style="margin-top:15px; background:#f9f9f9; padding:15px; border-radius:8px;">
                        <h4>Nova Prescrição</h4>
                        <form id="quick-add-form" class="form-minimal">
                            <div class="form-grid-2col">
                                <div class="form-group"><label>Data</label><input type="date" id="qa-date" required></div>
                                <div class="form-group"><label>Título</label><input type="text" id="qa-title" placeholder="Ex: Longo" required></div>
                            </div>
                            <div class="form-group"><label>Descrição (Estrutura)</label><textarea id="qa-desc" rows="3" placeholder="Aquecimento, Principal..."></textarea></div>
                            <button type="submit" class="btn btn-secondary">Agendar</button>
                        </form>
                    </div>
                    <div id="workspace-workouts" style="margin-top:20px;"></div>
                </div>
            `;
            AdminPanel.renderAthleteList();
            
            // Ativa o form
            setTimeout(() => {
                const form = document.getElementById('quick-add-form');
                if(form) form.onsubmit = AdminPanel.handleQuickAdd;
            }, 500);
        } 
        else if (section === 'feedbacks') {
            area.innerHTML = "<h3>Central de Feedbacks</h3><p>Em desenvolvimento...</p>";
        }
    },

    renderAthleteList: (filter = "") => {
        const div = document.getElementById('athlete-list-container');
        if(!div) return;
        div.innerHTML = "";

        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            // FILTRO: Não mostra o próprio Coach na lista de gestão para não poluir
            if (uid === AdminPanel.state.currentUser.uid) return;
            
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;

            const item = document.createElement('div');
            item.className = 'athlete-list-item';
            item.innerHTML = `<span>${data.name}</span> <i class='bx bx-chevron-right'></i>`;
            item.onclick = () => AdminPanel.openWorkspace(uid, data.name);
            div.appendChild(item);
        });
    },

    openWorkspace: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        document.getElementById('athlete-list-container').classList.add('hidden');
        document.getElementById('athlete-search').classList.add('hidden');
        document.getElementById('athlete-workspace').classList.remove('hidden');
        document.getElementById('workspace-title').textContent = name;
        AdminPanel.loadWorkspaceWorkouts(uid);
    },

    closeWorkspace: () => {
        AdminPanel.state.selectedAthleteId = null;
        document.getElementById('athlete-workspace').classList.add('hidden');
        document.getElementById('athlete-list-container').classList.remove('hidden');
        document.getElementById('athlete-search').classList.remove('hidden');
    },

    handleQuickAdd: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        const data = {
            date: document.getElementById('qa-date').value,
            title: document.getElementById('qa-title').value,
            description: document.getElementById('qa-desc').value,
            status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString()
        };
        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Treino salvo!");
            document.getElementById('qa-title').value = "";
            document.getElementById('qa-desc').value = "";
        });
    },

    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('workspace-workouts');
        div.innerHTML = "Carregando planilha...";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const workouts = [];
            snap.forEach(c => workouts.push({ k: c.key, ...c.val() }));
            workouts.sort((a,b) => new Date(b.date) - new Date(a.date));

            workouts.forEach(w => {
                // USA A FUNÇÃO DE CARD QUE LÊ TUDO
                const card = AdminPanel.createWorkoutCard(w.k, w, uid);
                div.appendChild(card);
            });
        });
    },

    // --- CORREÇÃO CRÍTICA: CARD QUE LÊ QUALQUER FORMATO ---
    createWorkoutCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        // 1. Tratamento da Descrição (Velha vs Nova)
        let displayDesc = "";
        if (data.description) {
            displayDesc = data.description;
        } else if (data.structure) {
            // Formato SisRUN estruturado
            displayDesc = `Aq: ${data.structure.warm || '-'}\nPrin: ${data.structure.main || '-'}\nDes: ${data.structure.cool || '-'}`;
        } else {
            displayDesc = "Detalhes não disponíveis.";
        }

        // 2. Tratamento do Strava
        let stravaBadge = "";
        if (data.stravaData) {
            stravaBadge = `<div style="margin-top:5px; font-size:0.85rem; color:#fc4c02; background:#fff5f0; padding:5px; border:1px solid #fc4c02; border-radius:4px;">
                <i class='bx bxl-strava'></i> ${data.stravaData.distancia} | ${data.stravaData.tempo}
            </div>`;
        }

        // 3. Status Cor
        const statusColors = { 
            'planejado': '#ccc', 
            'realizado': 'var(--success-color)', 
            'nao_realizado': 'var(--danger-color)' 
        };
        const stColor = statusColors[data.status] || '#ccc';

        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${new Date(data.date).toLocaleDateString('pt-BR')}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag" style="background:${stColor}">${data.status}</span>
            </div>
            <div class="workout-card-body">
                <p style="white-space: pre-wrap;">${displayDesc}</p>
                ${data.feedback ? `<div class="feedback-text"><strong>Aluno:</strong> ${data.feedback}</div>` : ''}
                ${stravaBadge}
            </div>
            <div class="workout-card-footer">
                <button class="btn btn-secondary btn-small" onclick="AppPrincipal.openFeedbackModal('${id}', '${ownerId}', '${data.title}')">
                    Detalhes / Avaliar
                </button>
            </div>
        `;
        return el;
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const workouts = [];
            snap.forEach(c => workouts.push({ k: c.key, ...c.val() }));
            workouts.sort((a,b) => new Date(a.date) - new Date(b.date)); // Crescente

            workouts.forEach(w => {
                // Reutiliza o card robusto do Admin
                const card = AdminPanel.createWorkoutCard(w.k, w, user.uid);
                list.appendChild(card);
            });
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Sem novidades.</p>"; return; }
            
            const items = [];
            snap.forEach(c => items.push({ k: c.key, ...c.val() }));
            items.reverse();

            items.forEach(i => {
                const d = i;
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.innerHTML = `
                    <div class="workout-card-header">
                        <strong>${d.ownerName}</strong> - ${d.date}
                        <span class="status-tag" style="background:var(--success-color)">${d.status}</span>
                    </div>
                    <div class="workout-card-body">
                        <h4>${d.title}</h4>
                        <p>${d.feedback || d.description}</p>
                    </div>
                    <div class="workout-card-footer">
                        <button class="btn btn-nav" onclick="AppPrincipal.openFeedbackModal('${i.k}', '${d.ownerId}', '${d.title}')">Comentar</button>
                    </div>
                `;
                list.appendChild(div);
            });
        });
    }
};
