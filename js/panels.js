/* =================================================================== */
/* ARQUIVO DE PAINÉIS (V12.0 - ESTABILIDADE TOTAL SISRUN)
/* =================================================================== */

const AdminPanel = {
    state: { db: null, currentUser: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V12: Init");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;
        
        document.getElementById('app-main-content').innerHTML = `
            <div class="admin-dashboard">
                <div class="dashboard-grid">
                    <div class="dash-card" onclick="AdminPanel.show('feedbacks')">
                        <i class='bx bx-message-square-check'></i><span>Feedbacks</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.show('alunos')">
                        <i class='bx bx-group'></i><span>Alunos</span>
                    </div>
                    <div class="dash-card" onclick="AdminPanel.show('aprovacoes')">
                        <i class='bx bx-user-plus'></i><span>Aprovações</span>
                    </div>
                    <div class="dash-card" onclick="alert('Em breve')">
                        <i class='bx bx-dollar-circle'></i><span>Financeiro</span>
                    </div>
                </div>
                <div id="admin-content" class="panel"></div>
            </div>
        `;
        
        AdminPanel.elements.area = document.getElementById('admin-content');
        AdminPanel.loadData();
        AdminPanel.show('feedbacks');
    },

    loadData: () => {
        const db = AdminPanel.state.db;
        db.ref('users').on('value', s => AdminPanel.state.athletes = s.val() || {});
    },

    show: (sec) => {
        const area = AdminPanel.elements.area;
        area.innerHTML = "<p>Carregando...</p>";
        
        if(sec === 'feedbacks') {
            area.innerHTML = `<h3><i class='bx bx-list-check'></i> Central de Feedbacks</h3><div id="feed-list"></div>`;
            AdminPanel.renderFeedTable();
        } else if(sec === 'alunos') {
            area.innerHTML = `<h3><i class='bx bx-user'></i> Meus Alunos</h3><div id="alist"></div>`;
            AdminPanel.renderAthleteList();
        } else if(sec === 'aprovacoes') {
            area.innerHTML = `<h3>Aprovações</h3><div id="plist"></div>`;
            AdminPanel.renderPending();
        }
    },

    renderFeedTable: () => {
        // MOSTRA TUDO (SEM LIMITES)
        AdminPanel.state.db.ref('publicWorkouts').orderByChild('realizadoAt').once('value', snap => {
            const div = document.getElementById('feed-list');
            if(!div) return;
            if(!snap.exists()) { div.innerHTML = "Sem treinos."; return; }

            let h = `<div class="feedback-table-container"><table class="feedback-table"><thead><tr><th>Status</th><th>Aluno</th><th>Treino</th><th>Feedback</th><th></th></tr></thead><tbody>`;
            const l = []; snap.forEach(c => l.push({k:c.key, ...c.val()})); l.reverse();

            l.forEach(w => {
                const a = AdminPanel.state.athletes[w.ownerId] || { name: w.ownerName || 'Aluno' };
                const st = w.stravaData ? `<i class='bx bxl-strava' style="color:#fc4c02"></i>` : '';
                h += `<tr>
                    <td><span class="status-dot dot-green"></span></td>
                    <td><b>${a.name}</b></td>
                    <td>${w.title} ${st}<br><small>${w.date}</small></td>
                    <td><i>${w.feedback || '--'}</i></td>
                    <td><button class="btn btn-small btn-secondary" onclick="AppPrincipal.openFeedbackModal('${w.k}','${w.ownerId}','${w.title}')">Ver</button></td>
                </tr>`;
            });
            div.innerHTML = h + `</tbody></table></div>`;
        });
    },

    renderAthleteList: () => {
        const div = document.getElementById('alist');
        Object.entries(AdminPanel.state.athletes).forEach(([uid, u]) => {
            const isMe = uid === AdminPanel.state.currentUser.uid;
            const hl = isMe ? "background:#eef; border-color:#4169E1;" : "";
            div.innerHTML += `
                <div class="athlete-list-item" style="padding:10px; border:1px solid #ddd; margin-bottom:5px; cursor:pointer; ${hl}" 
                     onclick="AdminPanel.openStudent('${uid}','${u.name}')">
                    <b>${u.name}</b> ${isMe ? '(Eu)' : ''} <i class='bx bx-chevron-right' style="float:right"></i>
                </div>`;
        });
    },

    openStudent: (uid, name) => {
        const area = AdminPanel.elements.area;
        area.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;"><h3>${name}</h3> <button class="btn btn-small" onclick="AdminPanel.show('alunos')">Voltar</button></div>
            <div id="student-workouts">Carregando histórico...</div>
            <hr>
            <h4>Adicionar Treino</h4>
            <form id="add-w-form" class="form-minimal">
                <div class="form-grid-2col"><input type="date" id="wd" required><input type="text" id="wt" placeholder="Título" required></div>
                <textarea id="wo" placeholder="Detalhes" rows="3"></textarea>
                <button type="submit" class="btn btn-primary" style="width:100%; margin-top:10px">Salvar</button>
            </form>
        `;
        
        // CARREGA TUDO DO ALUNO (Correção do bug de sumiço)
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            const d = document.getElementById('student-workouts');
            if(!d) return;
            if(!s.exists()) { d.innerHTML = "Sem treinos."; return; }
            d.innerHTML = "";
            const l = []; s.forEach(c=>l.push({k:c.key, ...c.val()})); l.sort((a,b)=>new Date(b.date)-new Date(a.date));
            l.forEach(w => {
                d.innerHTML += `<div class="workout-card" style="padding:10px; margin-bottom:10px; border:1px solid #eee;">
                    <div style="display:flex; justify-content:space-between;"><b>${w.title}</b> <span>${new Date(w.date).toLocaleDateString()}</span></div>
                    <p>${w.description}</p>
                    ${w.stravaData ? `<div style="color:#fc4c02; font-size:0.9rem"><i class='bx bxl-strava'></i> ${w.stravaData.distancia} | ${w.stravaData.tempo}</div>` : ''}
                    <div style="text-align:right; margin-top:5px;">
                        <button class="btn btn-small" onclick="AppPrincipal.openFeedbackModal('${w.k}','${uid}','${w.title}')">Feedback</button>
                        <button class="btn btn-small btn-danger" onclick="AdminPanel.del('${uid}','${w.k}')">X</button>
                    </div>
                </div>`;
            });
        });

        document.getElementById('add-w-form').onsubmit = (e) => {
            e.preventDefault();
            AdminPanel.state.db.ref(`data/${uid}/workouts`).push({
                date: document.getElementById('wd').value, title: document.getElementById('wt').value, 
                description: document.getElementById('wo').value, status: 'planejado', createdBy: AdminPanel.state.currentUser.uid
            });
            e.target.reset();
        };
    },
    
    renderPending: () => {
        const d = document.getElementById('plist');
        AdminPanel.state.db.ref('pendingApprovals').once('value', s => {
            if(!s.exists()) { d.innerHTML = "Nada."; return; }
            s.forEach(c => {
                d.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                    <span>${c.val().name}</span> 
                    <button class="btn btn-small btn-success" onclick="AdminPanel.approve('${c.key}','${c.val().name}','${c.val().email}')">OK</button>
                </div>`;
            });
        });
    },
    approve: (uid, name, email) => {
        const u = {}; u[`/users/${uid}`] = {name, email, role:'atleta'}; u[`/data/${uid}`]={workouts:{}}; u[`/pendingApprovals/${uid}`]=null;
        AdminPanel.state.db.ref().update(u).then(()=>AdminPanel.show('aprovacoes'));
    },
    del: (uid, wid) => { if(confirm('Apagar?')) AdminPanel.state.db.ref(`data/${uid}/workouts/${wid}`).remove(); }
};

// --- PAINEL DO ALUNO (CORRIGIDO PARA MOSTRAR TUDO) ---
const AtletaPanel = {
    init: (u, db) => {
        const l = document.getElementById('atleta-workouts-list');
        if(document.getElementById('log-manual-activity-btn')) document.getElementById('log-manual-activity-btn').onclick = AppPrincipal.openLogActivityModal;
        
        l.innerHTML = "Carregando...";
        db.ref(`data/${u.uid}/workouts`).orderByChild('date').on('value', s => {
            l.innerHTML = "";
            if(!s.exists()) { l.innerHTML = "<p>Nenhum treino.</p>"; return; }
            const arr = []; s.forEach(c => arr.push({k:c.key, ...c.val()})); 
            arr.sort((a,b) => new Date(b.date) - new Date(a.date)); // Decrescente
            
            arr.forEach(w => {
                const st = w.stravaData ? `<br><small style="color:#fc4c02">Strava Sync</small>` : '';
                const card = document.createElement('div'); card.className = 'workout-card';
                card.innerHTML = `
                    <div class="workout-card-header"><b>${w.title}</b> <span>${new Date(w.date).toLocaleDateString()}</span></div>
                    <div class="workout-card-body">${w.description} ${st}</div>
                    <div class="workout-card-footer"><button class="btn btn-small btn-primary">Feedback</button></div>
                `;
                card.onclick = (e) => { if(!e.target.closest('button')) AppPrincipal.openFeedbackModal(w.k, u.uid, w.title); };
                l.appendChild(card);
            });
        });
    }
};

const FeedPanel = {
    init: (u, db) => {
        const l = document.getElementById('feed-list');
        db.ref('publicWorkouts').limitToLast(50).on('value', s => {
            l.innerHTML = ""; const a = []; s.forEach(c=>a.push(c.val())); a.reverse();
            a.forEach(w => {
                l.innerHTML += `<div class="workout-card" style="padding:15px; margin-bottom:10px;">
                    <b>${w.ownerName}</b> - ${w.title}<br>
                    <i>"${w.feedback || 'Treino realizado'}"</i>
                </div>`;
            });
        });
    }
};