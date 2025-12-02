/* =================================================================== */
/* PANELS.JS V10.0 - DASHBOARD VISUAL + CORREÇÃO DE LEITURA
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V10: Restaurando Visual...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        // 1. INJEÇÃO DO PAINEL BONITO (CÓDIGO ORIGINAL DA V3)
        const main = document.getElementById('app-main-content');
        main.innerHTML = `
            <div class="admin-dashboard">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="color:#00008B"><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <span id="user-role-display" style="color:#666">Coach</span>
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
                    <div class="dash-card" onclick="AdminPanel.showSection('financeiro')">
                        <i class='bx bx-dollar-circle'></i>
                        <span>Financeiro</span>
                    </div>
                </div>

                <div id="admin-content-area" class="panel" style="min-height: 400px; padding:20px;">
                    <p style="text-align:center; color:#999; margin-top:50px;">Selecione uma opção acima.</p>
                </div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        AdminPanel.showSection('alunos'); // Começa aqui
    },

    loadData: () => {
        AdminPanel.state.db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(document.getElementById('badge-alunos')) document.getElementById('badge-alunos').textContent = Object.keys(AdminPanel.state.athletes).length;
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            if(s.exists() && document.getElementById('badge-feed')) document.getElementById('badge-feed').textContent = s.numChildren();
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
                
                <div id="athlete-workspace" class="hidden" style="margin-top:20px; border-top:1px solid #ccc; padding-top:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 id="workspace-title" style="color:#00008B">Aluno</h3>
                        <button class="btn btn-secondary btn-small" onclick="AdminPanel.closeWorkspace()">Fechar</button>
                    </div>
                    
                    <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                        <h4>Nova Prescrição</h4>
                        <form id="quick-add-form" class="form-minimal">
                            <div class="form-grid-2col">
                                <div class="form-group"><label>Data</label><input type="date" id="qa-date" required></div>
                                <div class="form-group"><label>Título</label><input type="text" id="qa-title" placeholder="Ex: Longão" required></div>
                            </div>
                            <div class="form-group"><label>Descrição (SisRUN)</label><textarea id="qa-desc" rows="3" placeholder="Aquecimento, Principal..."></textarea></div>
                            <button type="submit" class="btn btn-secondary" style="width:100%">Agendar</button>
                        </form>
                    </div>
                    
                    <div id="workspace-workouts"></div>
                </div>
            `;
            AdminPanel.renderAthleteList();
            setTimeout(() => { 
                const f = document.getElementById('quick-add-form');
                if(f) f.onsubmit = AdminPanel.handleQuickAdd;
            }, 500);
        } else if (section === 'feedbacks') {
            area.innerHTML = "<h3>Central de Feedbacks</h3><div id='feedback-table'>Carregando...</div>";
            AdminPanel.renderFeedbackTable();
        } else {
            area.innerHTML = `<p>Seção <b>${section}</b> em breve.</p>`;
        }
    },

    renderAthleteList: (filter = "") => {
        const div = document.getElementById('athlete-list-container');
        if(!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if(uid === AdminPanel.state.currentUser.uid) return; // Filtra o próprio Coach da lista
            if(filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;

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
            alert("Treino agendado!");
            document.getElementById('qa-title').value = "";
            document.getElementById('qa-desc').value = "";
        });
    },

    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('workspace-workouts');
        div.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem treinos.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, ...c.val() }));
            arr.sort((a,b) => new Date(b.date) - new Date(a.date));
            arr.forEach(w => div.appendChild(AdminPanel.createWorkoutCard(w.k, w, uid)));
        });
    },

    // --- CORREÇÃO CRÍTICA: LÊ QUALQUER FORMATO ---
    createWorkoutCard: (id, data, ownerId) => {
        const el = document.createElement('div');
        el.className = 'workout-card';
        
        let desc = data.description || "Sem descrição.";
        if(data.structure) { // Se for objeto complexo da V3
             desc = JSON.stringify(data.structure).replace(/["{}]/g, '').replace(/,/g, '\n');
        }

        let stravaHTML = "";
        if(data.stravaData) {
            stravaHTML = `<div style="margin-top:10px; padding:10px; background:#fff5f0; border:1px solid #fc4c02; color:#fc4c02; font-size:0.9rem;">
                <i class='bx bxl-strava'></i> <b>${data.stravaData.distancia}</b> | ${data.stravaData.tempo}
            </div>`;
        }

        const colorMap = { 'planejado': '#999', 'realizado': 'green', 'nao_realizado': 'red' };
        
        el.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${new Date(data.date).toLocaleDateString('pt-BR')}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag" style="background:${colorMap[data.status] || '#999'}">${data.status}</span>
            </div>
            <div class="workout-card-body">
                <p style="white-space:pre-wrap;">${desc}</p>
                ${data.feedback ? `<div class="feedback-text"><strong>Aluno:</strong> ${data.feedback}</div>` : ''}
                ${stravaHTML}
                ${data.imageUrl ? `<img src="${data.imageUrl}" style="width:100%; margin-top:10px;">` : ''}
            </div>
            <div class="workout-card-footer">
                <button class="btn btn-secondary btn-small" onclick="AppPrincipal.openFeedbackModal('${id}', '${ownerId}', '${data.title}')">Detalhes / Avaliar</button>
            </div>
        `;
        return el;
    },

    renderFeedbackTable: () => {
        const div = document.getElementById('feedback-table');
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(50).once('value', s => {
            if(!s.exists()) { div.innerHTML = "<p>Nada recente.</p>"; return; }
            let html = `<div class="feedback-table-container"><table class="feedback-table"><thead><tr><th>Aluno</th><th>Treino</th><th>Ação</th></tr></thead><tbody>`;
            const list = [];
            s.forEach(c => list.push({k: c.key, ...c.val()}));
            list.reverse();
            list.forEach(i => {
                html += `<tr><td>${i.ownerName}</td><td>${i.title}<br><small>${new Date(i.realizadoAt).toLocaleDateString()}</small></td><td><button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${i.k}', '${i.ownerId}', '${i.title}')">Ver</button></td></tr>`;
            });
            html += `</tbody></table></div>`;
            div.innerHTML = html;
        });
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, ...c.val() }));
            arr.sort((a,b) => new Date(a.date) - new Date(b.date));
            arr.forEach(w => list.appendChild(AdminPanel.createWorkoutCard(w.k, w, user.uid)));
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem novidades.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, ...c.val() }));
            arr.reverse();
            arr.forEach(i => {
                const card = AdminPanel.createWorkoutCard(i.k, i, i.ownerId);
                const header = document.createElement('div');
                header.style.padding = "10px 10px 0 10px";
                header.innerHTML = `<strong>${i.ownerName}</strong> realizou:`;
                card.prepend(header);
                
                const footer = card.querySelector('.workout-card-footer');
                footer.innerHTML = `<button class="btn btn-nav" onclick="AppPrincipal.openFeedbackModal('${i.k}', '${i.ownerId}', '${i.title}')">Comentar</button>`;
                
                list.appendChild(card);
            });
        });
    }
};
