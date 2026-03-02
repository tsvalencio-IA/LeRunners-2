/* =================================================================== */
/* PAINEL DA NUTRICIONISTA CLÍNICA E ESPORTIVA - V2.0 PRONTUÁRIO EHR
/* ARQUIVO COMPLETO, DEFINITIVO E SEM ABREVIAÇÕES (Diretiva *177)
/* =================================================================== */

const AppNutri = {
    auth: null,
    db: null,
    user: null,
    userData: null,
    isNutri: false,
    stravaAuth: null,
    patients: {},
    selectedPatientId: null,
    
    // Estado consolidado do paciente selecionado (ou do próprio paciente)
    currentPatientData: { 
        clinical: { goal: "", anamnesis: "" },
        measurements: [],
        diet: "", 
        logs: [], 
        workouts: [] 
    },
    
    // --- 1. INICIALIZAÇÃO ---
    init: () => {
        if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        AppNutri.auth = firebase.auth();
        AppNutri.db = firebase.database();

        AppNutri.setupAuthListeners();
        AppNutri.setupModals();

        AppNutri.auth.onAuthStateChanged(user => {
            const loader = document.getElementById('loader');
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            const pendingView = document.getElementById('pending-view');
            
            if(loader) loader.classList.add('hidden');

            if (user) {
                AppNutri.user = user;
                AppNutri.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppNutri.userData = snapshot.val(); 
                        document.getElementById('user-name-display').textContent = AppNutri.userData.name;
                        
                        authContainer.classList.add('hidden');
                        pendingView.classList.add('hidden');
                        appContainer.classList.remove('hidden');
                        
                        // Definição de Role (Admin Nutri vs Paciente)
                        const email = AppNutri.userData.email.toLowerCase();
                        AppNutri.isNutri = (email.includes('daiana') || email.includes('nutri') || AppNutri.userData.role === 'nutri');
                        
                        document.getElementById('user-role-display').textContent = AppNutri.isNutri ? "Nutricionista Clínica" : "Paciente / Atleta";

                        if (AppNutri.isNutri) {
                            AppNutri.initNutriView();
                        } else {
                            AppNutri.initPatientView();
                        }
                    } else {
                        AppNutri.db.ref('pendingApprovals/' + user.uid).once('value', pendSnap => {
                            if(pendSnap.exists()) {
                                authContainer.classList.add('hidden');
                                appContainer.classList.add('hidden');
                                pendingView.classList.remove('hidden');
                            } else {
                                AppNutri.auth.signOut();
                            }
                        });
                    }
                });
            } else {
                authContainer.classList.remove('hidden');
                appContainer.classList.add('hidden');
                pendingView.classList.add('hidden');
            }
        });

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppNutri.handleStravaCallback(urlParams.get('code'));
    },

    // --- 2. LISTENERS BASE ---
    setupAuthListeners: () => {
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        
        if(toReg) toReg.onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        if(toLog) toLog.onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        document.getElementById('login-form').onsubmit = (e) => {
            e.preventDefault();
            AppNutri.auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value).catch(err => alert("Erro Login: " + err.message));
        };

        document.getElementById('register-form').onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;
            const name = document.getElementById('registerName').value;
            AppNutri.auth.createUserWithEmailAndPassword(email, pass).then((cred) => {
                AppNutri.db.ref('pendingApprovals/' + cred.user.uid).set({ name: name, email: email, requestDate: new Date().toISOString() });
            }).catch(err => alert("Erro Registro: " + err.message));
        };

        document.getElementById('btn-logout').onclick = () => AppNutri.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppNutri.auth.signOut();
    },

    setupModals: () => {
        // Modal Comida (Paciente)
        document.getElementById('btn-log-food').onclick = () => {
            document.getElementById('food-form').reset();
            document.getElementById('food-ia-feedback').textContent = "";
            document.getElementById('food-modal').classList.remove('hidden');
        };
        document.getElementById('close-food-modal').onclick = () => document.getElementById('food-modal').classList.add('hidden');
        document.getElementById('food-form').onsubmit = AppNutri.handleSaveFoodLog;

        // Modal Relatório IA (Nutri)
        document.getElementById('close-nutri-report-modal').onclick = () => document.getElementById('nutri-report-modal').classList.add('hidden');
        document.getElementById('btn-nutri-ia').onclick = AppNutri.generateNutriIAReport;
    },

    // --- 3. VISÃO PACIENTE ---
    initPatientView: () => {
        document.getElementById('patient-view').classList.remove('hidden');
        document.getElementById('nutri-view').classList.add('hidden');

        AppNutri.checkStravaConnection();
        AppNutri.loadClinicalData(AppNutri.user.uid, true);
        AppNutri.loadPatientDiet(AppNutri.user.uid, true);
        AppNutri.loadPatientFoodLogs(AppNutri.user.uid, true);
    },

    // --- 4. STRAVA ENGINE ---
    checkStravaConnection: () => {
        AppNutri.db.ref(`users/${AppNutri.user.uid}/stravaAuth`).on('value', snapshot => {
            AppNutri.stravaAuth = snapshot.val(); 
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');
            
            if (snapshot.exists()) {
                if(btnConnect) btnConnect.classList.add('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
                if(status) status.textContent = "✅ Sincronizado ao Strava.";
                if(btnSync) btnSync.onclick = AppNutri.handleStravaSync; 
            } else {
                if(btnConnect) btnConnect.classList.remove('hidden');
                if(btnSync) btnSync.classList.add('hidden');
                if(status) status.textContent = "Strava não conectado.";
                if(btnConnect) btnConnect.onclick = () => {
                    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all`;
                };
            }
        });
    },

    handleStravaCallback: async (code) => {
        try {
            const checkUser = setInterval(async () => {
                const user = firebase.auth().currentUser;
                if (user) {
                    clearInterval(checkUser);
                    const token = await user.getIdToken();
                    await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({code}) });
                    window.history.replaceState({}, document.title, "nutri-ia.html");
                    alert("Strava conectado!");
                }
            }, 500);
        } catch(e) { alert("Erro Strava: " + e.message); }
    },

    refreshStravaToken: async () => {
        const token = await AppNutri.user.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelRefreshAPI, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
        const json = await res.json();
        if(!res.ok) throw new Error(json.error);
        return json.accessToken;
    },

    handleStravaSync: async () => {
        const btn = document.getElementById('btn-sync-strava');
        const statusEl = document.getElementById('status-strava');
        if (!AppNutri.stravaAuth || !AppNutri.stravaAuth.accessToken) return;
        
        btn.disabled = true;
        const originalText = statusEl.textContent;
        statusEl.textContent = "🔄 Puxando treinos do relógio...";

        try {
            let accessToken = AppNutri.stravaAuth.accessToken;
            if (Math.floor(Date.now() / 1000) >= (AppNutri.stravaAuth.expiresAt - 300)) accessToken = await AppNutri.refreshStravaToken();

            const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=30`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (!response.ok) throw new Error("Falha na API Strava.");
            const activities = await response.json();
            
            const snap = await AppNutri.db.ref(`data/${AppNutri.user.uid}/workouts`).once('value');
            const existing = snap.val() || {};
            const updates = {};
            let countNew = 0, countMerged = 0;

            for (const act of activities) {
                let exists = false;
                for (let k in existing) if (String(existing[k].stravaActivityId) === String(act.id)) { exists = true; break; }
                if (exists) continue;

                const distKm = (act.distance / 1000).toFixed(2) + " km";
                const tempoStr = new Date(act.moving_time * 1000).toISOString().substr(11, 8);
                const stravaPayload = {
                    distancia: distKm, tempo: tempoStr,
                    calorias: act.kilojoules ? (act.kilojoules * 0.239006).toFixed(0) + " kcal" : "N/D",
                    mapLink: `https://www.strava.com/activities/${act.id}`
                };

                const actDate = act.start_date.split('T')[0];
                let matchKey = null;
                for (let k in existing) if (existing[k].date === actDate && existing[k].status === 'planejado') { matchKey = k; break; }

                if (matchKey) {
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/status`] = "realizado";
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/stravaActivityId`] = String(act.id);
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/stravaData`] = stravaPayload;
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/realizadoAt`] = new Date().toISOString();
                    countMerged++;
                } else {
                    const newKey = AppNutri.db.ref().push().key;
                    updates[`data/${AppNutri.user.uid}/workouts/${newKey}`] = {
                        title: act.name, date: actDate, status: "realizado", createdBy: AppNutri.user.uid, 
                        stravaActivityId: String(act.id), stravaData: stravaPayload, createdAt: new Date().toISOString(), realizadoAt: new Date().toISOString()
                    };
                    countNew++;
                }
            }

            if (Object.keys(updates).length > 0) {
                await AppNutri.db.ref().update(updates);
                alert(`Strava: ${countNew} novos treinos, ${countMerged} sincronizados.`);
            } else alert("Tudo atualizado.");

        } catch(e) { alert("Erro Sync: " + e.message); } 
        finally { btn.disabled = false; statusEl.textContent = originalText; }
    },

    // --- 5. LOG DE REFEIÇÕES (IA VISION) ---
    handleSaveFoodLog: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-food');
        const feedbackEl = document.getElementById('food-ia-feedback');
        
        const type = document.getElementById('food-type').value;
        const desc = document.getElementById('food-description').value;
        const file = document.getElementById('food-photo').files[0];
        
        if(!file) return alert("Foto obrigatória.");

        btn.disabled = true;
        btn.textContent = "Processando IA Clínica...";
        feedbackEl.textContent = "Lendo ingredientes e calculando macros...";

        try {
            const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); f.append('folder', `lerunners/nutri/${AppNutri.user.uid}`);
            const rCloud = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
            const dCloud = await rCloud.json(); 
            const imageUrl = dCloud.secure_url;

            const base64 = await new Promise((r,j)=>{ const d=new FileReader(); d.onload=()=>r(d.result.split(',')[1]); d.onerror=j; d.readAsDataURL(file) });

            const promptText = `
                Atue como uma Nutricionista Esportiva. Avalie este "${type}".
                Retorne ESTRITAMENTE um objeto JSON válido (sem markdown), com:
                {
                    "descricao": "Texto descrevendo o prato",
                    "kcal": 450,
                    "carbo_g": 50,
                    "prot_g": 30,
                    "gord_g": 15,
                    "nota_saude": 8
                }
            `;

            const rGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ contents:[{ parts:[ {text: promptText}, {inlineData:{mimeType:file.type, data:base64}} ]}], generationConfig: { responseMimeType: "application/json" } })
            });
            
            if(!rGemini.ok) throw new Error("Falha IA Vision.");
            const dGemini = await rGemini.json();
            const textResponse = dGemini.candidates[0].content.parts[0].text;
            const aiData = JSON.parse(textResponse.replace(/```json/g, '').replace(/```/g, '').trim());

            await AppNutri.db.ref(`nutriData/${AppNutri.user.uid}/logs`).push({
                type: type, description: desc, imageUrl: imageUrl, aiAnalysis: aiData,
                timestamp: new Date().toISOString(), date: new Date().toISOString().split('T')[0]
            });

            document.getElementById('food-modal').classList.add('hidden');
            alert("Refeição auditada pela IA com sucesso!");

        } catch (err) {
            feedbackEl.textContent = "Erro na IA: " + err.message;
        } finally {
            btn.disabled = false; btn.textContent = "Analisar e Salvar";
        }
    },

    // --- 6. GESTÃO DE DADOS (CLÍNICOS, MEDIDAS E DIETA) ---
    loadClinicalData: (uid, isPatientView) => {
        // 1. Carrega Objetivo e Anamnese
        AppNutri.db.ref(`nutriData/${uid}/clinical`).on('value', snapshot => {
            const data = snapshot.val() || { goal: "", anamnesis: "" };
            AppNutri.currentPatientData.clinical = data;
            
            if (isPatientView) {
                const goalEl = document.getElementById('patient-goal-display');
                if (goalEl) goalEl.textContent = data.goal || "Definição pendente.";
            } else {
                document.getElementById('clin-goal').value = data.goal;
                document.getElementById('clin-anamnesis').value = data.anamnesis;
            }
        });

        // 2. Carrega Medidas Antropométricas
        AppNutri.db.ref(`nutriData/${uid}/measurements`).on('value', snapshot => {
            const arr = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => arr.push({ id: child.key, ...child.val() }));
            }
            // Ordena mais recentes no topo
            arr.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            AppNutri.currentPatientData.measurements = arr;
            
            AppNutri.renderMeasurementsList(arr, isPatientView, uid);
        });
    },

    renderMeasurementsList: (measurements, isPatientView, uid) => {
        if (isPatientView) {
            const container = document.getElementById('patient-measurements-display');
            if (measurements.length === 0) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#888;">Nenhuma medida registrada.</div>`;
                return;
            }
            const last = measurements[0];
            const pData = last.date.split('-').reverse().join('/');
            container.innerHTML = `
                <div style="grid-column:1/-1; font-size:0.8rem; color:#888; text-align:right; margin-bottom:5px;">Ref: ${pData}</div>
                <div class="measure-box"><span>Peso</span><strong>${last.weight || '--'} kg</strong></div>
                <div class="measure-box"><span>% Gordura</span><strong>${last.bf || '--'} %</strong></div>
                <div class="measure-box"><span>Cintura</span><strong>${last.waist || '--'} cm</strong></div>
                <div class="measure-box"><span>Abdômen</span><strong>${last.abdomen || '--'} cm</strong></div>
            `;
        } else {
            const tbody = document.getElementById('clinical-measurements-list');
            tbody.innerHTML = "";
            if (measurements.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">Sem histórico de medidas.</td></tr>`;
                return;
            }
            measurements.forEach(m => {
                const tr = document.createElement('tr');
                const dStr = m.date.split('-').reverse().join('/');
                tr.innerHTML = `
                    <td>${dStr}</td>
                    <td>${m.weight ? m.weight+'kg' : '-'}</td>
                    <td>${m.bf ? m.bf+'%' : '-'}</td>
                    <td>${m.waist ? m.waist+'cm' : '-'}</td>
                    <td>${m.abdomen ? m.abdomen+'cm' : '-'}</td>
                    <td><button class="btn-delete-med" data-id="${m.id}" style="background:none; border:none; color:#d32f2f; cursor:pointer;"><i class='bx bx-trash'></i></button></td>
                `;
                tr.querySelector('.btn-delete-med').onclick = () => {
                    if(confirm("Apagar avaliação?")) AppNutri.db.ref(`nutriData/${uid}/measurements/${m.id}`).remove();
                };
                tbody.appendChild(tr);
            });
        }
    },

    loadPatientDiet: (uid, isPatientView) => {
        AppNutri.db.ref(`nutriData/${uid}/diet`).on('value', snapshot => {
            const dietText = snapshot.val() || "";
            AppNutri.currentPatientData.diet = dietText;
            if (isPatientView) {
                const container = document.getElementById('patient-diet-content');
                if (dietText !== "") container.innerHTML = `<div style="white-space:pre-wrap; line-height:1.6; color:#333;">${dietText}</div>`;
                else container.innerHTML = '<p style="color:#666; font-style:italic; margin:0;">Sem prescrição ativa.</p>';
            } else {
                document.getElementById('clin-diet-text').value = dietText;
            }
        });
    },

    loadPatientFoodLogs: (uid, isPatientView) => {
        const listEl = document.getElementById(isPatientView ? 'patient-food-list' : 'nutri-logs-content');
        
        AppNutri.db.ref(`nutriData/${uid}/logs`).on('value', snapshot => {
            AppNutri.currentPatientData.logs = [];
            listEl.innerHTML = "";
            if (!snapshot.exists()) {
                listEl.innerHTML = "<p style='color:#666; text-align:center;'>Nenhuma refeição na base.</p>";
                return;
            }

            const arr = [];
            snapshot.forEach(child => arr.push({ id: child.key, ...child.val() }));
            arr.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            AppNutri.currentPatientData.logs = arr;

            arr.forEach(log => {
                const el = document.createElement('div');
                el.className = 'food-card';
                const timeStr = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const dateStr = new Date(log.timestamp).toLocaleDateString('pt-BR');

                let aiHtml = "";
                if(log.aiAnalysis) {
                    const ai = log.aiAnalysis;
                    aiHtml = `
                        <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #ccc;">
                            <strong style="color:#1b5e20; font-size:0.85rem;"><i class='bx bx-brain'></i> Leitura da IA:</strong>
                            <p style="font-size:0.85rem; color:#555; margin:3px 0;">${ai.descricao}</p>
                            <div>
                                <span class="macro-badge macro-kcal">${ai.kcal} Kcal</span>
                                <span class="macro-badge macro-carb">C: ${ai.carbo_g}g</span>
                                <span class="macro-badge macro-prot">P: ${ai.prot_g}g</span>
                                <span class="macro-badge macro-fat">G: ${ai.gord_g}g</span>
                            </div>
                            <div style="margin-top:5px; font-size:0.8rem; font-weight:bold; color: ${ai.nota_saude >= 7 ? '#2e7d32' : '#d32f2f'}">
                                Saúde do Prato: ${ai.nota_saude}/10
                            </div>
                        </div>`;
                }

                el.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#2e7d32; font-size:1.1rem;">${log.type}</strong>
                        <span style="font-size:0.8rem; color:#888;">${dateStr} ${timeStr}</span>
                    </div>
                    ${log.description ? `<p style="font-size:0.9rem; color:#444; margin-top:5px;">${log.description}</p>` : ''}
                    ${log.imageUrl ? `<img src="${log.imageUrl}" class="food-image">` : ''}
                    ${aiHtml}
                    <div style="text-align:right; margin-top:10px;">
                        <button class="btn-delete-log" data-id="${log.id}" style="background:none; border:none; color:#d32f2f; cursor:pointer;"><i class='bx bx-trash'></i></button>
                    </div>
                `;
                el.querySelector('.btn-delete-log').onclick = () => {
                    if(confirm("Apagar prato?")) AppNutri.db.ref(`nutriData/${uid}/logs/${log.id}`).remove();
                };
                listEl.appendChild(el);
            });
        });
    },

    loadPatientWorkoutsStrava: (uid) => {
        const listEl = document.getElementById('nutri-strava-content');
        AppNutri.db.ref(`data/${uid}/workouts`).on('value', snapshot => {
            AppNutri.currentPatientData.workouts = [];
            listEl.innerHTML = "";
            if (!snapshot.exists()) return listEl.innerHTML = "<p style='color:#666; text-align:center;'>Nenhum treino cruzado.</p>";

            const arr = [];
            snapshot.forEach(child => arr.push({ id: child.key, ...child.val() }));
            const filtrados = arr.filter(w => w.status === 'realizado');
            filtrados.sort((a,b) => new Date(b.realizadoAt || b.date).getTime() - new Date(a.realizadoAt || a.date).getTime());
            
            AppNutri.currentPatientData.workouts = filtrados;

            if (filtrados.length === 0) return listEl.innerHTML = "<p style='color:#666; text-align:center;'>Sem treinos realizados.</p>";

            filtrados.forEach(w => {
                const el = document.createElement('div');
                el.className = 'food-card';
                el.style.borderLeftColor = '#fc4c02';
                let info = `<strong>${w.title}</strong> - ${w.date}<br><p style="font-size:0.9rem; color:#555; margin:3px 0;">${w.description || ''}</p>`;
                if (w.stravaData) {
                    info += `<div style="background:#fff5f0; padding:8px; border-radius:5px; font-family:monospace; font-size:0.85rem; color:#fc4c02; margin-top:5px;">`;
                    info += `D: ${w.stravaData.distancia} | T: ${w.stravaData.tempo}`;
                    if(w.stravaData.calorias) info += ` | Est. Gasto: ${w.stravaData.calorias}`;
                    info += `</div>`;
                }
                el.innerHTML = info;
                listEl.appendChild(el);
            });
        });
    },

    // --- 7. VISÃO NUTRICIONISTA (DASHBOARD) ---
    initNutriView: () => {
        document.getElementById('nutri-view').classList.remove('hidden');
        document.getElementById('patient-view').classList.add('hidden');
        
        AppNutri.loadAllPatients();

        // Troca de Pacientes
        document.getElementById('nutri-patient-select').onchange = (e) => {
            const uid = e.target.value;
            if (uid) AppNutri.selectPatient(uid);
            else {
                document.getElementById('nutri-patient-dashboard').classList.add('hidden');
                AppNutri.selectedPatientId = null;
            }
        };

        // Lógica das Abas Clínicas
        const tabs = [
            { btn: 'tab-clin-resumo', content: 'content-clin-resumo' },
            { btn: 'tab-clin-dieta', content: 'content-clin-dieta' },
            { btn: 'tab-clin-diario', content: 'content-clin-diario' },
            { btn: 'tab-clin-strava', content: 'content-clin-strava' }
        ];

        tabs.forEach(t => {
            document.getElementById(t.btn).onclick = () => {
                tabs.forEach(x => {
                    document.getElementById(x.btn).classList.remove('active');
                    document.getElementById(x.content).classList.add('hidden');
                });
                document.getElementById(t.btn).classList.add('active');
                document.getElementById(t.content).classList.remove('hidden');
            };
        });

        // Eventos de Salvamento Clínico
        document.getElementById('btn-save-clinical').onclick = async () => {
            if(!AppNutri.selectedPatientId) return;
            const btn = document.getElementById('btn-save-clinical'); btn.disabled = true; btn.innerHTML = "Salvando...";
            const goal = document.getElementById('clin-goal').value;
            const anamnesis = document.getElementById('clin-anamnesis').value;
            try {
                await AppNutri.db.ref(`nutriData/${AppNutri.selectedPatientId}/clinical`).set({ goal, anamnesis });
                alert("Resumo clínico atualizado.");
            } catch(e){ alert(e.message); } finally { btn.disabled = false; btn.innerHTML = "<i class='bx bx-save'></i> Salvar Dados Clínicos"; }
        };

        // Eventos de Nova Avaliação (Medidas)
        document.getElementById('btn-add-measurement').onclick = () => {
            document.getElementById('form-measurement').classList.remove('hidden');
            document.getElementById('med-date').value = new Date().toISOString().split('T')[0];
        };
        document.getElementById('btn-cancel-measurement').onclick = () => document.getElementById('form-measurement').classList.add('hidden');
        
        document.getElementById('btn-save-measurement').onclick = async () => {
            if(!AppNutri.selectedPatientId) return;
            const date = document.getElementById('med-date').value;
            if(!date) return alert("Data obrigatória.");
            const payload = {
                date: date,
                weight: document.getElementById('med-weight').value,
                bf: document.getElementById('med-bf').value,
                waist: document.getElementById('med-waist').value,
                abdomen: document.getElementById('med-abdomen').value,
                timestamp: new Date().toISOString()
            };
            await AppNutri.db.ref(`nutriData/${AppNutri.selectedPatientId}/measurements`).push(payload);
            document.getElementById('form-measurement').classList.add('hidden');
            // Limpa form
            ['med-weight','med-bf','med-waist','med-abdomen'].forEach(id => document.getElementById(id).value = '');
        };

        // Evento de Dieta
        document.getElementById('btn-save-diet').onclick = async () => {
            if(!AppNutri.selectedPatientId) return;
            const btn = document.getElementById('btn-save-diet'); btn.disabled = true; btn.innerHTML = "Salvando...";
            const content = document.getElementById('clin-diet-text').value;
            try {
                await AppNutri.db.ref(`nutriData/${AppNutri.selectedPatientId}/diet`).set(content);
                alert("Dieta enviada ao App do Paciente!");
            } catch(e){ alert(e.message); } finally { btn.disabled = false; btn.innerHTML = "<i class='bx bx-check-double'></i> Atualizar Dieta no App do Paciente"; }
        };
    },

    loadAllPatients: () => {
        const select = document.getElementById('nutri-patient-select');
        AppNutri.db.ref('users').on('value', snapshot => {
            AppNutri.patients = snapshot.val() || {};
            select.innerHTML = "<option value=''>-- Acessar Prontuário de... --</option>";
            Object.entries(AppNutri.patients).forEach(([uid, data]) => {
                if (uid !== AppNutri.user.uid) {
                    const opt = document.createElement('option');
                    opt.value = uid; opt.textContent = data.name + (data.role ? ` (${data.role})` : '');
                    select.appendChild(opt);
                }
            });
        });
    },

    selectPatient: (uid) => {
        AppNutri.selectedPatientId = uid;
        document.getElementById('nutri-patient-dashboard').classList.remove('hidden');
        document.getElementById('clinical-patient-name').textContent = AppNutri.patients[uid].name;
        
        // Abastece o Prontuário
        AppNutri.loadClinicalData(uid, false);
        AppNutri.loadPatientDiet(uid, false);
        AppNutri.loadPatientFoodLogs(uid, false);
        AppNutri.loadPatientWorkoutsStrava(uid);
    },

    // --- 8. INTELIGÊNCIA ARTIFICIAL CLÍNICA AVANÇADA ---
    generateNutriIAReport: async () => {
        if(!AppNutri.selectedPatientId) return;

        const btn = document.getElementById('btn-nutri-ia');
        const loading = document.getElementById('nutri-ia-loading');
        btn.disabled = true; loading.classList.remove('hidden');

        try {
            const pacName = AppNutri.patients[AppNutri.selectedPatientId].name;
            const clin = AppNutri.currentPatientData.clinical;
            const measures = AppNutri.currentPatientData.measurements.slice(0, 2); // Pega as duas ultimas para ver evolução
            const diet = AppNutri.currentPatientData.diet || "Sem dieta estruturada.";
            
            const recentLogs = AppNutri.currentPatientData.logs.slice(0, 7).map(l => ({
                tipo: l.type, desc: l.description, kcal_ia: l.aiAnalysis?.kcal, nota_ia: l.aiAnalysis?.nota_saude
            }));

            const recentWorkouts = AppNutri.currentPatientData.workouts.slice(0, 5).map(w => ({
                treino: w.title, dist: w.stravaData?.distancia, gasto_kcal: w.stravaData?.calorias
            }));

            const promptText = `
                ATUE COMO: Daiana, Nutricionista Clínica e Esportiva Sênior.
                PACIENTE: ${pacName}.

                === DADOS CLÍNICOS E OBJETIVO ===
                Objetivo Declarado: ${clin.goal || "Não informado"}
                Anamnese: ${clin.anamnesis || "Nenhuma observação clínica"}
                
                === ÚLTIMAS MEDIDAS ===
                ${JSON.stringify(measures, null, 2)}
                
                === PRESCRIÇÃO ATUAL ===
                ${diet.substring(0, 300)}... (resumo)

                === COMPORTAMENTO RECENTE (DIÁRIO ALIMENTAR) ===
                ${JSON.stringify(recentLogs, null, 2)}

                === GASTO CALÓRICO (STRAVA - ÚLTIMOS TREINOS) ===
                ${JSON.stringify(recentWorkouts, null, 2)}

                MISSÃO DO RELATÓRIO (CRUZE OS DADOS):
                1. CONTEXTO: Avalie se as atitudes recentes (comida + treinos) estão convergindo para o "Objetivo Declarado" e se a "Evolução de Medidas" corrobora isso.
                2. ADESÃO: O paciente está furando muito a dieta? As Kcal ingeridas (estimadas) superam o gasto dos treinos?
                3. RISCOS: Há algo na anamnese que liga um alerta com a alimentação recente?
                4. CONDUTA: Forneça 3 diretrizes diretas para a Nutricionista repassar ao paciente na próxima consulta.

                Seja altamente técnica, focada em fisiologia e nutrição esportiva. Formate com tópicos limpos (markdown).
            `;

            const rGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });
            
            if(!rGemini.ok) throw new Error("Falha na API Gemini.");
            const dGemini = await rGemini.json();
            
            document.getElementById('nutri-report-content').textContent = dGemini.candidates[0].content.parts[0].text;
            document.getElementById('nutri-report-modal').classList.remove('hidden');

        } catch (err) {
            console.error(err); alert("Erro ao gerar diagnóstico da IA: " + err.message);
        } finally {
            btn.disabled = false; loading.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', AppNutri.init);
