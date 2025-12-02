/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V2.0 RESTAURADA + SISRUN ADMIN)
/* =================================================================== */

// 1. ADMIN PANEL (VISUAL SISRUN)
const AdminPanel = {
    state: { db: null, currentUser: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel SisRun: Iniciado.");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        document.getElementById('app-main-content').innerHTML = `
            <div class="admin-dashboard">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <div class="user-display" style="color:#666;">${user.displayName || 'Coach'}</div>
                </div>
                
                <div class="dashboard-grid">
                    <div class="dash-card" onclick="AdminPanel.showSection('feedbacks')">
                        <i class='bx bx-message-square-check'></i>
                        <span>Feedbacks <span id="badge-feed" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('alunos')">
                        <i class='bx bx-group'></i>
                        <span>Alunos <span id="badge-alunos" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.showSection('aprovacoes')">
                        <i class='bx bx-user-plus'></i>
                        <span>Pendentes <span id="badge-aprovacoes" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="alert('Em breve')">
                        <i class='bx bx-dollar-circle'></i><span>Financeiro</span>
                    </div>
                </div>

                <div id="admin-content-area" class="panel" style="min-height: 400px;"></div>
            </div>
        `;
        
        AdminPanel.elements.contentArea = document.getElementById('admin-content-area');
        AdminPanel.loadData();
        AdminPanel.showSection('feedbacks');
    },

    loadData: () => {
        const db = AdminPanel.state.db;
        db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(document.getElementById('badge-alunos')) document.getElementById('badge-alunos').textContent = Object.keys(AdminPanel.state.athletes).length;
        });
        // CARREGA TUDO (SEM LIMITES)
        db.ref('publicWorkouts').on('value', s => {
            if(s.exists() && document.getElementById('badge-feed')) document.getElementById('badge-feed').textContent = s.numChildren();
            if(AdminPanel.state.currentSection === 'feedbacks') AdminPanel.renderFeedbackTable();
        });
        db.ref('pendingApprovals').on('value', s => {
            if(document.getElementById('badge-aprovacoes')) document.getElementById('badge-aprovacoes').textContent = s.exists() ? s.numChildren() : 0;
        });
    },

    showSection: (section) => {
        AdminPanel.state.currentSection = section;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = "";

        if (section === 'feedbacks') {
            area.innerHTML = `<h3><i class='bx bx-list-check'></i> Central de Feedbacks</h3><div id="feedback-list">Carregando...</div>`;
            AdminPanel.renderFeedbackTable();
        } else if (section === 'alunos') {
            area.innerHTML = `<h3><i class='bx bx-user'></i> Gestão de Alunos</h3><div id="athlete-list-container"></div>`;
            AdminPanel.renderAthleteList();
        } else if (section === 'aprovacoes') {
            area.innerHTML = `<h3>Aprovações</h3><div id="pending-list"></div>`;
            AdminPanel.renderPendingList();
        }
    },

    renderFeedbackTable: () => {
        // Busca TUDO sem travas
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').once('value', snap => {
            const div = document.getElementById('feedback-list');
            if(!div) return;

            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino encontrado.</p>"; return; }
            
            let html = `<div class="feedback-table-container"><table class="feedback-table"><thead><tr><th>Status</th><th>Aluno</th><th>Treino</th><th>Feedback</th><th>Ação</th></tr></thead><tbody>`;
            const list = []; 
            snap.forEach(c => list.push({ k: c.key, ...c.val() })); 
            list.reverse();

            list.forEach(w => {
                const atleta = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName || "Aluno" };
                const stravaBadge = w.stravaData ? `<span style="color:#fc4c02; font-weight:bold; font-size:0.8rem;"><i class='bx bxl-strava'></i> Sync</span>` : '';
                
                // Data segura
                let dateStr = w.date;
                try { if(w.realizadoAt) dateStr = new Date(w.realizadoAt).toLocaleDateString('pt-BR'); } catch(e){}

                html += `
                    <tr>
                        <td><span class="status-dot"></span></td>
                        <td>
                            <div class="user-cell">
                                <strong>${atleta.name}</strong>
                            </div>
                        </td>
                        <td>
                            <div style="font-weight:bold;">${w.title}</div>
                            <small style="color:#777;">${dateStr} ${stravaBadge}</small>
                        </td>
                        <td style="max-width:300px;">
                            <div style="font-style:italic; color:#555; font-size:0.9rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                "${w.feedback || 'Sem feedback'}"
                            </div>
                        </td>
                        <td>
                            <button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${w.ownerId}', '${w.title}')">Ver</button>
                        </td>
                    </tr>
                `;
            });
            div.innerHTML = html + `</tbody></table></div>`;
        });
    },

    renderAthleteList: () => {
        const div = document.getElementById('athlete-list-container');
        if(!div) return;
        div.innerHTML = "";
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            const isMe = uid === AdminPanel.state.currentUser.uid;
            div.innerHTML += `
                <div class="athlete-list-item" style="padding:10px; border:1px solid #ddd; margin-bottom:5px; cursor:pointer;" onclick="AdminPanel.openWorkspace('${uid}', '${data.name}')">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div><span style="font-weight:bold;">${data.name}</span> ${isMe ? '<small style="color:var(--secondary-color)">(Eu)</small>' : ''}</div>
                    </div>
                    <i class='bx bx-chevron-right'></i>
                </div>`;
        });
    },

    openWorkspace: (uid, name) => {
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;"><h3>${name}</h3> <button class="btn btn-small btn-secondary" onclick="AdminPanel.showSection('alunos')">Voltar</button></div>
            <div id="student-workouts">Carregando planilha...</div>
            <hr>
            <h4>Adicionar Treino</h4>
            <form id="add-w-form" class="form-minimal">
                <input type="date" id="wd" required> <input type="text" id="wt" placeholder="Título" required>
                <textarea id="wo" placeholder="Detalhes" rows="3"></textarea>
                <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Salvar</button>
            </form>
        `;
        
        // BUSCA POR DATA (IGUAL VERSÃO 2)
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            const d = document.getElementById('student-workouts');
            if(!d) return; 
            if(!s.exists()) { d.innerHTML = "<p>Sem treinos.</p>"; return; }
            d.innerHTML = "";
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()})); 
            l.sort((a,b) => new Date(b.date) - new Date(a.date)); 

            l.forEach(w => {
                const color = w.status === 'realizado' ? 'var(--success-color)' : '#999';
                let stravaInfo = w.stravaData ? `<div style="font-size:0.85rem; margin-top:5px; color:#fc4c02"><i class='bx bxl-strava'></i> ${w.stravaData.distancia}</div>` : '';
                
                d.innerHTML += `
                    <div class="workout-card">
                        <div class="workout-card-header">
                            <span class="date">${new Date(w.date).toLocaleDateString('pt-BR')}</span>
                            <span class="title">${w.title}</span>
                            <span class="status-tag" style="background:${color}">${w.status}</span>
                        </div>
                        <div class="workout-card-body">
                            <p style="white-space:pre-wrap;">${w.description}</p>
                            ${stravaInfo}
                            ${w.feedback ? `<div class="feedback-text"><strong>Feedback:</strong> ${w.feedback}</div>` : ''}
                        </div>
                        <div class="workout-card-footer">
                            <button class="btn btn-small" onclick="AppPrincipal.openFeedbackModal('${w.k}','${uid}','${w.title}')">Detalhes</button>
                            <button class="btn btn-small btn-danger" onclick="AdminPanel.del('${uid}','${w.k}')"><i class='bx bx-trash'></i></button>
                        </div>
                    </div>`;
            });
        });

        document.getElementById('add-w-form').onsubmit = (e) => {
            e.preventDefault();
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push({
                date: document.getElementById('wd').value, title: document.getElementById('wt').value, description: document.getElementById('wo').value,
                status: 'planejado', createdBy: AdminPanel.state.currentUser.uid
            });
            e.target.reset();
        };
    },

    renderPendingList: () => {
        const div = document.getElementById('pending-list');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            if(!s.exists()) { div.innerHTML = "Nada pendente."; return; }
            div.innerHTML = "";
            s.forEach(c => {
                div.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                    <span>${c.val().name}</span> 
                    <button class="btn btn-small btn-success" onclick="AdminPanel.approve('${c.key}','${c.val().name}','${c.val().email}')">Aceitar</button></div>`;
            });
        });
    },
    approve: (uid, name, email) => {
        const u = {}; u[`/users/${uid}`] = { name, email, role: 'atleta' }; u[`/data/${uid}`] = { workouts: {} }; u[`/pendingApprovals/${uid}`] = null;
        AdminPanel.state.db.ref().update(u).then(() => AdminPanel.showSection('aprovacoes'));
    },
    del: (uid, wid) => { if(confirm('Apagar?')) AdminPanel.state.db.ref(`data/${uid}/workouts/${wid}`).remove(); }
};

// 2. ATLETA PANEL (RESTAURADO PARA A VERSÃO 2 EXATA)
const AtletaPanel = {
    state: {}, elements: {},
    init: (user, db) => {
        AtletaPanel.state = { db, currentUser: user };
        AtletaPanel.elements = { workoutsList: document.getElementById('atleta-workouts-list'), logBtn: document.getElementById('log-manual-activity-btn') };
        if(AtletaPanel.elements.logBtn) AtletaPanel.elements.logBtn.onclick = AppPrincipal.openLogActivityModal;
        AtletaPanel.loadWorkouts(user.uid);
    },
    loadWorkouts: (uid) => {
        const list = AtletaPanel.elements.workoutsList;
        list.innerHTML = "Carregando...";
        
        // Busca por DATA (Isso garante que os treinos antigos apareçam)
        AtletaPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem treinos na planilha.</p>"; return; }
            
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); 
            l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            
            l.forEach(w => {
                const st = w.stravaData ? `<br><small style="color:#fc4c02">Strava Sync</small>` : '';
                const color = w.status === 'realizado' ? 'var(--success-color)' : '#999';
                
                // Criação do Card Simples (igual ao que funcionava antes)
                const card = document.createElement('div'); 
                card.className = 'workout-card';
                card.innerHTML = `
                    <div class="workout-card-header">
                        <b>${w.title}</b> <span>${new Date(w.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div class="workout-card-body">${w.description} ${st}</div>
                    <div class="workout-card-footer">
                        <button class="btn btn-small btn-primary">Feedback</button>
                    </div>`;
                card.onclick = (e) => { if(!e.target.closest('button')) AppPrincipal.openFeedbackModal(w.k, uid, w.title); };
                list.appendChild(card);
            });
        });
    }
};

// 3. FEED PANEL (RESTAURADO DA VERSÃO 2)
const FeedPanel = {
    state: {}, elements: {},
    init: (user, db) => {
        FeedPanel.state = { db, currentUser: user };
        FeedPanel.elements = { feedList: document.getElementById('feed-list') };
        FeedPanel.loadFeed();
    },
    loadFeed: () => {
        const list = FeedPanel.elements.feedList;
        list.innerHTML = "Carregando...";
        FeedPanel.state.db.ref('publicWorkouts').limitToLast(50).on('value', s => {
            list.innerHTML = "";
            const arr = []; s.forEach(c => arr.push(c.val())); arr.reverse();
            arr.forEach(w => {
                const card = document.createElement('div'); card.className = 'workout-card';
                card.innerHTML = `<div class="workout-card-header"><b>${w.ownerName}</b> completou <b>${w.title}</b></div><div class="workout-card-body">${w.feedback || 'Treino realizado.'}</div>`;
                list.appendChild(card);
            });
        });
    }
};