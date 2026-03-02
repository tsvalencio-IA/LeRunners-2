/* =================================================================== */
/* PAINEL DA NUTRICIONISTA (DAIANE CAMPOS) E PACIENTES - V1.0 INTEGRADA
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
    currentPatientData: { diet: "", logs: [], workouts: [] },
    
    // --- 1. INICIALIZAÇÃO ---
    init: () => {
        // Inicializa Firebase de forma segura (verifica se já existe)
        if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        AppNutri.auth = firebase.auth();
        AppNutri.db = firebase.database();

        AppNutri.setupAuthListeners();
        AppNutri.setupModals();

        // Monitor de Estado de Autenticação
        AppNutri.auth.onAuthStateChanged(user => {
            const loader = document.getElementById('loader');
            const authContainer = document.getElementById('auth-container');
            const appContainer = document.getElementById('app-container');
            const pendingView = document.getElementById('pending-view');
            
            if(loader) loader.classList.add('hidden');

            if (user) {
                AppNutri.user = user;
                // Busca dados do usuário para verificar Role e Aprovação
                AppNutri.db.ref('users/' + user.uid).once('value', snapshot => {
                    if (snapshot.exists()) {
                        AppNutri.userData = snapshot.val(); 
                        document.getElementById('user-name-display').textContent = AppNutri.userData.name;
                        
                        authContainer.classList.add('hidden');
                        pendingView.classList.add('hidden');
                        appContainer.classList.remove('hidden');
                        
                        // VERIFICAÇÃO DE ROLE (É a Daiana/Nutri ou é Paciente?)
                        // Checagem flexível baseada no email ou numa role definida.
                        const email = AppNutri.userData.email.toLowerCase();
                        AppNutri.isNutri = (email.includes('daiane') || AppNutri.userData.role === 'nutri');
                        
                        if (AppNutri.isNutri) {
                            AppNutri.initNutriView();
                        } else {
                            AppNutri.initPatientView();
                        }
                    } else {
                        // Se não está na tabela users, verifica se está pendente
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

        // Callback do Strava (captura o "code" na URL após autorizar)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) AppNutri.handleStravaCallback(urlParams.get('code'));
    },

    // --- 2. LISTENERS DE AUTENTICAÇÃO E MODAIS ---
    setupAuthListeners: () => {
        const toReg = document.getElementById('toggleToRegister');
        const toLog = document.getElementById('toggleToLogin');
        
        if(toReg) toReg.onclick = (e) => { e.preventDefault(); document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        if(toLog) toLog.onclick = (e) => { e.preventDefault(); document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };

        document.getElementById('login-form').onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            AppNutri.auth.signInWithEmailAndPassword(email, pass).catch(err => alert("Erro Login: " + err.message));
        };

        document.getElementById('register-form').onsubmit = (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const pass = document.getElementById('registerPassword').value;
            const name = document.getElementById('registerName').value;
            
            AppNutri.auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => {
                    // Envia para aprovação do admin geral (Coach Leandro)
                    AppNutri.db.ref('pendingApprovals/' + cred.user.uid).set({ 
                        name: name, 
                        email: email,
                        requestDate: new Date().toISOString()
                    });
                })
                .catch(err => alert("Erro Registro: " + err.message));
        };

        document.getElementById('btn-logout').onclick = () => AppNutri.auth.signOut();
        document.getElementById('btn-logout-pending').onclick = () => AppNutri.auth.signOut();
    },

    setupModals: () => {
        // Modal de Comida (Paciente)
        document.getElementById('btn-log-food').onclick = () => {
            document.getElementById('food-form').reset();
            document.getElementById('food-ia-feedback').textContent = "";
            document.getElementById('food-modal').classList.remove('hidden');
        };
        document.getElementById('close-food-modal').onclick = () => document.getElementById('food-modal').classList.add('hidden');
        document.getElementById('food-form').onsubmit = AppNutri.handleSaveFoodLog;

        // Modal da Dieta (Nutri)
        document.getElementById('btn-edit-diet').onclick = () => {
            if(!AppNutri.selectedPatientId) return alert("Selecione um paciente primeiro.");
            document.getElementById('diet-content').value = AppNutri.currentPatientData.diet || "";
            document.getElementById('diet-modal').classList.remove('hidden');
        };
        document.getElementById('close-diet-modal').onclick = () => document.getElementById('diet-modal').classList.add('hidden');
        document.getElementById('diet-form').onsubmit = AppNutri.handleSaveDiet;

        // IA Report Modal (Nutri)
        document.getElementById('close-nutri-report-modal').onclick = () => document.getElementById('nutri-report-modal').classList.add('hidden');
        document.getElementById('btn-nutri-ia').onclick = AppNutri.generateNutriIAReport;
    },

    // --- 3. VISÃO DO PACIENTE (ALUNO) ---
    initPatientView: () => {
        document.getElementById('patient-view').classList.remove('hidden');
        document.getElementById('nutri-view').classList.add('hidden');

        AppNutri.checkStravaConnection();
        AppNutri.loadPatientDiet(AppNutri.user.uid, true);
        AppNutri.loadPatientFoodLogs(AppNutri.user.uid, true);
    },

    // --- 4. LÓGICA DO STRAVA (REUTILIZADA DE FORMA SEGURA) ---
    checkStravaConnection: () => {
        AppNutri.db.ref(`users/${AppNutri.user.uid}/stravaAuth`).on('value', snapshot => {
            AppNutri.stravaAuth = snapshot.val(); 
            
            const btnConnect = document.getElementById('btn-connect-strava');
            const btnSync = document.getElementById('btn-sync-strava');
            const status = document.getElementById('status-strava');
            
            if (snapshot.exists()) {
                if(btnConnect) btnConnect.classList.add('hidden');
                if(btnSync) btnSync.classList.remove('hidden');
                if(status) status.textContent = "✅ Conectado ao Strava.";
                if(btnSync) btnSync.onclick = AppNutri.handleStravaSync; 
            } else {
                if(btnConnect) btnConnect.classList.remove('hidden');
                if(btnSync) btnSync.classList.add('hidden');
                if(status) status.textContent = "Strava não conectado.";
                if(btnConnect) btnConnect.onclick = () => {
                    const config = window.STRAVA_PUBLIC_CONFIG;
                    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${config.clientID}&response_type=code&redirect_uri=${config.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all`;
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
                    await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
                        body: JSON.stringify({code})
                    });
                    // Remove o code da URL de forma limpa
                    window.history.replaceState({}, document.title, "nutri-ia.html");
                    alert("Strava conectado com sucesso!");
                }
            }, 500);
        } catch(e) { alert("Erro ao conectar Strava: " + e.message); }
    },

    refreshStravaToken: async () => {
        const token = await AppNutri.user.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelRefreshAPI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if(!res.ok) throw new Error(json.error);
        return json.accessToken;
    },

    handleStravaSync: async () => {
        const btn = document.getElementById('btn-sync-strava');
        const statusEl = document.getElementById('status-strava');
        
        if (!AppNutri.stravaAuth || !AppNutri.stravaAuth.accessToken) return alert("Erro de Token Strava.");
        
        btn.disabled = true;
        const originalText = statusEl.textContent;
        statusEl.textContent = "🔄 Sincronizando treinos recentes...";

        try {
            let accessToken = AppNutri.stravaAuth.accessToken;
            const nowSeconds = Math.floor(Date.now() / 1000);
            
            // Renova token se estiver a menos de 5 min de expirar
            if (nowSeconds >= (AppNutri.stravaAuth.expiresAt - 300)) {
                statusEl.textContent = "🔄 Renovando token...";
                accessToken = await AppNutri.refreshStravaToken();
            }

            // Busca as últimas 30 atividades do paciente
            const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=30`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error("Falha na API do Strava.");
            const activities = await response.json();
            
            // Pega treinos já existentes na base (criados pelo coach Leandro)
            const snap = await AppNutri.db.ref(`data/${AppNutri.user.uid}/workouts`).once('value');
            const existing = snap.val() || {};
            
            const updates = {};
            let countNew = 0, countMerged = 0;

            for (const act of activities) {
                let exists = false;
                for (let k in existing) {
                    if (String(existing[k].stravaActivityId) === String(act.id)) { exists = true; break; }
                }
                if (exists) continue; // Pula atividades já sincronizadas

                const distKm = (act.distance / 1000).toFixed(2) + " km";
                const tempoStr = new Date(act.moving_time * 1000).toISOString().substr(11, 8);
                
                const stravaPayload = {
                    distancia: distKm, 
                    tempo: tempoStr,
                    calorias: act.kilojoules ? (act.kilojoules * 0.239006).toFixed(0) + " kcal" : "N/D", // Estimativa base do Strava
                    mapLink: `https://www.strava.com/activities/${act.id}`
                };

                const actDate = act.start_date.split('T')[0];
                let matchKey = null;
                
                // Tenta fazer o merge com treinos planejados
                for (let k in existing) {
                    if (existing[k].date === actDate && existing[k].status === 'planejado') { matchKey = k; break; }
                }

                if (matchKey) {
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/status`] = "realizado";
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/stravaActivityId`] = String(act.id);
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/stravaData`] = stravaPayload;
                    updates[`data/${AppNutri.user.uid}/workouts/${matchKey}/realizadoAt`] = new Date().toISOString();
                    countMerged++;
                } else {
                    const newKey = AppNutri.db.ref().push().key;
                    updates[`data/${AppNutri.user.uid}/workouts/${newKey}`] = {
                        title: act.name, 
                        date: actDate, 
                        status: "realizado", 
                        createdBy: AppNutri.user.uid, 
                        stravaActivityId: String(act.id), 
                        stravaData: stravaPayload, 
                        createdAt: new Date().toISOString(),
                        realizadoAt: new Date().toISOString()
                    };
                    countNew++;
                }
            }

            if (Object.keys(updates).length > 0) {
                await AppNutri.db.ref().update(updates);
                alert(`Strava: ${countNew} novos treinos puxados e ${countMerged} sincronizados.`);
            } else {
                alert("Nenhum treino novo no Strava.");
            }

        } catch(e) {
            alert("Erro Strava Sync: " + e.message);
        } finally {
            btn.disabled = false;
            statusEl.textContent = originalText;
        }
    },

    // --- 5. LOG E AVALIAÇÃO DE REFEIÇÕES (GEMINI VISION) ---
    handleSaveFoodLog: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-food');
        const feedbackEl = document.getElementById('food-ia-feedback');
        
        const type = document.getElementById('food-type').value;
        const desc = document.getElementById('food-description').value;
        const file = document.getElementById('food-photo').files[0];
        
        if(!file) return alert("A foto do prato é obrigatória para a IA avaliar.");

        btn.disabled = true;
        btn.textContent = "Avaliando com IA (Aguarde)...";
        feedbackEl.textContent = "Enviando foto e analisando macronutrientes...";

        try {
            // 1. Upload imagem para Cloudinary
            const f = new FormData(); 
            f.append('file', file); 
            f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
            f.append('folder', `lerunners/nutri/${AppNutri.user.uid}`);
            
            const rCloud = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
            const dCloud = await rCloud.json(); 
            const imageUrl = dCloud.secure_url;

            // 2. Extrai base64 para a Gemini Vision
            const base64 = await new Promise((r,j)=>{
                const d=new FileReader();
                d.onload=()=>r(d.result.split(',')[1]);
                d.onerror=j;
                d.readAsDataURL(file)
            });

            // 3. Prompt para o Gemini atuar como Nutricionista
            const promptText = `
                Atue como uma Nutricionista Clínica e Esportiva.
                O paciente enviou a foto desta refeição classificada como "${type}".
                
                MISSÃO:
                1. Descreva brevemente o que você identifica no prato.
                2. Estime as Calorias Totais (Kcal).
                3. Estime os Macronutrientes (Carboidratos, Proteínas e Gorduras em gramas).
                4. Dê uma nota de 1 a 10 para o nível de saudabilidade desta refeição.

                OBRIGATÓRIO: Retorne ESTRITAMENTE um objeto JSON válido, sem blocos de código (markdown), exatamente com esta estrutura:
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
                method: 'POST', 
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    contents:[{
                        parts:[
                            {text: promptText},
                            {inlineData:{mimeType:file.type, data:base64}}
                        ]
                    }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });
            
            if(!rGemini.ok) throw new Error("Falha na avaliação da IA Vision.");
            const dGemini = await rGemini.json();
            const textResponse = dGemini.candidates[0].content.parts[0].text;
            
            // Limpa formatação Markdown se houver
            const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiData = JSON.parse(cleanJson);

            // 4. Salva no Firebase
            const logData = {
                type: type,
                description: desc,
                imageUrl: imageUrl,
                aiAnalysis: aiData,
                timestamp: new Date().toISOString(),
                date: new Date().toISOString().split('T')[0]
            };

            await AppNutri.db.ref(`nutriData/${AppNutri.user.uid}/logs`).push(logData);

            document.getElementById('food-modal').classList.add('hidden');
            alert("Refeição salva e analisada com sucesso!");

        } catch (err) {
            console.error(err);
            feedbackEl.textContent = "Erro na avaliação: " + err.message;
            alert("Ocorreu um erro. Tente novamente ou envie uma foto com melhor iluminação.");
        } finally {
            btn.disabled = false;
            btn.textContent = "SALVAR REFEIÇÃO";
        }
    },

    loadPatientDiet: (uid, isPatientView) => {
        const container = isPatientView ? document.getElementById('patient-diet-content') : document.getElementById('diet-content');
        
        AppNutri.db.ref(`nutriData/${uid}/diet`).on('value', snapshot => {
            if (isPatientView) {
                if (snapshot.exists() && snapshot.val() !== "") {
                    // Transforma quebras de linha em <br> para visualização bonita
                    container.innerHTML = `<div style="white-space:pre-wrap; font-family:sans-serif; line-height:1.6; color:#333;">${snapshot.val()}</div>`;
                } else {
                    container.innerHTML = '<p style="color:#666; font-style:italic;">Nenhuma dieta ativa prescrita no momento.</p>';
                }
            } else {
                // Atualiza o estado da Nutri
                AppNutri.currentPatientData.diet = snapshot.val() || "";
            }
        });
    },

    loadPatientFoodLogs: (uid, isPatientView) => {
        const listEl = isPatientView ? document.getElementById('patient-food-list') : document.getElementById('nutri-logs-content');
        
        AppNutri.db.ref(`nutriData/${uid}/logs`).on('value', snapshot => {
            if(!isPatientView) AppNutri.currentPatientData.logs = [];

            listEl.innerHTML = "";
            if (!snapshot.exists()) {
                listEl.innerHTML = "<p style='color:#666; text-align:center;'>Nenhum registro alimentar encontrado.</p>";
                return;
            }

            const arr = [];
            snapshot.forEach(child => arr.push({ id: child.key, ...child.val() }));
            
            // Ordena mais recentes primeiro
            arr.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            
            if(!isPatientView) AppNutri.currentPatientData.logs = arr;

            arr.forEach(log => {
                const el = document.createElement('div');
                el.className = 'food-card';
                
                // Data formatada
                const dt = new Date(log.timestamp);
                const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const dateStr = dt.toLocaleDateString('pt-BR');

                let aiHtml = "";
                if(log.aiAnalysis) {
                    const ai = log.aiAnalysis;
                    aiHtml = `
                        <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #ccc;">
                            <strong style="color:#2e7d32; font-size:0.9rem;"><i class='bx bx-brain'></i> Leitura da IA:</strong>
                            <p style="font-size:0.85rem; color:#555; margin:5px 0;">${ai.descricao || 'Sem descrição.'}</p>
                            <div>
                                <span class="macro-badge macro-kcal">${ai.kcal} Kcal</span>
                                <span class="macro-badge macro-carb">Carb: ${ai.carbo_g}g</span>
                                <span class="macro-badge macro-prot">Prot: ${ai.prot_g}g</span>
                                <span class="macro-badge macro-fat">Gord: ${ai.gord_g}g</span>
                            </div>
                            <div style="margin-top:5px; font-size:0.8rem; font-weight:bold; color: ${ai.nota_saude >= 7 ? '#2e7d32' : '#c62828'}">
                                Nota Nutricional: ${ai.nota_saude}/10
                            </div>
                        </div>
                    `;
                }

                el.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#2e7d32; font-size:1.1rem;">${log.type}</strong>
                        <span style="font-size:0.8rem; color:#888;">${dateStr} às ${timeStr}</span>
                    </div>
                    ${log.description ? `<p style="font-size:0.95rem; color:#444; margin-top:5px;">${log.description}</p>` : ''}
                    ${log.imageUrl ? `<img src="${log.imageUrl}" class="food-image" alt="Prato">` : ''}
                    ${aiHtml}
                    
                    <!-- Botão de exclusão se for o paciente (ou a nutri, para moderar) -->
                    <div style="text-align:right; margin-top:10px;">
                        <button class="btn-delete-log" data-id="${log.id}" style="background:none; border:none; color:#c62828; cursor:pointer; font-size:0.9rem;"><i class='bx bx-trash'></i> Apagar</button>
                    </div>
                `;

                // Ação de deletar
                el.querySelector('.btn-delete-log').onclick = () => {
                    if(confirm("Apagar este registro alimentar?")) {
                        AppNutri.db.ref(`nutriData/${uid}/logs/${log.id}`).remove();
                    }
                };

                listEl.appendChild(el);
            });
        });
    },

    // --- 6. VISÃO DA NUTRICIONISTA (DAIANA) ---
    initNutriView: () => {
        document.getElementById('nutri-view').classList.remove('hidden');
        document.getElementById('patient-view').classList.add('hidden');
        
        AppNutri.loadAllPatients();

        // Listener do Select de Pacientes
        document.getElementById('nutri-patient-select').onchange = (e) => {
            const uid = e.target.value;
            if (uid) {
                AppNutri.selectPatient(uid);
            } else {
                document.getElementById('nutri-patient-dashboard').classList.add('hidden');
                AppNutri.selectedPatientId = null;
            }
        };

        // Abas internas do Dashboard da Nutri
        const tabLogs = document.getElementById('tab-nutri-logs');
        const tabStrava = document.getElementById('tab-nutri-strava');
        const contLogs = document.getElementById('nutri-logs-content');
        const contStrava = document.getElementById('nutri-strava-content');

        tabLogs.onclick = () => {
            tabLogs.classList.add('active'); tabLogs.style.borderBottom = "3px solid #2e7d32"; tabLogs.style.color = "#2e7d32";
            tabStrava.classList.remove('active'); tabStrava.style.borderBottom = "none"; tabStrava.style.color = "#666";
            contLogs.classList.remove('hidden'); contStrava.classList.add('hidden');
        };

        tabStrava.onclick = () => {
            tabStrava.classList.add('active'); tabStrava.style.borderBottom = "3px solid #2e7d32"; tabStrava.style.color = "#2e7d32";
            tabLogs.classList.remove('active'); tabLogs.style.borderBottom = "none"; tabLogs.style.color = "#666";
            contStrava.classList.remove('hidden'); contLogs.classList.add('hidden');
        };
    },

    loadAllPatients: () => {
        const select = document.getElementById('nutri-patient-select');
        select.innerHTML = "<option value=''>Carregando pacientes...</option>";
        
        AppNutri.db.ref('users').on('value', snapshot => {
            if (!snapshot.exists()) {
                select.innerHTML = "<option value=''>Nenhum usuário cadastrado.</option>";
                return;
            }

            AppNutri.patients = snapshot.val();
            select.innerHTML = "<option value=''>-- Selecione um Aluno/Paciente --</option>";
            
            Object.entries(AppNutri.patients).forEach(([uid, data]) => {
                // Filtra para não listar administradores/nutris no select se não quiser, 
                // mas vamos listar todos para segurança, exceto a si mesmo.
                if (uid !== AppNutri.user.uid) {
                    const opt = document.createElement('option');
                    opt.value = uid;
                    opt.textContent = data.name + (data.role ? ` (${data.role})` : '');
                    select.appendChild(opt);
                }
            });
        });
    },

    selectPatient: (uid) => {
        AppNutri.selectedPatientId = uid;
        document.getElementById('nutri-patient-dashboard').classList.remove('hidden');
        
        // Carrega dados pro Estado Interno
        AppNutri.loadPatientDiet(uid, false);
        AppNutri.loadPatientFoodLogs(uid, false);
        AppNutri.loadPatientWorkoutsStrava(uid);
    },

    loadPatientWorkoutsStrava: (uid) => {
        const listEl = document.getElementById('nutri-strava-content');
        
        AppNutri.db.ref(`data/${uid}/workouts`).on('value', snapshot => {
            AppNutri.currentPatientData.workouts = [];
            listEl.innerHTML = "";
            
            if (!snapshot.exists()) {
                listEl.innerHTML = "<p style='color:#666; text-align:center;'>Nenhum treino registrado.</p>";
                return;
            }

            const arr = [];
            snapshot.forEach(child => arr.push({ id: child.key, ...child.val() }));
            
            // Só interessa os realizados (com dados de gasto calórico ou strava)
            const filtrados = arr.filter(w => w.status === 'realizado');
            filtrados.sort((a,b) => new Date(b.realizadoAt || b.date).getTime() - new Date(a.realizadoAt || a.date).getTime());
            
            AppNutri.currentPatientData.workouts = filtrados;

            if (filtrados.length === 0) {
                listEl.innerHTML = "<p style='color:#666; text-align:center;'>Nenhum treino concluído recentemente.</p>";
                return;
            }

            filtrados.forEach(w => {
                const el = document.createElement('div');
                el.className = 'food-card';
                el.style.borderLeftColor = '#fc4c02'; // Cor do strava/treino

                let info = `<strong>${w.title}</strong> - ${w.date}<br>`;
                info += `<p style="font-size:0.9rem; margin:5px 0; color:#555;">${w.description || 'Atividade Física'}</p>`;
                
                if (w.stravaData) {
                    info += `<div style="background:#fff5f0; padding:8px; border-radius:5px; font-family:monospace; font-size:0.9rem; color:#fc4c02; margin-top:5px;">`;
                    info += `Dist: ${w.stravaData.distancia} | Tempo: ${w.stravaData.tempo}`;
                    if(w.stravaData.calorias) info += ` | Est. Kcal: ${w.stravaData.calorias}`;
                    info += `</div>`;
                }

                el.innerHTML = info;
                listEl.appendChild(el);
            });
        });
    },

    handleSaveDiet: async (e) => {
        e.preventDefault();
        if(!AppNutri.selectedPatientId) return;

        const content = document.getElementById('diet-content').value;
        const btn = document.getElementById('btn-save-diet');
        
        btn.disabled = true;
        btn.textContent = "Salvando...";

        try {
            await AppNutri.db.ref(`nutriData/${AppNutri.selectedPatientId}/diet`).set(content);
            alert("Plano alimentar atualizado com sucesso!");
            document.getElementById('diet-modal').classList.add('hidden');
        } catch(err) {
            alert("Erro ao salvar dieta: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "ATUALIZAR DIETA";
        }
    },

    // --- 7. ASSISTENTE DE IA DA NUTRI (AVALIAÇÃO GERAL) ---
    generateNutriIAReport: async () => {
        if(!AppNutri.selectedPatientId) return;

        const btn = document.getElementById('btn-nutri-ia');
        const loading = document.getElementById('nutri-ia-loading');
        
        btn.disabled = true;
        loading.classList.remove('hidden');

        try {
            const pacName = AppNutri.patients[AppNutri.selectedPatientId].name;
            const diet = AppNutri.currentPatientData.diet || "Nenhuma dieta prescrita.";
            
            // Pega os 10 últimos registros de comida
            const recentLogs = AppNutri.currentPatientData.logs.slice(0, 10).map(l => ({
                tipo: l.type,
                data: l.date,
                descricao_paciente: l.description,
                analise_ia_foto: l.aiAnalysis ? { kcal: l.aiAnalysis.kcal, nota: l.aiAnalysis.nota_saude } : 'Sem foto lida'
            }));

            // Pega os 5 últimos treinos
            const recentWorkouts = AppNutri.currentPatientData.workouts.slice(0, 5).map(w => ({
                data: w.date,
                treino: w.title,
                distancia: w.stravaData?.distancia || 'N/A',
                estimativa_kcal_gasta: w.stravaData?.calorias || 'N/A'
            }));

            const promptText = `
                ATUE COMO: Daiana, Nutricionista Clínica e Esportiva Sênior.
                OBJETIVO: Avaliar o paciente "${pacName}".
                
                DADOS DO PACIENTE:
                1. DIETA PRESCRITA:
                ${diet}

                2. ÚLTIMOS REGISTROS ALIMENTARES (Do mais recente para o mais antigo):
                ${JSON.stringify(recentLogs, null, 2)}

                3. ÚLTIMOS TREINOS REALIZADOS (Strava/Registro):
                ${JSON.stringify(recentWorkouts, null, 2)}

                DIRETRIZES DO RELATÓRIO:
                1. Analise se a alimentação registrada bate com a dieta prescrita (Adesão).
                2. Verifique se a ingestão calórica (estimada nas fotos) está condizente com o gasto calórico dos treinos informados.
                3. Dê um feedback técnico, direto e profissional sobre erros e acertos do paciente nesta semana.
                4. Forneça uma sugestão clara de ajuste (se necessário).

                Não use saudações longas. Formate o texto com tópicos bem definidos usando markdown.
            `;

            const rGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST', 
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });
            
            if(!rGemini.ok) throw new Error("Falha na API Gemini.");
            const dGemini = await rGemini.json();
            const reportText = dGemini.candidates[0].content.parts[0].text;
            
            document.getElementById('nutri-report-content').textContent = reportText;
            document.getElementById('nutri-report-modal').classList.remove('hidden');

        } catch (err) {
            console.error(err);
            alert("Erro ao gerar relatório da IA: " + err.message);
        } finally {
            btn.disabled = false;
            loading.classList.add('hidden');
        }
    }
};

// Start
document.addEventListener('DOMContentLoaded', AppNutri.init);
