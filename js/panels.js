/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V5.3 - SISRUN DASHBOARD COMPLETO)
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        // DASHBOARD LAYOUT
        document.getElementById('app-main-content').innerHTML = `
            <div class="admin-dashboard">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <span style="color:#666">Olá, Coach!</span>
                </div>
                
                <div class="dashboard-grid">
                    <div class="dash-card" onclick="AdminPanel.show('feedbacks')">
                        <i class='bx bx-message-square-check'></i>
                        <span>Feedbacks <span id="bg-feed" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.show('alunos')">
                        <i class='bx bx-group'></i>
                        <span>Alunos <span id="bg-alunos" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.show('aprovacoes')">
                        <i class='bx bx-user-plus'></i>
                        <span>Pendentes <span id="bg-pend" class="badge-count">0</span></span>
                    </div>
                    <div class="dash-card" onclick="alert('Em breve')">
                        <i class='bx bx-dollar-circle'></i><span>Financeiro</span>
                    </div>
                </div>

                <div id="admin-area" class="panel" style="min-height:300px"></div>
            </div>
        `;
        
        AdminPanel.elements.area = document.getElementById('admin-area');
        AdminPanel.loadCounts();
        AdminPanel.show('feedbacks');
    },

    loadCounts: () => {
        const db = AdminPanel.state.db;
        db.ref('users').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            if(document.getElementById('bg-alunos')) document.getElementById('bg-alunos').textContent = Object.keys(s.val()||{}).length;
        });
        db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            if(s.exists() && document.getElementById('bg-feed')) document.getElementById('bg-feed').textContent = s.numChildren();
        });
        db.ref('pendingApprovals').on('value', s => {
            if(document.getElementById('bg-pend')) document.getElementById('bg-pend').textContent = s.exists() ? s.numChildren() : 0;
        });
    },

    show: (sec) => {
        const area = AdminPanel.elements.area;
        area.innerHTML = "";
        
        if (sec === 'feedbacks') {
            area.innerHTML = `<h3><i class='bx bx-list-check'></i> Central de Feedbacks</h3><div id="feed-tbl">Carregando...</div>`;
            AdminPanel.renderFeedTable();
        } else if (sec === 'alunos') {
            area.innerHTML = `<h3><i class='bx bx-user'></i> Alunos</h3><div id="alist"></div>`;
            AdminPanel.renderAlunos();
        } else if (sec === 'aprovacoes') {
            area.innerHTML = `<h3>Pendentes</h3><div id="plist"></div>`;
            AdminPanel.renderPendentes();
        }
    },

    renderFeedTable: () => {
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(50).once('value', s => {
            const d = document.getElementById('feed-tbl');
            if(!d) return;
            if(!s.exists()) { d.innerHTML = "<p>Sem dados.</p>"; return; }
            
            let h = `<div class="feedback-table-container"><table class="feedback-table"><thead><tr><th>Status</th><th>Aluno</th><th>Treino</th><th>Feedback</th><th></th></tr></thead><tbody>`;
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()})); l.reverse();

            l.forEach(w => {
                const a = AdminPanel.state.athletes[w.ownerId] || {name: w.ownerName};
                const img = a.photoUrl || 'https://placehold.co/30x30/4169E1/fff?text=A';
                h += `<tr>
                    <td><span class="status-dot"></span></td>
                    <td><div class="user-cell"><img src="${img}" class="user-avatar-small"><b>${a.name}</b></div></td>
                    <td><b>${w.title}</b><br><small>${w.date}</small></td>
                    <td><i style="color:#666">${w.feedback||'--'}</i></td>
                    <td><button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}','${w.ownerId}','${w.title}')">Ver</button></td>
                </tr>`;
            });
            d.innerHTML = h + `</tbody></table></div>`;
        });
    },

    renderAlunos: () => {
        const d = document.getElementById('alist');
        Object.entries(AdminPanel.state.athletes).forEach(([uid, u]) => {
            const isMe = uid === AdminPanel.state.currentUser.uid;
            d.innerHTML += `<div class="athlete-list-item" onclick="AdminPanel.openStudent('${uid}','${u.name}')" style="cursor:pointer">
                <b>${u.name}</b> ${isMe ? '(Eu)' : ''} <i class='bx bx-chevron-right' style="float:right"></i>
            </div>`;
        });
    },

    renderPendentes: () => {
        const d = document.getElementById('plist');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            if(!s.exists()) { d.innerHTML = "Nada pendente."; return; }
            s.forEach(c => {
                d.innerHTML += `<div class="pending-item"><span>${c.val().name}</span> 
                <button class="btn btn-small btn-success" onclick="AdminPanel.approve('${c.key}', '${c.val().name}', '${c.val().email}')">OK</button></div>`;
            });
        });
    },

    openStudent: (uid, name) => {
        // Lógica simplificada de Workspace para não estourar tamanho
        const area = AdminPanel.elements.area;
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between"><h3>${name}</h3> <button class="btn btn-small" onclick="AdminPanel.show('alunos')">Voltar</button></div>
            <div class="admin-tabs"><button class="tab-btn active">Planilha</button></div>
            <div id="student-workouts">Carregando...</div>
            <hr>
            <h4>Adicionar Treino</h4>
            <form id="add-w-form" class="form-minimal">
                <input type="date" id="wd" required> <input type="text" id="wt" placeholder="Título" required>
                <textarea id="wo" placeholder="Detalhes"></textarea>
                <button type="submit" class="btn btn-secondary">Salvar</button>
            </form>
        `;
        
        // Load Workouts
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(30).on('value', s => {
            const wd = document.getElementById('student-workouts');
            if(!wd) return;
            wd.innerHTML = "";
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                const color = w.status==='realizado'?'green':'#999';
                wd.innerHTML += `<div class="workout-card">
                    <div class="workout-card-header"><span style="color:${color}">${w.status}</span> <b>${w.title}</b> <small>${w.date}</small></div>
                    <div class="workout-card-body">${w.description} <br> ${w.stravaData ? `<b style="color:#fc4c02">Strava: ${w.stravaData.distancia}</b>` : ''}</div>
                    <div class="workout-card-footer"><button class="btn btn-small btn-danger" onclick="AdminPanel.del('${uid}','${w.k}')">X</button></div>
                </div>`;
            });
        });

        // Add Workout
        document.getElementById('add-w-form').onsubmit = (e) => {
            e.preventDefault();
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push({
                date: document.getElementById('wd').value,
                title: document.getElementById('wt').value,
                description: document.getElementById('wo').value,
                status: 'planejado', createdBy: AdminPanel.state.currentUser.uid
            });
            e.target.reset();
        };
    },

    approve: (uid, name, email) => {
        const u = {}; u[`/users/${uid}`] = {name, email, role:'atleta'}; u[`/data/${uid}`]={workouts:{}}; u[`/pendingApprovals/${uid}`]=null;
        AdminPanel.state.db.ref().update(u).then(()=>AdminPanel.show('aprovacoes'));
    },
    del: (uid, wid) => { if(confirm('Apagar?')) AdminPanel.state.db.ref(`data/${uid}/workouts/${wid}`).remove(); }
};

// ATLETA E FEED (MANTIDOS E FUNCIONAIS)
const AtletaPanel = {
    init: (u, db) => {
        const list = document.getElementById('atleta-workouts-list');
        if(document.getElementById('log-manual-activity-btn')) 
            document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        
        list.innerHTML = "Carregando...";
        db.ref(`data/${u.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                const st = w.stravaData ? `<br><small style="color:#fc4c02">Strava Sync</small>` : '';
                const card = document.createElement('div'); card.className = 'workout-card';
                card.innerHTML = `<div class="workout-card-header"><b>${w.title}</b> <span>${w.date}</span></div>
                <div class="workout-card-body">${w.description} ${st}</div>
                <div class="workout-card-footer"><button class="btn btn-small btn-primary">Feedback</button></div>`;
                card.onclick = (e) => { if(!e.target.closest('button')) AppPrincipal.openFeedbackModal(w.k, u.uid, w.title); };
                list.appendChild(card);
            });
        });
    }
};

const FeedPanel = {
    init: (u, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); l.reverse();
            l.forEach(w => {
                const card = document.createElement('div'); card.className = 'workout-card';
                card.innerHTML = `<div class="workout-card-header"><b>${w.ownerName || 'Atleta'}</b> completou <b>${w.title}</b></div>
                <div class="workout-card-body">${w.feedback || 'Sem feedback.'}</div>`;
                list.appendChild(card);
            });
        });
    }
};
