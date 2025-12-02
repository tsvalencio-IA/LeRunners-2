/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V6.0 - SISRUN CLONE FINAL)
/* Baseado na análise dos vídeos 1, 2 e 3.
/* =================================================================== */

// ===================================================================
// 1. ADMIN PANEL - VISÃO DO COACH (LEANDRO)
// ===================================================================
const AdminPanel = {
    state: { db: null, currentUser: null, selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V6.0: Inicializando clone SisRun...");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        // Renderiza a Estrutura Principal
        const mainContent = document.getElementById('app-main-content');
        mainContent.innerHTML = `
            <div class="sisrun-dashboard">
                <div class="dashboard-header">
                    <h2><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <div class="feedback-stats">
                        <div class="stat-face happy"><i class='bx bxs-happy-heart-eyes'></i> <span id="count-happy">0</span></div>
                        <div class="stat-face neutral"><i class='bx bxs-meh'></i> <span id="count-neutral">0</span></div>
                        <div class="stat-face sad"><i class='bx bxs-sad'></i> <span id="count-sad">0</span></div>
                        <div class="stat-label">Feedbacks do mês</div>
                    </div>
                </div>

                <div class="actions-grid">
                    <div class="action-card" onclick="AdminPanel.showSection('alunos')">
                        <i class='bx bx-user' style="color: #007bff;"></i>
                        <span>Alunos <span id="badge-alunos" class="badge">0</span></span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('feedbacks')">
                        <i class='bx bx-list-check' style="color: #28a745;"></i>
                        <span>Feedbacks</span>
                    </div>
                     <div class="action-card" onclick="AdminPanel.showSection('planilhas')">
                        <i class='bx bx-calendar' style="color: #6f42c1;"></i>
                        <span>Planilhas</span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('aprovacoes')">
                        <i class='bx bx-user-plus' style="color: #dc3545;"></i>
                        <span>Aprovações <span id="badge-aprovacoes" class="badge">0</span></span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('financeiro')">
                        <i class='bx bx-dollar-circle' style="color: #ffc107;"></i>
                        <span>Financeiro</span>
                    </div>
                    <div class="action-card" onclick="AdminPanel.showSection('ia')">
                        <i class='bx bxs-brain' style="color: #17a2b8;"></i>
                        <span>IA LeRunners</span>
                    </div>
                </div>

                <div id="admin-content-area" class="content-panel">
                    </div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        // Inicia na tela de feedbacks (A mais usada no vídeo)
        AdminPanel.showSection('feedbacks'); 
    },

    loadData: () => {
        // Carrega Alunos
        AdminPanel.state.db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            const count = Object.keys(AdminPanel.state.athletes).length;
            if(document.getElementById('badge-alunos')) document.getElementById('badge-alunos').textContent = count;
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });

        // Carrega Feedbacks (para as carinhas e lista)
        AdminPanel.state.db.ref('publicWorkouts').limitToLast(50).on('value', s => {
            if(!s.exists()) return;
            
            // Lógica simples para as carinhas (baseada no feedback de texto por enquanto)
            let happy=0, neutral=0, sad=0;
            s.forEach(c => {
                const w = c.val();
                // Simulação: se tem Strava é Happy, se não tem é Neutral (apenas para visual)
                if(w.stravaData) happy++; else neutral++;
            });
            if(document.getElementById('count-happy')) document.getElementById('count-happy').textContent = happy;
            if(document.getElementById('count-neutral')) document.getElementById('count-neutral').textContent = neutral;
            
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable();
        });

        // Pendentes
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            const count = s.exists() ? s.numChildren() : 0;
            if(document.getElementById('badge-aprovacoes')) document.getElementById('badge-aprovacoes').textContent = count;
        });
    },

    // --- ROTEADOR DE SEÇÕES ---
    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'feedbacks') {
            area.innerHTML = `
                <div class="section-header">
                    <h3><i class='bx bx-check-double'></i> Acompanhamento de Feedbacks</h3>
                    <input type="text" placeholder="Filtrar por aluno..." class="search-input-small">
                </div>
                <div id="feedback-list">Carregando...</div>
            `;
            AdminPanel.renderFeedbackTable();
        } 
        else if (section === 'alunos') {
            area.innerHTML = `
                <div class="section-header">
                    <h3><i class='bx bx-group'></i> Meus Alunos</h3>
                    <button class="btn btn-primary btn-small"><i class='bx bx-user-plus'></i> Novo</button>
                </div>
                <input type="text" id="athlete-search" class="search-input" placeholder="Buscar aluno..." onkeyup="AdminPanel.renderAthleteList(this.value)">
                
                <div id="athlete-list-container" class="athlete-grid"></div>
                
                <div id="athlete-workspace" class="workspace hidden">
                    <div class="workspace-header">
                        <div>
                            <h3 id="workspace-title">Nome do Aluno</h3>
                            <span class="workspace-subtitle">Planilha Mensal</span>
                        </div>
                        <button class="btn btn-secondary btn-small" onclick="AdminPanel.closeWorkspace()">X Fechar</button>
                    </div>
                    
                    <div class="workspace-tabs">
                        <button class="ws-tab active" onclick="AdminPanel.wsTab('planilha')">Planilha</button>
                        <button class="ws-tab" onclick="AdminPanel.wsTab('dados')">Dados</button>
                        <button class="ws-tab" onclick="AdminPanel.wsTab('ia')">IA Analysis</button>
                    </div>

                    <div id="ws-content-planilha" class="ws-content">
                        <div class="prescription-box">
                            <div class="presc-header">
                                <strong>Adicionar Treino</strong>
                                <div class="presc-type-toggle">
                                    <label><input type="radio" name="ptype" checked> Simples</label>
                                    <label><input type="radio" name="ptype"> Estruturado</label>
                                </div>
                            </div>
                            <form id="add-workout-form" class="presc-form">
                                <div class="row">
                                    <input type="date" id="w-date" required class="input-date">
                                    <select id="w-mod"><option>Corrida</option><option>Caminhada</option><option>Bike</option></select>
                                    <select id="w-type"><option>Rodagem</option><option>Intervalado</option><option>Longo</option></select>
                                    <select id="w-int"><option>Z1 - Leve</option><option>Z2 - Moderado</option><option>Z3 - Forte</option></select>
                                </div>
                                <div class="row">
                                    <input type="text" id="w-title" placeholder="Título (ex: Longão de Domingo)" required style="flex:2;">
                                    <input type="text" id="w-dist" placeholder="Distância (km)" style="flex:1;">
                                </div>
                                <div class="structured-area">
                                    <textarea id="w-obs" rows="3" placeholder="Descrição do treino: Aquecimento 10', Principal 3x1000m..."></textarea>
                                </div>
                                <button type="submit" class="btn btn-success" style="width:100%">Salvar na Planilha</button>
                            </form>
                        </div>

                        <div id="workspace-workouts" class="workouts-timeline"></div>
                    </div>
                </div>
            `;
            AdminPanel.renderAthleteList();
            AdminPanel.setupPrescriptionForm();
        }
        else if (section === 'aprovacoes') {
             area.innerHTML = `<h3>Aprovações Pendentes</h3><div id="pending-list"></div>`;
             AdminPanel.renderPendingList();
        }
    },

    // --- TABELA DE FEEDBACKS (CORRIGIDA PARA MOSTRAR STRAVA) ---
    renderFeedbackTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(50).once('value', snap => {
            const div = document.getElementById('feedback-list');
            if (!div) return;
            if (!snap.exists()) { div.innerHTML = "<p>Sem dados.</p>"; return; }

            let html = `<table class="sisrun-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Aluno</th>
                        <th>Treino Realizado</th>
                        <th>Detalhes (Strava/Garmin)</th>
                        <th>Ação</th>
                    </tr>
                </thead>
                <tbody>`;
            
            const list = [];
            snap.forEach(c => list.push({ k: c.key, ...c.val() }));
            list.reverse();

            list.forEach(w => {
                const atleta = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName };
                const foto = atleta.photoUrl || 'https://placehold.co/40x40/4169E1/FFFFFF?text=AT';
                const dataFormatada = new Date(w.realizadoAt).toLocaleDateString('pt-BR');
                
                // Ícone de Status (Corrigido conforme Video 2)
                let statusIcon = `<i class='bx bxs-check-circle' style="color:#28a745; font-size:1.5rem;"></i>`; // Verde
                if(w.status === 'nao_realizado') statusIcon = `<i class='bx bxs-x-circle' style="color:#dc3545; font-size:1.5rem;"></i>`; // Vermelho
                
                // Dados do Strava (O que faltava!)
                let stravaDetails = `<span style="color:#999; font-size:0.8rem;">Manual</span>`;
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
                        <td>
                            <div class="user-info">
                                <img src="${foto}">
                                <div>
                                    <strong>${atleta.name}</strong>
                                    <small>${dataFormatada}</small>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="workout-title">${w.title}</div>
                            <small>"${w.feedback || ''}"</small>
                        </td>
                        <td>${stravaDetails}</td>
                        <td>
                            <button class="btn-icon" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${w.ownerId}', '${w.title}')">
                                <i class='bx bx-search-alt'></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            div.innerHTML = html;
        });
    },

    // --- GESTÃO DE ALUNOS ---
    renderAthleteList: (filter = "") => {
        const div = document.getElementById('athlete-list-container');
        if (!div) return;
        div.innerHTML = "";

        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;
            const isMe = uid === AdminPanel.state.currentUser.uid;
            
            const card = document.createElement('div');
            card.className = 'athlete-card-mini';
            card.innerHTML = `
                <img src="${data.photoUrl || 'https://placehold.co/50x50/ccc/fff'}">
                <div class="info">
                    <strong>${data.name}</strong>
                    <span>Ativo</span>
                </div>
                <button class="btn-arrow"><i class='bx bx-chevron-right'></i></button>
            `;
            card.onclick = () => AdminPanel.openWorkspace(uid, data.name);
            div.appendChild(card);
        });
    },

    // --- WORKSPACE (VÍDEO 3 - PLANILHA) ---
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

    setupPrescriptionForm: () => {
        const form = document.getElementById('add-workout-form');
        if(form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const uid = AdminPanel.state.selectedAthleteId;
                const data = {
                    date: document.getElementById('w-date').value,
                    title: document.getElementById('w-title').value,
                    description: `${document.getElementById('w-mod').value} - ${document.getElementById('w-type').value} (${document.getElementById('w-int').value})\n\n${document.getElementById('w-obs').value}`,
                    status: 'planejado',
                    createdBy: AdminPanel.state.currentUser.uid,
                    createdAt: new Date().toISOString()
                };
                AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data);
                alert("Treino salvo na planilha!");
                form.reset();
            };
        }
    },

    loadWorkspaceWorkouts: (uid) => {
        const div = document.getElementById('workspace-workouts');
        div.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(30).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Sem treinos.</p>"; return; }
            
            const list = [];
            snap.forEach(c => list.push({k:c.key, ...c.val()}));
            // Ordena Data (Futuro -> Passado)
            list.sort((a,b) => new Date(b.date) - new Date(a.date));

            list.forEach(w => {
                // Card de Treino na Planilha (Estilo calendário do Vídeo 3)
                const item = document.createElement('div');
                item.className = 'timeline-item';
                const statusClass = w.status === 'realizado' ? 'done' : 'planned';
                
                item.innerHTML = `
                    <div class="tl-date">
                        <span>${new Date(w.date).getDate()}</span>
                        <small>${new Date(w.date).toLocaleDateString('pt-BR', {month:'short'})}</small>
                    </div>
                    <div class="tl-content ${statusClass}">
                        <div class="tl-header">
                            <strong>${w.title}</strong>
                            <span class="tag">${w.status}</span>
                        </div>
                        <p>${w.description}</p>
                        ${w.stravaData ? `<div class="tl-strava"><i class='bx bxl-strava'></i> ${w.stravaData.distancia}</div>` : ''}
                        <div class="tl-actions">
                            <button onclick="AppPrincipal.openFeedbackModal('${w.k}', '${uid}', '${w.title}')"><i class='bx bx-edit'></i> Detalhes</button>
                        </div>
                    </div>
                `;
                div.appendChild(item);
            });
        });
    },

    // APROVAÇÕES
    renderPendingList: () => {
        const div = document.getElementById('pending-list');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Nenhuma solicitação.</p>"; return; }
            s.forEach(c => {
                const item = document.createElement('div');
                item.className = 'pending-card';
                item.innerHTML = `
                    <b>${c.val().name}</b><br>${c.val().email}
                    <div style="margin-top:10px;">
                        <button class="btn btn-success btn-small" onclick="AdminPanel.approve('${c.key}', '${c.val().name}', '${c.val().email}')">Aprovar</button>
                        <button class="btn btn-danger btn-small" onclick="AdminPanel.reject('${c.key}')">Recusar</button>
                    </div>
                `;
                div.appendChild(item);
            });
        });
    },
    approve: (uid, name, email) => {
        const u = {};
        u[`/users/${uid}`] = { name, email, role: 'atleta', createdAt: new Date().toISOString() };
        u[`/data/${uid}`] = { workouts: {} };
        u[`/pendingApprovals/${uid}`] = null;
        AdminPanel.state.db.ref().update(u).then(() => AdminPanel.showSection('aprovacoes'));
    },
    reject: (uid) => { AdminPanel.state.db.ref(`pendingApprovals/${uid}`).remove().then(() => AdminPanel.showSection('aprovacoes')); }
};

// ===================================================================
// 2. ATLETA & FEED (Mantidos funcionais e integrados)
// ===================================================================
const AtletaPanel = {
    state: { db: null, currentUser: null },
    init: (user, db) => {
        AtletaPanel.state.db = db;
        AtletaPanel.state.currentUser = user;
        const list = document.getElementById('atleta-workouts-list');
        const btn = document.getElementById('log-manual-activity-btn');
        if(btn) btn.onclick = AppPrincipal.openLogActivityModal;

        // Renderiza planilha do aluno (Cards simples)
        list.innerHTML = "Carregando...";
        db.ref(`data/${user.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "Sem treinos."; return; }
            const workouts = [];
            s.forEach(c => workouts.push({k:c.key, ...c.val()}));
            workouts.sort((a,b) => new Date(b.date) - new Date(a.date));
            workouts.forEach(w => {
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.innerHTML = `
                    <div class="workout-card-header">
                        <span class="date">${new Date(w.date).toLocaleDateString()}</span>
                        <strong>${w.title}</strong>
                        <span class="status-tag ${w.status}">${w.status}</span>
                    </div>
                    <div class="workout-card-body">
                        <p>${w.description}</p>
                        ${w.stravaData ? `<div class="strava-data-display"><i class='bx bxl-strava'></i> ${w.stravaData.distancia} | ${w.stravaData.tempo}</div>` : ''}
                    </div>
                `;
                div.onclick = () => AppPrincipal.openFeedbackModal(w.k, user.uid, w.title);
                list.appendChild(div);
            });
        });
    }
};

const FeedPanel = {
    state: { db: null },
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        list.innerHTML = "Carregando...";
        db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) return;
            const items = [];
            s.forEach(c => items.push({k:c.key, ...c.val()}));
            items.reverse().forEach(w => {
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.innerHTML = `
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                        <div style="background:#ddd; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class='bx bx-user'></i></div>
                        <div><b>${w.ownerName}</b><br><small>${w.title}</small></div>
                    </div>
                    <p>${w.feedback || 'Treino concluído.'}</p>
                    ${w.stravaData ? `<div class="strava-data-display"><i class='bx bxl-strava'></i> ${w.stravaData.distancia} | Pace: ${w.stravaData.ritmo}</div>` : ''}
                `;
                list.appendChild(div);
            });
        });
    }
};
