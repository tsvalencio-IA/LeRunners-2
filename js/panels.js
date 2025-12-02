/* =================================================================== */
/* PAINÉIS - V4.5 (SISRUN PRESCRIPTION & FEED SORTING FIX)
/* =================================================================== */

const AdminPanel = {
    state: {}, elements: {},

    init: (user, db) => {
        AdminPanel.state = { db, currentUser: user, selectedAthleteId: null, athletes: {} };
        AdminPanel.elements = {
            athleteList: document.getElementById('athlete-list'),
            athleteSearch: document.getElementById('athlete-search'),
            athleteDetailContent: document.getElementById('athlete-detail-content'),
            athleteDetailName: document.getElementById('athlete-detail-name'),
            addWorkoutForm: document.getElementById('add-workout-form'),
            workoutsList: document.getElementById('workouts-list')
        };

        if(AdminPanel.elements.addWorkoutForm) AdminPanel.elements.addWorkoutForm.addEventListener('submit', AdminPanel.handleAddWorkout);
        AdminPanel.elements.athleteSearch.addEventListener('input', AdminPanel.renderAthleteList);

        // Carrega Atletas
        db.ref('users').orderByChild('name').on('value', s => {
            AdminPanel.state.athletes = s.val() || {};
            AdminPanel.renderAthleteList();
        });
    },

    renderAthleteList: () => {
        const list = AdminPanel.elements.athleteList;
        list.innerHTML = "";
        const term = AdminPanel.elements.athleteSearch.value.toLowerCase();
        
        Object.entries(AdminPanel.state.athletes).forEach(([uid, data]) => {
            if (uid === AdminPanel.state.currentUser.uid || (term && !data.name.toLowerCase().includes(term))) return;
            const div = document.createElement('div');
            div.className = 'athlete-list-item';
            if (uid === AdminPanel.state.selectedAthleteId) div.classList.add('selected');
            div.textContent = data.name;
            div.onclick = () => AdminPanel.selectAthlete(uid, data.name);
            list.appendChild(div);
        });
    },

    selectAthlete: (uid, name) => {
        AdminPanel.state.selectedAthleteId = uid;
        AdminPanel.elements.athleteDetailName.textContent = name;
        AdminPanel.elements.athleteDetailContent.classList.remove('hidden');
        AdminPanel.loadWorkouts(uid);
    },

    loadWorkouts: (uid) => {
        const list = AdminPanel.elements.workoutsList;
        list.innerHTML = "Carregando...";
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').on('value', s => {
            list.innerHTML = "";
            if (!s.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            // Ordena descrescente por data
            arr.sort((a, b) => new Date(b.v.date) - new Date(a.v.date));
            arr.forEach(i => list.appendChild(AdminPanel.createWorkoutCard(i.k, i.v, uid)));
        });
    },

    // PRESCRIÇÃO ESTRUTURADA (SISRUN)
    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if (!uid) return alert("Selecione um atleta");

        const date = document.getElementById('workout-date').value;
        const title = document.getElementById('workout-title').value;
        const warm = document.getElementById('workout-warmup').value;
        const main = document.getElementById('workout-main').value;
        const cool = document.getElementById('workout-cooldown').value;
        const intensity = document.getElementById('workout-intensidade').value;
        const volume = document.getElementById('workout-volume').value;

        // Monta Descrição Formatada
        let desc = "";
        if(warm) desc += `🔥 AQUECIMENTO:\n${warm}\n\n`;
        desc += `🏃 PRINCIPAL:\n${main}\n\n`;
        if(cool) desc += `❄️ DESAQUECIMENTO:\n${cool}\n\n`;
        desc += `📊 META: ${intensity} | ${volume}`;

        const data = {
            date, title, description: desc, status: 'planejado',
            createdAt: new Date().toISOString(),
            createdBy: AdminPanel.state.currentUser.uid,
            structure: { warm, main, cool, intensity, volume } // Salva estruturado tb para futuro
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data)
            .then(() => { alert("Treino Prescrito!"); e.target.reset(); })
            .catch(err => alert(err.message));
    },

    createWorkoutCard: (id, data, uid) => {
        const div = document.createElement('div');
        div.className = 'workout-card';
        div.innerHTML = `
            <div class="workout-card-header">
                <span class="date">${data.date}</span>
                <span class="title">${data.title}</span>
                <span class="status-tag ${data.status}">${data.status}</span>
            </div>
            <div class="workout-card-body" style="white-space: pre-wrap;">${data.description}</div>
            <div class="workout-card-footer">
                <button class="btn btn-secondary btn-small" onclick="AppPrincipal.openFeedbackModal('${id}', '${uid}', '${data.title}')">Detalhes/Avaliar</button>
            </div>
        `;
        return div;
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
            // Atleta vê datas futuras primeiro? Ou passadas? Geralmente, data mais próxima no topo.
            arr.sort((a, b) => new Date(b.v.date) - new Date(a.v.date));
            
            arr.forEach(i => {
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.innerHTML = `
                    <div class="workout-card-header">
                        <span class="date">${i.v.date}</span>
                        <span class="title">${i.v.title}</span>
                        <span class="status-tag ${i.v.status}">${i.v.status}</span>
                    </div>
                    <div class="workout-card-body">${i.v.description}</div>
                `;
                div.onclick = () => AppPrincipal.openFeedbackModal(i.k, user.uid, i.v.title);
                list.appendChild(div);
            });
        });
    }
};

const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        // CORREÇÃO ORDENAÇÃO FEED
        db.ref('publicWorkouts').orderByChild('realizadoAt').limitToLast(20).on('value', s => {
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Feed vazio.</p>"; return; }
            
            const arr = [];
            s.forEach(c => arr.push({ k: c.key, v: c.val() }));
            // Inverte para mostrar o mais recente (maior data) primeiro
            arr.reverse(); 
            
            arr.forEach(i => {
                const d = i.v;
                const div = document.createElement('div');
                div.className = 'workout-card';
                div.innerHTML = `
                    <div class="workout-card-header">
                        <strong>${d.ownerName}</strong> - ${d.date}
                        <span class="status-tag ${d.status}">${d.status}</span>
                    </div>
                    <div class="workout-card-body">
                        <h4>${d.title}</h4>
                        <p>${d.feedback || d.description}</p>
                    </div>
                    <div class="workout-card-footer">
                        <button class="btn btn-nav"><i class='bx bx-comment'></i> Comentar</button>
                    </div>
                `;
                div.onclick = () => AppPrincipal.openFeedbackModal(i.k, d.ownerId, d.title);
                list.appendChild(div);
            });
        });
    }
};
