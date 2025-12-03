/* =================================================================== */
/* PANELS.JS V2.2 - LAYOUT ORIGINAL RESTAURADO (COM SPLITS)
/* =================================================================== */

const panels = {};

// 1. ADMIN
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V2.2: Init");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        AdminPanel.elements = {
            list: document.getElementById('athlete-list'),
            search: document.getElementById('athlete-search'),
            details: document.getElementById('athlete-detail-content'),
            name: document.getElementById('athlete-detail-name'),
            workouts: document.getElementById('workouts-list'),
            form: document.getElementById('add-workout-form'),
            pendingList: document.getElementById('pending-list')
        };

        if(AdminPanel.elements.search) AdminPanel.elements.search.oninput = (e) => AdminPanel.renderList(e.target.value);
        
        if(AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`admin-tab-${btn.dataset.tab}`).classList.add('active');
            };
        });
        
        if(document.getElementById('delete-athlete-btn')) document.getElementById('delete-athlete-btn').onclick = AdminPanel.deleteAthlete;
        if(document.getElementById('analyze-athlete-btn-ia')) document.getElementById('analyze-athlete-btn-ia').onclick = AdminPanel.runIA;

        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    loadAthletes: () => {
        AdminPanel.state.db.ref('users').orderByChild('name').on('value', snap => {
            AdminPanel.state.athletes = snap.val() || {};
            AdminPanel.renderList();
        });
    },

    renderList: (filter = "") => {
        const div = AdminPanel.elements.list;
        if(!div) return;
        div.innerHTML = "";
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (data.role === 'admin') return;
            if (filter && !data.name.toLowerCase().includes(filter.toLowerCase())) return;

            const row = document.createElement('div');
            row.className = 'athlete-list-item';
            if(uid === AdminPanel.state.selectedAthleteId) row.classList.add('selected');
            
            row.innerHTML = `<span>${data.name}</span>`;
            row.onclick = () => AdminPanel.selectAthlete(uid, data.name);
            div.appendChild(row);
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        if(AdminPanel.elements.name) AdminPanel.elements.name.textContent = name;
        if(AdminPanel.elements.details) AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.renderList(); 
        AdminPanel.loadWorkouts(uid);
        AdminPanel.loadHistory(uid);
    },

    // --- AQUI ESTÁ A CORREÇÃO DO LOOP ---
    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workouts;
        if(!div) return;
        div.innerHTML = "<p>Carregando...</p>";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(100).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino.</p>"; return; }

            const list = [];
            snap.forEach(c => list.push({key:c.key, ...c.val()}));
            list.sort((a,b) => new Date(b.date) - new Date(a.date));

            list.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                
                // Status V2
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong>${new Date(w.date).toLocaleDateString('pt-BR')}</strong>
                        <span class="status-tag ${w.status || 'planejado'}">${w.status || 'planejado'}</span>
                    </div>
                    <div style="font-weight:bold; color:#00008B;">${w.title}</div>
                    <div style="font-size:0.9rem; color:#555; margin-top:5px; white-space:pre-wrap;">${w.description}</div>
                `;

                // Dados Strava V2 (Se existirem)
                if(w.stravaData) {
                    let splitsHtml = "";
                    if(w.stravaData.splits) {
                        splitsHtml = `<details style="margin-top:5px; cursor:pointer;"><summary style="font-size:0.8rem; color:#e65100;">Ver Splits</summary><table style="width:100%; font-size:0.8rem; margin-top:5px;"><tr><th>Km</th><th>Pace</th></tr>`;
                        w.stravaData.splits.forEach(s => splitsHtml += `<tr><td>${s.km}</td><td>${s.pace}</td></tr>`);
                        splitsHtml += `</table></details>`;
                    }
                    
                    const stravaDiv = document.createElement('div');
                    stravaDiv.style.marginTop = "10px";
                    stravaDiv.style.fontSize = "0.85rem";
                    stravaDiv.style.color = "#e65100";
                    stravaDiv.style.background = "#fff3e0";
                    stravaDiv.style.padding = "5px";
                    stravaDiv.style.borderRadius = "4px";
                    stravaDiv.innerHTML = `<i class='bx bxl-strava'></i> <b>${w.stravaData.distancia}</b> | ${w.stravaData.ritmo} ${splitsHtml}`;
                    card.appendChild(stravaDiv);
                }

                // Botão Excluir
                const actions = document.createElement('div');
                actions.style.textAlign = "right";
                actions.style.marginTop = "5px";
                actions.innerHTML = `<button class="btn btn-danger btn-small" style="font-size:0.7rem; padding:2px 5px;">X</button>`;
                actions.querySelector('button').onclick = (e) => {
                    e.stopPropagation();
                    if(confirm("Apagar?")) {
                        const u={}; u[`/data/${uid}/workouts/${w.key}`]=null; u[`/publicWorkouts/${w.key}`]=null;
                        AdminPanel.state.db.ref().update(u);
                    }
                };
                card.appendChild(actions);

                card.onclick = (e) => {
                    if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'SUMMARY') AppPrincipal.openFeedbackModal(w.key, uid, w.title);
                };

                div.appendChild(card);
            });
        });
    },

    // Form V17 (Prescrição Detalhada)
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta.");

        const f = e.target;
        const date = f.querySelector('#workout-date').value;
        const title = f.querySelector('#workout-title').value;
        if(!date || !title) return alert("Obrigatório: Data e Título.");

        let desc = `[${f.querySelector('#workout-modalidade').value}] - ${f.querySelector('#workout-tipo-treino').value}\n`;
        desc += `Intensidade: ${f.querySelector('#workout-intensidade').value}\n`;
        
        const dist = f.querySelector('#workout-distancia').value;
        if(dist) desc += `Distância: ${dist}km | `;
        const tempo = f.querySelector('#workout-tempo').value;
        if(tempo) desc += `Tempo: ${tempo} | `;
        const pace = f.querySelector('#workout-pace').value;
        if(pace) desc += `Pace: ${pace}`;
        
        const obs = f.querySelector('#workout-observacoes').value;
        if(obs) desc += `\n\n${obs}`;

        const data = {
            date: date, title: title, description: desc, status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid, createdAt: new Date().toISOString()
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Salvo!");
            f.querySelector('#workout-title').value = "";
            f.querySelector('#workout-observacoes').value = "";
        });
    },

    loadHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        if(!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            const l = []; s.forEach(c => l.push(c.val())); l.reverse();
            l.forEach(h => div.innerHTML += `<div style="padding:5px; border-bottom:1px solid #eee;"><b>${new Date(h.date).toLocaleDateString()}</b><br><small>${h.text.substring(0,80)}...</small></div>`);
        });
    },

    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        if(!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "Nada."; return; }
            s.forEach(c => {
                const d = document.createElement('div');
                d.className = 'pending-item';
                d.innerHTML = `<span>${c.val().name}</span> <button class="btn btn-success btn-small">OK</button>`;
                d.querySelector('button').onclick = () => AdminPanel.approve(c.key, c.val());
                div.appendChild(d);
            });
        });
    },

    approve: (uid, data) => {
        const u={}; u[`/users/${uid}`]={name:data.name, email:data.email, role:'atleta'}; u[`/data/${uid}`]={workouts:{}}; u[`/pendingApprovals/${uid}`]=null;
        AdminPanel.state.db.ref().update(u);
    },

    deleteAthlete: () => {
        const uid = AdminPanel.state.selectedAthleteId;
        if(uid && confirm("Apagar?")) {
            const u={}; u[`/users/${uid}`]=null; u[`/data/${uid}`]=null;
            AdminPanel.state.db.ref().update(u);
            AdminPanel.elements.details.classList.add('hidden');
        }
    },

    runIA: async () => {
        const uid = AdminPanel.state.selectedAthleteId;
        const out = document.getElementById('ia-analysis-output');
        const modal = document.getElementById('ia-analysis-modal');
        const btn = document.getElementById('save-ia-analysis-btn');
        modal.classList.remove('hidden'); out.textContent = "Analisando..."; btn.classList.add('hidden');
        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            const res = await AppPrincipal.callGeminiTextAPI(`Analise este atleta: ${JSON.stringify(snap.val())}`);
            out.textContent = res;
            AppPrincipal.state.currentAnalysisData = { date: new Date().toISOString(), text: res, coachId: AdminPanel.state.currentUser.uid };
            btn.classList.remove('hidden');
        } catch(e) { out.textContent = e.message; }
    }
};

// 2. ATLETA
const AtletaPanel = {
    init: (user, db) => {
        const list = document.getElementById('atleta-workouts-list');
        const welcome = document.getElementById('atleta-welcome-name');
        if(welcome) welcome.textContent = AppPrincipal.state.userData.name;
        document.getElementById('log-manual-activity-btn').onclick = () => document.getElementById('log-activity-modal').classList.remove('hidden');

        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            if(!list) return;
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "Sem treinos."; return; }
            const arr = []; snap.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.sort((a,b) => new Date(b.date) - new Date(a.date));

            arr.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;"><b>${new Date(w.date).toLocaleDateString('pt-BR')}</b><span class="status-tag ${w.status}">${w.status}</span></div>
                    <div style="font-weight:bold; margin:5px 0;">${w.title}</div>
                    <div style="font-size:0.9rem; color:#666;">${w.description}</div>
                `;
                if(w.stravaData) card.innerHTML += `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia} | ${w.stravaData.ritmo}</div>`;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, user.uid, w.title);
                list.appendChild(card);
            });
        });
    }
};

// 3. FEED
const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        if(!list) return;
        db.ref('publicWorkouts').limitToLast(30).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "Vazio."; return; }
            const arr = []; snap.forEach(c => arr.push({key:c.key, ...c.val()}));
            arr.reverse();
            arr.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                card.innerHTML = `
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:5px;">
                        <div style="width:30px; height:30px; background:#ccc; border-radius:50%; display:flex; align-items:center; justify-content:center;">${w.ownerName?w.ownerName[0]:"?"}</div>
                        <div><b>${w.ownerName}</b> <small style="color:#777;">${new Date(w.date).toLocaleDateString()}</small></div>
                    </div>
                    <div><b>${w.title}</b></div>
                    <div style="font-size:0.9rem;">${w.feedback || w.description}</div>
                `;
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title);
                list.appendChild(card);
            });
        });
    }
};

window.panels = { init: () => {}, cleanup: () => { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };
