/* =================================================================== */
/* PANELS.JS V7.1 - IA FIX + PLANILHA ROBUSTA
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        const mainContent = document.getElementById('app-main-content');
        mainContent.innerHTML = `
            <div class="sisrun-dashboard">
                <div class="dashboard-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="coach-avatar"><i class='bx bxs-user'></i></div>
                        <div>
                            <h2 style="margin:0; font-size:1.4rem;">Painel do Treinador</h2>
                            <span style="font-size:0.9rem; color:#666;">Sistema LeRunners</span>
                        </div>
                    </div>
                    <div class="feedback-stats">
                        <div class="stat-face happy"><i class='bx bxs-happy-heart-eyes'></i> <span id="count-happy">0</span></div>
                        <div class="stat-face neutral"><i class='bx bxs-meh'></i> <span id="count-neutral">0</span></div>
                        <div class="stat-face sad"><i class='bx bxs-sad'></i> <span id="count-sad">0</span></div>
                    </div>
                </div>

                <div class="actions-grid">
                    <div class="action-card" onclick="AdminPanel.showSection('alunos')">
                        <i class='bx bxs-group' style="color: #007bff;"></i>
                        <span>Alunos <span id="badge-alunos" class="badge">0</span></span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('feedbacks')">
                        <i class='bx bx-list-check' style="color: #28a745;"></i>
                        <span>Feedbacks</span>
                    </div>
                     <div class="action-card" onclick="AdminPanel.showSection('planilhas')">
                        <i class='bx bxs-calendar' style="color: #6f42c1;"></i>
                        <span>Planilhas</span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('aprovacoes')">
                        <i class='bx bxs-user-plus' style="color: #dc3545;"></i>
                        <span>Aprovações <span id="badge-aprovacoes" class="badge">0</span></span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('financeiro')">
                        <i class='bx bxs-dollar-circle' style="color: #ffc107;"></i>
                        <span>Financeiro</span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('ia')">
                        <i class='bx bxs-brain' style="color: #17a2b8;"></i>
                        <span>IA Analysis</span>
                    </div>
                </div>

                <div id="admin-content-area" class="content-panel"></div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        AdminPanel.showSection('feedbacks'); 
    },

    loadData: () => {
        AdminPanel.state.db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(document.getElementById('badge-alunos')) document.getElementById('badge-alunos').textContent = Object.keys(AdminPanel.state.athletes).length;
        });

        AdminPanel.state.db.ref('publicWorkouts').limitToLast(100).on('value', s => {
            if(!s.exists()) return;
            let happy=0, neutral=0, sad=0;
            s.forEach(c => {
                const w = c.val();
                if (w.status === 'nao_realizado') sad++;
                else if (w.stravaData) happy++; 
                else neutral++;
            });
            if(document.getElementById('count-happy')) document.getElementById('count-happy').textContent = happy;
            if(document.getElementById('count-neutral')) document.getElementById('count-neutral').textContent = neutral;
            if(document.getElementById('count-sad')) document.getElementById('count-sad').textContent = sad;
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable();
        });

        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            if(document.getElementById('badge-aprovacoes')) document.getElementById('badge-aprovacoes').textContent = s.exists() ? s.numChildren() : 0;
        });
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'feedbacks') {
            area.innerHTML = `<h3><i class='bx bx-check-double'></i> Feedbacks (Strava Sync)</h3><div id="feedback-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        } 
        else if (section === 'alunos') {
            area.innerHTML = `
                <h3><i class='bx bx-group'></i> Meus Alunos</h3>
                <input type="text" id="athlete-search" class="search-input" placeholder="Buscar aluno..." onkeyup="AdminPanel.renderAthleteList(this.value)">
                <div id="athlete-list-container" class="athlete-grid"></div>
                <div id="athlete-workspace" class="workspace hidden"></div>
            `;
            AdminPanel.renderAthleteList();
        }
        else if (section === 'ia') {
            area.innerHTML = `
                <div class="section-header">
                    <h3><i class='bx bxs-brain'></i> Inteligência Artificial (KPIs)</h3>
                    <p>Selecione um aluno para gerar um relatório completo de performance.</p>
                </div>
                <div style="margin-top:20px; max-width:600px;">
                    <label>Aluno:</label>
                    <select id="ia-athlete-select" class="search-input"><option value="">Selecione...</option></select>
                    <button class="btn btn-primary" style="margin-top:10px; width:100%;" onclick="AdminPanel.runGlobalIA()">
                        <i class='bx bx-analyse'></i> Analisar Performance com Gemini
                    </button>
                </div>
                <div id="global-ia-output" style="margin-top:20px; padding:20px; background:#fff; border-radius:8px; border:1px solid #ccc; min-height:100px;">
                    O relatório aparecerá aqui.
                </div>
            `;
            AdminPanel.populateAthleteSelect();
        }
        else if (section === 'aprovacoes') {
             area.innerHTML = `<h3>Aprovações Pendentes</h3><div id="pending-list"></div>`;
             AdminPanel.renderPendingList();
        }
    },

    renderFeedbackTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(100).once('value', snap => {
            const div = document.getElementById('feedback-list');
            if (!div) return;
            if (!snap.exists()) { div.innerHTML = "<p>Sem dados.</p>"; return; }

            let html = `<table class="sisrun-table">
                <thead><tr><th>St</th><th>Aluno</th><th>Treino</th><th>Detalhes</th><th>Ver</th></tr></thead><tbody>`;
            
            const list = [];
            snap.forEach(c => list.push({ k: c.key, ...c.val() }));
            list.reverse();

            list.forEach(w => {
                const atleta = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName };
                const foto = atleta.photoUrl || 'https://placehold.co/40x40/4169E1/FFFFFF?text=AT';
                const dataStr = new Date(w.realizadoAt).toLocaleDateString('pt-BR');
                
                let statusIcon = `<i class='bx bxs-check-circle' style="color:#28a745; font-size:1.4rem;"></i>`; 
                if(w.status === 'nao_realizado') statusIcon = `<i class='bx bxs-x-circle' style="color:#dc3545; font-size:1.4rem;"></i>`;
                
                let stravaDetails = `<span style="color:#ccc;">Manual</span>`;
                if(w.stravaData) {
                    stravaDetails = `
                        <div class="strava-pill">
                            <i class='bx bxl-strava'></i> 
                            <b>${w.stravaData.distancia}</b> | ${w.stravaData.tempo} <br>
                            Pace: ${w.stravaData.ritmo}
                        </div>
                    `;
                }

                html += `
                    <tr>
                        <td align="center">${statusIcon}</td>
                        <td><div class="user-info"><img src="${foto}"><div><strong>${atleta.name}</strong><br><small>${dataStr}</small></div></div></td>
                        <td><div class="workout-title">${w.title}</div><small>"${w.feedback || ''}"</small></td>
                        <td>${stravaDetails}</td>
                        <td><button class="btn-icon" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${w.ownerId}', '${w.title}')"><i class='bx bx-search-alt'></i></button></td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            div.innerHTML = html;
        });
    },

    populateAthleteSelect: () => {
        const sel = document.getElementById('ia-athlete-select');
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            const opt = document.createElement('option'); opt.value = uid; opt.textContent = data.name; sel.appendChild(opt);
        });
    },

    runGlobalIA: async () => {
        const uid = document.getElementById('ia-athlete-select').value;
        const out = document.getElementById('global-ia-output');
        if(!uid) return alert("Selecione um aluno!");
        
        out.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A IA está analisando o histórico... aguarde.";
        
        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(20).once('value');
            if(!snap.exists()) throw new Error("Sem treinos suficientes.");
            const data = snap.val();
            const prompt = `Analise os treinos deste atleta. Foco: Evolução de Pace, Volume Semanal e Consistência. Dados JSON: ${JSON.stringify(data)}`;
            const res = await AppPrincipal.callGeminiTextAPI(prompt);
            out.innerHTML = res.replace(/\n/g, '<br>');
        } catch(e) { out.textContent = "Erro na análise: " + e.message; }
    },

    renderAthleteList: (filter = "") => {
        const div = document.getElementById('athlete-list-container');
        if (!div) return;
        div.innerHTML = "";
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;
            const card = document.createElement('div');
            card.className = 'athlete-card-mini';
            card.innerHTML = `<img src="${data.photoUrl||'https://placehold.co/50x50/ccc/fff'}"><div class="info"><strong>${data.name}</strong><span>Ativo</span></div><button class="btn-arrow"><i class='bx bx-chevron-right'></i></button>`;
            card.onclick = () => AdminPanel.openWorkspace(uid, data.name);
            div.appendChild(card);
        });
    },
    
    openWorkspace: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        const ws = document.getElementById('athlete-workspace');
        ws.classList.remove('hidden');
        document.getElementById('athlete-list-container').classList.add('hidden');
        ws.innerHTML = `
            <div class="workspace-header"><h3>${name} - Planilha</h3><button class="btn btn-secondary btn-small" onclick="AdminPanel.closeWorkspace()">Fechar</button></div>
            <div class="prescription-box">
                <div class="presc-header"><strong>Adicionar Treino</strong></div>
                <form id="ws-add-form">
                    <div class="row">
                        <input type="date" id="ws-date" required class="input-date">
                        <select id="ws-type"><option>Rodagem</option><option>Tiro</option><option>Longo</option></select>
                        <input type="text" id="ws-dist" placeholder="Km" style="flex:1">
                    </div>
                    <input type="text" id="ws-title" placeholder="Título do Treino" required style="width:100%; margin-bottom:10px;">
                    <textarea id="ws-obs" rows="3" placeholder="Detalhes..." style="width:100%;"></textarea>
                    <button type="submit" class="btn btn-success" style="width:100%; margin-top:10px;">Salvar</button>
                </form>
            </div>
            <div id="ws-timeline">Carregando...</div>
        `;
        document.getElementById('ws-add-form').onsubmit = (e) => {
            e.preventDefault();
            const data = {
                date: document.getElementById('ws-date').value, title: document.getElementById('ws-title').value,
                description: `[${document.getElementById('ws-type').value}] ${document.getElementById('ws-dist').value}km\n${document.getElementById('ws-obs').value}`,
                status: 'planejado', createdBy: AdminPanel.state.currentUser.uid, createdAt: new Date().toISOString()
            };
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data);
            alert("Salvo!"); e.target.reset();
        };
        AdminPanel.loadWorkspaceWorkouts(uid);
    },
    
    closeWorkspace: () => { document.getElementById('athlete-workspace').classList.add('hidden'); document.getElementById('athlete-list-container').classList.remove('hidden'); },
    
    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('ws-timeline');
        try {
            AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
                div.innerHTML = ""; if(!snap.exists()) { div.innerHTML = "Sem treinos."; return; }
                const list = []; 
                snap.forEach(c => list.push({k:c.key, ...c.val()}));
                list.sort((a,b) => new Date(b.date) - new Date(a.date));
                
                list.forEach(w => {
                    const item = document.createElement('div'); item.className = 'timeline-item';
                    const statusClass = w.status === 'realizado' ? 'done' : 'planned';
                    let stravaInfo = w.stravaData ? `<div class="tl-strava"><i class='bx bxl-strava'></i> ${w.stravaData.distancia}</div>` : '';
                    item.innerHTML = `<div class="tl-date"><span>${new Date(w.date).getDate()}</span></div><div class="tl-content ${statusClass}"><div class="tl-header"><strong>${w.title}</strong><span class="tag ${w.status}">${w.status}</span></div><p>${w.description}</p>${stravaInfo}<div class="tl-actions"><button onclick="AppPrincipal.openFeedbackModal('${w.k}', '${uid}', '${w.title}')"><i class='bx bx-edit'></i></button><button onclick="AdminPanel.deleteWorkout('${uid}', '${w.k}')" style="color:red"><i class='bx bx-trash'></i></button></div></div>`;
                    div.appendChild(item);
                });
            });
        } catch(err) {
            div.innerHTML = "Erro ao carregar lista.";
        }
    },
    
    deleteWorkout: (uid, wid) => { if(confirm("Apagar?")) { const u={}; u[`/data/${uid}/workouts/${wid}`]=null; u[`/publicWorkouts/${wid}`]=null; AdminPanel.state.db.ref().update(u); }},
    renderPendingList: () => { 
        const div = document.getElementById('pending-list');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            div.innerHTML = ""; if(!s.exists()) { div.innerHTML = "Nada pendente."; return; }
            s.forEach(c => {
                div.innerHTML += `<div><b>${c.val().name}</b> <button onclick="AdminPanel.approve('${c.key}','${c.val().name}','${c.val().email}')">OK</button></div>`;
            });
        });
    },
    approve: (uid, n, e) => {
        const u={}; u[`/users/${uid}`]={name:n, email:e, role:'atleta'}; u[`/data/${uid}`]={workouts:{}}; u[`/pendingApprovals/${uid}`]=null;
        AdminPanel.state.db.ref().update(u).then(() => AdminPanel.showSection('aprovacoes'));
    }
};

const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        list.innerHTML = "Carregando...";
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = ""; if(!s.exists()) { list.innerHTML = "Sem treinos."; return; }
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()}));
            l.sort((a,b) => new Date(b.date) - new Date(a.date));
            l.forEach(w => {
                const div = document.createElement('div'); div.className = 'workout-card';
                div.innerHTML = `<div class="workout-card-header"><strong>${w.title}</strong><span class="status-tag ${w.status}">${w.status}</span></div><p>${w.description}</p>`;
                div.onclick = (e) => { if(!e.target.closest('button')) AppPrincipal.openFeedbackModal(w.k, user.uid, w.title); };
                list.appendChild(div);
            });
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            list.innerHTML = ""; if(!s.exists()) return;
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()}));
            l.reverse().forEach(w => {
                const div = document.createElement('div'); div.className = 'workout-card';
                div.innerHTML = `<strong>${w.ownerName}</strong><br>${w.title}<br><i>${w.feedback}</i>`;
                div.onclick = () => AppPrincipal.openFeedbackModal(w.k, w.ownerId, w.title);
                list.appendChild(div);
            });
        });
    }
};
