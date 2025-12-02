/* =================================================================== */
/* PANELS.JS V5.2 - MODO SEGURO
/* =================================================================== */

const AdminPanel = {
    state: {}, elements: {},

    init: (user, db) => {
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };
        AdminPanel.elements = {
            list: document.getElementById('athlete-list'),
            search: document.getElementById('athlete-search'),
            details: document.getElementById('athlete-detail-content'),
            name: document.getElementById('athlete-detail-name'),
            form: document.getElementById('add-workout-form'),
            workouts: document.getElementById('workouts-list')
        };

        if(AdminPanel.elements.form) AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.search.addEventListener('input', AdminPanel.renderList);

        // Abas
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.onclick = (e) => {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`admin-tab-${e.target.dataset.tab}`).classList.add('active');
            };
        });

        db.ref('users').orderByChild('name').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            AdminPanel.renderList();
        });
    },

    renderList: () => {
        const list = AdminPanel.elements.list;
        list.innerHTML = "";
        const term = AdminPanel.elements.search.value.toLowerCase();
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (term && !data.name.toLowerCase().includes(term)) return;
            const d = document.createElement('div');
            d.className = 'athlete-list-item';
            d.textContent = data.name;
            if(uid === AdminPanel.state.selectedAthleteId) d.classList.add('selected');
            d.onclick = () => AdminPanel.select(uid, data.name);
            list.appendChild(d);
        });
    },

    select: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        AdminPanel.elements.name.textContent = name;
        AdminPanel.elements.details.classList.remove('hidden');
        AdminPanel.loadWorkouts(uid);
    },

    loadWorkouts: (uid) => {
        const list = AdminPanel.elements.workouts;
        list.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            arr.sort((a,b) => new Date(b.v.date) - new Date(a.v.date)); // Decrescente
            arr.forEach(i => list.appendChild(AdminPanel.card(i.k, i.v, uid)));
        });
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta");

        const date = document.getElementById('workout-date').value;
        const title = document.getElementById('workout-title').value;
        
        // Estrutura SisRUN
        const warm = document.getElementById('workout-warmup').value;
        const main = document.getElementById('workout-main').value;
        const cool = document.getElementById('workout-cooldown').value;
        const inten = document.getElementById('workout-intensidade').value;
        const vol = document.getElementById('workout-volume').value;

        let desc = "";
        if(warm) desc += `🔥 AQUEC: ${warm}\n`;
        desc += `🏃 PRINCIPAL: ${main}\n`;
        if(cool) desc += `❄️ DESAQUEC: ${cool}\n`;
        desc += `📊 ${inten} | ${vol}`;

        const data = {
            date, title, description: desc, status: 'planejado',
            createdAt: new Date().toISOString(),
            createdBy: AdminPanel.state.currentUser.uid
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data)
            .then(() => { alert("Treino Criado!"); e.target.reset(); })
            .catch(err => alert(err.message));
    },

    card: (id, data, uid) => {
        const d = document.createElement('div');
        d.className = 'workout-card';
        d.innerHTML = `
            <div class="workout-card-header">
                <span>${data.date}</span> <strong>${data.title}</strong>
                <span class="status-tag ${data.status}">${data.status}</span>
            </div>
            <div class="workout-card-body" style="white-space: pre-wrap;">${data.description}</div>
            <div class="workout-card-footer">
                <button class="btn btn-secondary btn-small" onclick="AppPrincipal.openFeedbackModal('${id}', '${uid}', '${data.title}')">Detalhes</button>
            </div>
        `;
        return d;
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
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            arr.sort((a,b) => new Date(a.v.date) - new Date(b.v.date)); // Crescente (Mais próximo primeiro)
            arr.forEach(i => {
                const d = document.createElement('div');
                d.className = 'workout-card';
                d.onclick = () => AppPrincipal.openFeedbackModal(i.k, user.uid, i.v.title);
                d.innerHTML = `
                    <div class="workout-card-header">
                        <span>${i.v.date}</span> <strong>${i.v.title}</strong>
                        <span class="status-tag ${i.v.status}">${i.v.status}</span>
                    </div>
                    <div class="workout-card-body" style="white-space: pre-wrap;">${i.v.description}</div>
                `;
                list.appendChild(d);
            });
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Feed vazio.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            arr.reverse(); 
            
            arr.forEach(i => {
                const d = i.v;
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.onclick = () => AppPrincipal.openFeedbackModal(i.k, d.ownerId, d.title);
                div.innerHTML = `
                    <div class="workout-card-header">
                        <strong>${d.ownerName}</strong> - ${d.date} <span class="status-tag ${d.status}">${d.status}</span>
                    </div>
                    <div class="workout-card-body">
                        <h4>${d.title}</h4>
                        <p>${d.feedback || d.description}</p>
                    </div>
                    <div class="workout-card-footer"><button class="btn btn-nav">Comentar</button></div>
                `;
                list.appendChild(div);
            });
        });
    }
};
