/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V5.7 - CORREÇÃO VISUALIZAÇÃO)
/* - Feedbacks mostram histórico completo
/* - Feed da equipe mostra histórico completo
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        document.getElementById('app-main-content').innerHTML = `
            <div class="admin-dashboard">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2><i class='bx bxs-dashboard'></i> Painel do Treinador</h2>
                    <div class="user-display" style="color:#666;">Olá, Coach!</div>
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
            if(AdminPanel.state.currentSection === 'alunos') AdminPanel.renderAthleteList();
        });
        // REMOVIDO LIMITES para mostrar todos os treinos importados
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
        } else {
            area.innerHTML = `<div style="padding:40px; text-align:center; color:#999;">Módulo <b>${section}</b> em desenvolvimento.</div>`;
        }
    },

    renderFeedbackTable: () => {
        // MOSTRA TUDO, SEM LIMITE
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').once('value', snap => {
            const div = document.getElementById('feedback-list');
            if(!div) return;
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino realizado.</p>"; return; }
            
            let html = `<div class="feedback-table-container"><table class="feedback-table"><thead><tr><th>Status</th><th>Aluno</th><th>Treino</th><th>Feedback</th><th></th></tr></thead><tbody>`;
            const list = []; snap.forEach(c => list.push({ k: c.key, ...c.val() })); 
            list.reverse();

            list.forEach(w => {
                const atleta = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName };
                const foto = atleta.photoUrl || 'https://placehold.co/40x40/4169E1/FFFFFF?text=AT';
                const stravaBadge = w.stravaData ? `<span style="color:#fc4c02; font-weight:bold; font-size:0.8rem;"><i class='bx bxl-strava'></i> Sync</span>` : '';
                const dateStr = w.realizadoAt ? new Date(w.realizadoAt).toLocaleDateString('pt-BR') : w.date;

                html += `<tr>
                    <td><span class="status-dot"></span></td>
                    <td><div class="user-cell"><img src="${foto}" class="user-avatar-small"><strong>${atleta.name}</strong></div></td>
                    <td><div style="font-weight:bold;">${w.title}</div><small style="color:#777;">${dateStr} ${stravaBadge}</small></td>
                    <td><div style="font-style:italic; color:#555; font-size:0.9rem;">"${w.feedback || '...'}"</div></td>
                    <td><button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${w.ownerId}', '${w.title}')">Detalhes</button></td>
                </tr>`;
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
            const item = document.createElement('div');
            item.className = 'athlete-list-item';
            item.innerHTML = `<div style="display:flex; align-items:center; gap:10px;"><img src="${data.photoUrl || 'https://placehold.co/40x40/ccc/fff'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;"><div><span style="font-weight:bold;">${data.name}</span> ${isMe ? '<small style="color:var(--secondary-color)">(Eu)</small>' : ''}</div></div><i class='bx bx-chevron-right'></i>`;
            item.onclick = () => AdminPanel.openWorkspace(uid, data.name);
            div.appendChild(item);
        });
    },

    openWorkspace: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        const area = AdminPanel.elements.contentArea;
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <h3 style="color:var(--primary-color)">${name}</h3> 
                <button class="btn btn-small btn-secondary" onclick="AdminPanel.showSection('alunos')">Voltar</button>
            </div>
            <div class="admin-tabs"><button class="tab-btn active">Planilha Completa</button></div>
            <div id="student-workouts">Carregando histórico...</div>
            <hr><h4>Adicionar Treino Manualmente</h4>
            <form id="add-w-form" class="form-minimal">
                <div class="form-grid-2col"><input type="date" id="wd" required> <input type="text" id="wt" placeholder="Título do Treino" required></div>
                <textarea id="wo" placeholder="Detalhes (Ex: 10km leve...)" rows="3"></textarea>
                <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px;">Salvar Treino</button>
            </form>
        `;
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            const d = document.getElementById('student-workouts');
            if(!d) return; 
            if(!s.exists()) { d.innerHTML = "<p>Sem treinos registrados.</p>"; return; }
            d.innerHTML = "";
            const l = []; s.forEach(c => l.push({k:c.key, ...c.val()})); 
            l.sort((a,b) => new Date(b.date) - new Date(a.date)); 

            l.forEach(w => {
                const color = w.status === 'realizado' ? 'var(--success-color)' : '#999';
                let stravaInfo = w.stravaData ? `<div class="strava-data-display" style="font-size:0.85rem; margin-top:5px; padding:5px; border:1px solid #fc4c02; background:#fff5f0;"><i class='bx bxl-strava' style="color:#fc4c02"></i> <b>${w.stravaData.distancia}</b> | ${w.stravaData.tempo} | ${w.stravaData.ritmo}</div>` : '';
                d.innerHTML += `<div class="workout-card">
                    <div class="workout-card-header"><span class="date">${new Date(w.date).toLocaleDateString('pt-BR')}</span> <span class="title">${w.title}</span> <span class="status-tag" style="background:${color}">${w.status}</span></div>
                    <div class="workout-card-body"><p style="white-space:pre-wrap;">${w.description}</p>${stravaInfo}
                    ${w.feedback ? `<div class="feedback-text"><strong>Feedback:</strong> ${w.feedback}</div>` : ''}</div>
                    <div class="workout-card-footer"><button class="btn btn-small" onclick="AppPrincipal.openFeedbackModal('${w.k}', '${uid}', '${w.title}')">Detalhes</button><button class="btn btn-small btn-danger" onclick="AdminPanel.del('${uid}','${w.k}')"><i class='bx bx-trash'></i></button></div>
                </div>`;
            });
        });

        document.getElementById('add-w-form').onsubmit = (e) => {
            e.preventDefault();
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push({
                date: document.getElementById('wd').value, title: document.getElementById('wt').value, description: document.getElementById('wo').value,
                status: 'planejado', createdBy: AdminPanel.state.currentUser.uid, createdAt: new Date().toISOString()
            });
            e.target.reset(); alert("Treino salvo!");
        };
    },

    renderPendingList: () => {
        const div = document.getElementById('pending-list');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            if(!s.exists()) { div.innerHTML = "<p>Nada pendente.</p>"; return; }
            div.innerHTML = "";
            s.forEach(c => {
                div.innerHTML += `<div class="pending-item"><span><b>${c.val().name}</b></span> <button class="btn btn-small btn-success" onclick="AdminPanel.approve('${c.key}', '${c.val().name}', '${c.val().email}')">Aceitar</button></div>`;
            });
        });
    },
    approve: (uid, name, email) => {
        const u = {}; u[`/users/${uid}`] = { name, email, role: 'atleta', createdAt: new Date().toISOString() }; u[`/data/${uid}`] = { workouts: {} }; u[`/pendingApprovals/${uid}`] = null;
        AdminPanel.state.db.ref().update(u).then(() => AdminPanel.showSection('aprovacoes'));
    },
    del: (uid, wid) => { if(confirm('Apagar?')) AdminPanel.state.db.ref(`data/${uid}/workouts/${wid}`).remove(); }
};

const AtletaPanel = {
    init: (u, db) => {
        const list = document.getElementById('atleta-workouts-list');
        if(document.getElementById('log-manual-activity-btn')) document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        list.innerHTML = "Carregando...";
        db.ref(`data/${u.uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem treinos na planilha.</p>"; return; }
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                const st = w.stravaData ? `<br><small style="color:#fc4c02">Strava Sync</small>` : '';
                const card = document.createElement('div'); card.className = 'workout-card';
                card.innerHTML = `<div class="workout-card-header"><b>${w.title}</b> <span>${w.date}</span></div><div class="workout-card-body">${w.description} ${st}</div><div class="workout-card-footer"><button class="btn btn-small btn-primary">Feedback</button></div>`;
                card.onclick = (e) => { if(!e.target.closest('button')) AppPrincipal.openFeedbackModal(w.k, u.uid, w.title); };
                list.appendChild(card);
            });
        });
    }
};

const FeedPanel = {
    init: (u, db) => {
        const list = document.getElementById('feed-list');
        // REMOVIDO LIMITTOLAST para mostrar tudo
        db.ref('publicWorkouts').on('value', s => {
            list.innerHTML = "";
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); l.reverse();
            l.forEach(w => {
                const card = document.createElement('div'); card.className = 'workout-card';
                card.innerHTML = `<div class="workout-card-header"><b>${w.ownerName}</b> completou <b>${w.title}</b></div><div class="workout-card-body">${w.feedback || 'Sem feedback.'}</div>`;
                list.appendChild(card);
            });
        });
    }
};
