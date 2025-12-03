/* =================================================================== */
/* PANELS.JS V3.0 - BLINDADO (ZERO CRASH POR DADOS FALTANTES)
/* =================================================================== */

const panels = {};

// 1. ADMIN PANEL (COACH)
const AdminPanel = {
    state: { selectedAthleteId: null, athletes: {} },
    elements: {},

    init: (user, db) => {
        console.log("AdminPanel V3.0: Init Blindado");
        AdminPanel.state.db = db;
        AdminPanel.state.currentUser = user;

        // Mapeia Elementos com verificação
        AdminPanel.elements = {
            list: document.getElementById('athlete-list'),
            search: document.getElementById('athlete-search'),
            details: document.getElementById('athlete-detail-content'),
            name: document.getElementById('athlete-detail-name'),
            workouts: document.getElementById('workouts-list'),
            form: document.getElementById('add-workout-form'),
            pendingList: document.getElementById('pending-list')
        };

        if(AdminPanel.elements.search) {
            AdminPanel.elements.search.oninput = (e) => AdminPanel.renderList(e.target.value);
        }
        
        if(AdminPanel.elements.form) {
            const newForm = AdminPanel.elements.form.cloneNode(true);
            AdminPanel.elements.form.parentNode.replaceChild(newForm, AdminPanel.elements.form);
            AdminPanel.elements.form = newForm;
            AdminPanel.elements.form.addEventListener('submit', AdminPanel.handleAddWorkout);
        }

        // Binds de Abas
        const tabs = document.querySelectorAll('.tab-btn');
        if(tabs) {
            tabs.forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const target = document.getElementById(`admin-tab-${btn.dataset.tab}`);
                    if(target) target.classList.add('active');
                };
            });
        }
        
        const btnDelete = document.getElementById('delete-athlete-btn');
        if(btnDelete) btnDelete.onclick = AdminPanel.deleteAthlete;
        
        const btnAnalyze = document.getElementById('analyze-athlete-btn-ia');
        if(btnAnalyze) btnAnalyze.onclick = AdminPanel.runIA;

        AdminPanel.loadAthletes();
        AdminPanel.loadPending();
    },

    loadAthletes: () => {
        if(!AdminPanel.state.db) return;
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
            if (!data || data.role === 'admin') return;
            const name = data.name || "Sem Nome";
            if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;

            const row = document.createElement('div');
            row.className = 'athlete-list-item';
            if(uid === AdminPanel.state.selectedAthleteId) row.classList.add('selected');
            
            row.innerHTML = `<span>${name}</span>`;
            row.onclick = () => AdminPanel.selectAthlete(uid, name);
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

    // --- CARREGAMENTO DE TREINOS BLINDADO ---
    loadWorkouts: (uid) => {
        const div = AdminPanel.elements.workouts;
        if(!div) return;
        div.innerHTML = "<p>Carregando...</p>";
        
        AdminPanel.state.db.ref(`data/${uid}/workouts`).orderByChild('date').limitToLast(100).on('value', snap => {
            div.innerHTML = "";
            if(!snap.exists()) { div.innerHTML = "<p>Nenhum treino agendado.</p>"; return; }

            const list = [];
            snap.forEach(c => list.push({key:c.key, ...c.val()}));
            
            // Ordenação segura (trata datas inválidas)
            list.sort((a,b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateB - dateA;
            });

            list.forEach(w => {
                // BLINDAGEM DE DADOS: Se faltar algo, usa padrão
                const dateStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--/--";
                const title = w.title || "Sem Título";
                const desc = w.description || "";
                const status = w.status || "planejado";

                const card = document.createElement('div');
                card.className = 'workout-card';
                
                let border = "5px solid #ccc";
                if(status === 'realizado') border = "5px solid #28a745";
                else if(status === 'nao_realizado') border = "5px solid #dc3545";
                else if(status === 'realizado_parcial') border = "5px solid #ffc107";
                card.style.borderLeft = border;

                // Montagem HTML
                let html = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <strong style="font-size:1.1em; color:var(--primary-color);">${dateStr}</strong>
                        <span class="status-tag ${status}">${status}</span>
                    </div>
                    <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${title}</div>
                    <div style="white-space:pre-wrap; font-size:0.95rem; color:#444; background:#f9f9f9; padding:8px; border-radius:4px; border:1px solid #eee;">${desc}</div>
                `;

                // Dados Strava (com verificação segura)
                if(w.stravaData) {
                    html += `
                        <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                            <div style="display:flex; gap:10px; align-items:center; color:#fc4c02; font-weight:bold; font-size:0.9rem;">
                                <i class='bx bxl-strava'></i> Strava Sync
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:5px; margin-top:5px; background:#fff5eb; padding:8px; border-radius:4px; text-align:center; font-size:0.9rem;">
                                <div><small>Dist</small><br><strong>${w.stravaData.distancia || "-"}</strong></div>
                                <div><small>Tempo</small><br><strong>${w.stravaData.tempo || "-"}</strong></div>
                                <div><small>Pace</small><br><strong>${w.stravaData.ritmo || "-"}</strong></div>
                            </div>
                        </div>
                    `;
                    
                    if(w.stravaData.splits && Array.isArray(w.stravaData.splits) && w.stravaData.splits.length > 0) {
                        let rows = "";
                        w.stravaData.splits.forEach(sp => {
                            rows += `<tr>
                                <td style="padding:4px;">${sp.km || "-"}</td>
                                <td style="padding:4px;">${sp.pace || "-"}</td>
                                <td style="padding:4px;">${sp.elev || "0"}m</td>
                            </tr>`;
                        });
                        
                        html += `
                            <details style="margin-top:8px; font-size:0.85rem; color:#666; cursor:pointer;">
                                <summary>Ver Parciais (Km a Km)</summary>
                                <table style="width:100%; margin-top:5px; border-collapse:collapse; text-align:center;">
                                    <thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </details>
                        `;
                    }
                }

                html += `
                    <div style="text-align:right; margin-top:10px; padding-top:8px; border-top:1px dashed #ddd;">
                        <button class="btn-del btn btn-danger btn-small" style="padding:4px 10px; font-size:0.8rem;">Excluir</button>
                    </div>
                `;

                card.innerHTML = html;

                // Eventos
                card.addEventListener('click', (e) => {
                    if (!e.target.closest('button') && !e.target.closest('details')) {
                        AppPrincipal.openFeedbackModal(w.key, uid, title);
                    }
                });

                const delBtn = card.querySelector('.btn-del');
                if(delBtn) {
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if(confirm("Tem certeza que deseja apagar este treino?")) {
                            const u={};
                            u[`/data/${uid}/workouts/${w.key}`]=null;
                            u[`/publicWorkouts/${w.key}`]=null;
                            AdminPanel.state.db.ref().update(u);
                        }
                    });
                }

                div.appendChild(card);
            });
        });
    },

    loadHistory: (uid) => {
        const div = AdminPanel.elements.iaHistoryList;
        if(!div) return;
        AdminPanel.state.db.ref(`iaAnalysisHistory/${uid}`).limitToLast(5).on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "<p>Sem histórico.</p>"; return; }
            const list = [];
            s.forEach(c => list.push(c.val()));
            list.reverse();
            list.forEach(h => {
                const txt = h.text || "";
                div.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; background:#f9f9f9; margin-bottom:5px; border-radius:4px;">
                    <b>${new Date(h.date).toLocaleDateString()}</b><br>
                    <small>${txt.substring(0, 100)}...</small>
                </div>`;
            });
        });
    },

    loadPending: () => {
        const div = AdminPanel.elements.pendingList;
        if(!div) return;
        AdminPanel.state.db.ref('pendingApprovals').on('value', s => {
            div.innerHTML = "";
            if(!s.exists()) { div.innerHTML = "Nenhuma pendência."; return; }
            s.forEach(c => {
                const val = c.val() || {};
                const row = document.createElement('div');
                row.className = 'pending-item';
                row.innerHTML = `<span>${val.name || "Sem nome"} (${val.email || "-"})</span> <button class="btn btn-success btn-small">Aprovar</button>`;
                
                row.querySelector('button').onclick = () => {
                    const u={};
                    u[`/users/${c.key}`] = { 
                        name: val.name, 
                        email: val.email, 
                        role: 'atleta', 
                        createdAt: new Date().toISOString() 
                    };
                    u[`/data/${c.key}`] = { workouts: {} };
                    u[`/pendingApprovals/${c.key}`] = null;
                    AdminPanel.state.db.ref().update(u);
                };
                div.appendChild(row);
            });
        });
    },

    handleAddWorkout: (e) => {
        e.preventDefault();
        const uid = AdminPanel.state.selectedAthleteId;
        if(!uid) return alert("Selecione um atleta.");

        const f = e.target;
        const date = f.querySelector('#workout-date').value;
        const title = f.querySelector('#workout-title').value;
        
        if(!date || !title) return alert("Data e Título são obrigatórios.");

        // Safe values
        const getVal = (id) => f.querySelector(id) ? f.querySelector(id).value : "";

        let desc = `[${getVal('#workout-modalidade')}] - ${getVal('#workout-tipo-treino')}\n`;
        desc += `Intensidade: ${getVal('#workout-intensidade')} | Percurso: ${getVal('#workout-percurso')}\n`;
        
        const dist = getVal('#workout-distancia');
        if(dist) desc += `Distância: ${dist}km | `;
        
        const tempo = getVal('#workout-tempo');
        if(tempo) desc += `Tempo: ${tempo} | `;
        
        const pace = getVal('#workout-pace');
        if(pace) desc += `Pace: ${pace}`;
        
        const obs = getVal('#workout-observacoes');
        if(obs) desc += `\n\nObs: ${obs}`;

        const data = {
            date: date,
            title: title,
            description: desc,
            status: 'planejado',
            createdBy: AdminPanel.state.currentUser.uid,
            createdAt: new Date().toISOString()
        };

        AdminPanel.state.db.ref(`data/${uid}/workouts`).push(data).then(() => {
            alert("Treino salvo!");
            f.querySelector('#workout-title').value = "";
            f.querySelector('#workout-observacoes').value = "";
        });
    },
    
    runIA: async () => {
        const uid = AdminPanel.state.selectedAthleteId;
        const nameElement = AdminPanel.elements.name;
        const name = nameElement ? nameElement.textContent : "Atleta";
        const output = document.getElementById('ia-analysis-output');
        const modal = document.getElementById('ia-analysis-modal');
        const saveBtn = document.getElementById('save-ia-analysis-btn');
        
        if(modal) modal.classList.remove('hidden');
        if(output) output.textContent = "Analisando...";
        if(saveBtn) saveBtn.classList.add('hidden');

        try {
            const snap = await AdminPanel.state.db.ref(`data/${uid}/workouts`).limitToLast(15).once('value');
            const workouts = snap.val();
            
            if(!workouts) throw new Error("Sem dados.");

            const prompt = `Analise os treinos de ${name}: ${JSON.stringify(workouts)}. Resuma consistência, paces e dicas.`;
            const result = await AppPrincipal.callGeminiTextAPI(prompt);
            
            if(output) output.textContent = result;
            
            AppPrincipal.state.currentAnalysisData = {
                date: new Date().toISOString(),
                text: result,
                coachId: AdminPanel.state.currentUser.uid
            };
            if(saveBtn) saveBtn.classList.remove('hidden');

        } catch (err) {
            if(output) output.textContent = "Erro IA: " + err.message;
        }
    }
};

// 2. ATLETA PANEL
const AtletaPanel = {
    init: (user, db) => {
        console.log("AtletaPanel V3.0: Init");
        const list = document.getElementById('atleta-workouts-list');
        const welcome = document.getElementById('atleta-welcome-name');
        if(welcome) welcome.textContent = AppPrincipal.state.userData ? AppPrincipal.state.userData.name : "Atleta";

        const btnLog = document.getElementById('log-manual-activity-btn');
        if(btnLog) btnLog.onclick = () => {
            const m = document.getElementById('log-activity-modal');
            if(m) m.classList.remove('hidden');
        };

        if(!list) return;

        db.ref(`data/${user.uid}/workouts`).orderByChild('date').limitToLast(50).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Sem treinos.</p>"; return; }

            const items = [];
            snap.forEach(c => items.push({key:c.key, ...c.val()}));
            items.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));

            items.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                
                let border = "5px solid #ccc";
                const st = w.status || "planejado";
                if(st === 'realizado') border = "5px solid #28a745";
                card.style.borderLeft = border;
                
                let extra = "";
                if(w.stravaData) {
                    extra = `<div style="color:#e65100; font-size:0.8rem; margin-top:5px;"><b>Strava:</b> ${w.stravaData.distancia || "?"} | ${w.stravaData.ritmo || "?"}</div>`;
                }

                const dStr = w.date ? new Date(w.date).toLocaleDateString('pt-BR') : "--";
                const descSafe = w.description ? w.description.substring(0, 100) : "";

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <b>${dStr}</b>
                        <span class="status-tag ${st}">${st}</span>
                    </div>
                    <div style="font-weight:bold; margin:5px 0;">${w.title || "Treino"}</div>
                    <div style="font-size:0.9rem; color:#666;">${descSafe}...</div>
                    ${extra}
                    <div style="text-align:right; margin-top:10px;">
                        <button class="btn btn-primary btn-small">Ver</button>
                    </div>
                `;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, user.uid, w.title || "Treino");
                list.appendChild(card);
            });
        });
    }
};

// 3. FEED PANEL
const FeedPanel = {
    init: (user, db) => {
        const list = document.getElementById('feed-list');
        if(!list) return;
        
        db.ref('publicWorkouts').limitToLast(30).on('value', snap => {
            list.innerHTML = "";
            if(!snap.exists()) { list.innerHTML = "<p>Vazio.</p>"; return; }

            const items = [];
            snap.forEach(c => items.push({key:c.key, ...c.val()}));
            items.reverse();

            items.forEach(w => {
                const card = document.createElement('div');
                card.className = 'workout-card';
                
                let icon = w.stravaData ? "<i class='bx bxl-strava' style='color:#fc4c02'></i>" : "";
                const owner = w.ownerName || "Atleta";
                const date = w.date ? new Date(w.date).toLocaleDateString() : "--";

                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="width:35px; height:35px; background:#ddd; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${owner.charAt(0)}</div>
                        <div>
                            <div style="font-weight:bold; font-size:0.9rem;">${owner}</div>
                            <div style="font-size:0.75rem; color:#777;">${date} ${icon}</div>
                        </div>
                    </div>
                    <div style="font-weight:bold;">${w.title || "Treino"}</div>
                    <div style="font-size:0.9rem; color:#444; margin-top:5px;">${w.feedback || w.description || ""}</div>
                `;
                
                card.onclick = () => AppPrincipal.openFeedbackModal(w.key, w.ownerId, w.title);
                list.appendChild(card);
            });
        });
    }
};

window.panels = { init: () => {}, cleanup: () => { if(AdminPanel.state.db) AdminPanel.state.db.ref().off(); } };
