/* =================================================================== */
/* APP.JS - LÓGICA CENTRAL (V2 RESTAURADA + STRAVA DEEP SYNC)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null, userData: null, db: null, auth: null,
        listeners: {}, currentView: 'planilha', viewMode: 'admin',
        adminUIDs: {}, userCache: {}, 
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaTokenData: null, currentAnalysisData: null
    },
    elements: {},

    init: () => {
        if(typeof window.firebaseConfig === 'undefined') return;
        try { if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Se estiver na tela de login
        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.mainContent = document.getElementById('app-main-content');

        // Binds Globais
        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        
        // Binds Modais (Generic Closure)
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms de Modal
        if(document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if(document.getElementById('comment-form')) document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        if(document.getElementById('profile-form')) document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        if(document.getElementById('log-activity-form')) document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;
        if(document.getElementById('photo-upload-input')) document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        
        // IA Save Button
        const btnSaveIa = document.getElementById('save-ia-analysis-btn');
        if(btnSaveIa) btnSaveIa.onclick = AppPrincipal.handleSaveIaAnalysis;

        // Strava Code Check
        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) { window.location.href = 'index.html'; return; }
            AppPrincipal.state.currentUser = user;
            
            // Strava Callback
            if (urlParams.get('code')) { 
                AppPrincipal.exchangeStravaCode(urlParams.get('code')); 
                return; 
            }
            
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        // Cache Global de Usuários (para nomes no feed/comentários)
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        
        // Dados do Usuário Logado
        AppPrincipal.state.db.ref('users/' + uid).once('value', s => {
            let data = s.val();
            
            // Check Admin
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                
                // Auto-create profile if admin missing
                if (!data && isAdmin) { 
                    data = { name: AppPrincipal.state.currentUser.email, role: 'admin' }; 
                    AppPrincipal.state.db.ref('users/' + uid).set(data); 
                }
                
                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; 
                        // Toggle Coach/Atleta (V2 Feature)
                        const nav = document.querySelector('.app-header nav');
                        if(!document.getElementById('admin-toggle')) {
                            const btn = document.createElement('button');
                            btn.id = 'admin-toggle'; 
                            btn.className = 'btn btn-nav'; 
                            btn.innerHTML = "Modo Atleta"; 
                            btn.style.border = "1px solid white";
                            btn.onclick = () => {
                                AppPrincipal.state.viewMode = AppPrincipal.state.viewMode === 'admin' ? 'atleta' : 'admin';
                                btn.innerHTML = AppPrincipal.state.viewMode === 'admin' ? "Modo Atleta" : "Modo Coach";
                                AppPrincipal.updateClasses(); 
                                AppPrincipal.navigateTo('planilha');
                            };
                            nav.insertBefore(btn, document.getElementById('logoutButton'));
                        }
                    }
                    
                    // Listener Strava Token
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    
                    AppPrincipal.updateClasses();
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    updateClasses: () => {
        const c = document.getElementById('app-container');
        if(AppPrincipal.state.viewMode==='admin') { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
        else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
    },

    // --- CORREÇÃO CRÍTICA V2: ROTEAMENTO VIA TEMPLATE ---
    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        
        // 1. UI Feedback
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); 
        if(btn) btn.classList.add('active');

        // 2. Limpar Listeners Antigos (Evita Memory Leak)
        if(window.panels && window.panels.cleanup) window.panels.cleanup();

        // 3. Renderizar Template
        mainContent.innerHTML = ""; // Limpa o DOM anterior
        
        let templateId = "";
        if (page === 'planilha') {
            if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') {
                templateId = "admin-panel-template";
            } else {
                templateId = "atleta-panel-template";
            }
        } else if (page === 'feed') {
            templateId = "feed-panel-template";
        }

        const template = document.getElementById(templateId);
        if (template) {
            const clone = template.content.cloneNode(true);
            mainContent.appendChild(clone);
            
            // 4. Inicializar Lógica do Painel (SÓ DEPOIS DO DOM EXISTIR)
            if (page === 'planilha') {
                if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') {
                    AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                } else {
                    AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                }
            } else if (page === 'feed') {
                FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        }

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // ===================================================================
    // ORÁCULO: LÓGICA DE STRAVA DEEP SYNC & MATCH (PAGINAÇÃO COMPLETA)
    // ===================================================================
    handleStravaConnect: () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; },
    
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({code}) });
        window.history.replaceState({}, document.title, "app.html"); window.location.reload();
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        
        const btn = document.getElementById('btn-strava-action');
        const statusMsg = document.getElementById('strava-sync-status');
        if(btn) { btn.disabled=true; btn.textContent="Sincronizando..."; }
        if(statusMsg) statusMsg.textContent = "Iniciando Loop de Busca...";

        try {
            // 1. Busca Treinos EXISTENTES (Para Match)
            const existingSnap = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).once('value');
            const existingWorkouts = existingSnap.val() || {};

            const updates = {};
            let totalImported = 0;
            let page = 1;
            let keepFetching = true;
            const perPage = 50; // Strava permite até 200, mas 50 é seguro

            // LOOP DE PAGINAÇÃO (Deep Sync)
            while (keepFetching) {
                if(statusMsg) statusMsg.textContent = `Buscando página ${page}...`;
                
                const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`, { 
                    headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } 
                });
                
                if (!response.ok) throw new Error("Erro Strava API: " + response.status);
                
                const activities = await response.json();
                
                if (activities.length === 0) {
                    keepFetching = false;
                    break;
                }

                for(const act of activities) {
                    // Verifica duplicidade pelo ID do Strava (evita re-processar o mesmo ID em avulsos)
                    let alreadyExists = false;
                    for (const [key, val] of Object.entries(existingWorkouts)) {
                        if (String(val.stravaActivityId) === String(act.id)) alreadyExists = true;
                    }

                    // Se não existe, ou se existe mas queremos atualizar os detalhes, processamos.
                    // Aqui, vamos processar se não existir OU se for um treino planejado que precisa de match.
                    
                    // Detalhes Profundos (Splits, Elevation)
                    // Nota: Fetch individual pode atingir Rate Limit. O ideal é importar o resumo e, se o usuário clicar em "Ver", buscar detalhes.
                    // Mas como o Coach pediu "Deep Sync", vamos buscar detalhes.
                    // Pequeno delay para não estourar a API
                    await new Promise(r => setTimeout(r, 100)); 

                    const detail = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } }).then(r => r.json());
                    
                    // Formatação de Dados
                    let splits = [];
                    if(detail.splits_metric) {
                        splits = detail.splits_metric.map((s, i) => {
                            const pMin = Math.floor((s.moving_time/60)/(s.distance/1000)); 
                            const pSec = Math.round(((s.moving_time/60)/(s.distance/1000)-pMin)*60);
                            return { km: i+1, pace: `${pMin}'${pSec.toString().padStart(2,'0')}"`, time: new Date(s.moving_time*1000).toISOString().substr(14,5), elev: (s.elevation_difference||0).toFixed(0) };
                        });
                    }
                    
                    const distKm = (act.distance/1000).toFixed(2)+" km";
                    const paceMin = Math.floor((act.moving_time/60)/(act.distance/1000));
                    const paceSec = Math.round(((act.moving_time/60)/(act.distance/1000)-paceMin)*60);
                    const stravaPayload = { 
                        distancia: distKm, 
                        tempo: new Date(act.moving_time*1000).toISOString().substr(11,8), 
                        ritmo: `${paceMin}:${paceSec.toString().padStart(2,'0')}`, 
                        id: act.id,
                        splits: splits, 
                        elevacao: (act.total_elevation_gain||0)+"m",
                        calorias: (detail.calories || 0) + " kcal",
                        mapLink: detail.map?.summary_polyline ? `https://www.strava.com/activities/${act.id}` : null
                    };

                    // --- MATCH LOGIC (DATA EXATA) ---
                    // Strava Date: "2023-10-25T10:00:00Z" -> "2023-10-25"
                    const actDate = act.start_date.split('T')[0]; 
                    let matchKey = null;

                    // Procura treino PLANEJADO na mesma data
                    for (const [key, val] of Object.entries(existingWorkouts)) {
                        if (val.date === actDate && val.status !== 'realizado') {
                            matchKey = key;
                            break; 
                        }
                    }

                    if (matchKey) {
                        // CENÁRIO 1: Match Encontrado -> Atualiza Treino Existente
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/status`] = 'realizado';
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/realizadoAt`] = new Date().toISOString();
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/stravaData`] = stravaPayload;
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/stravaActivityId`] = act.id;
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/feedback`] = `Sincronizado. ${distKm} em ${stravaPayload.tempo}.`;
                        
                        // Atualiza Public (Feed)
                        const fullData = { ...existingWorkouts[matchKey], status: 'realizado', stravaData: stravaPayload };
                        updates[`/publicWorkouts/${matchKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...fullData };
                        totalImported++;
                        
                    } else if (!alreadyExists) {
                        // CENÁRIO 2: Novo Treino Avulso
                        const newKey = AppPrincipal.state.db.ref().push().key;
                        const workoutData = {
                            title: act.name,
                            date: actDate,
                            description: `[Importado]: ${act.type}`,
                            status: 'realizado',
                            realizadoAt: new Date().toISOString(),
                            feedback: `Sincronizado. ${distKm} em ${stravaPayload.tempo}.`,
                            stravaActivityId: act.id,
                            stravaData: stravaPayload,
                            createdBy: currentUser.uid
                        };
                        updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                        updates[`/publicWorkouts/${newKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...workoutData };
                        totalImported++;
                    }
                } // Fim For Activities

                page++; // Próxima página do Strava
            } // Fim While Loop

            if(Object.keys(updates).length > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                alert(`Sincronização concluída! ${totalImported} atividades processadas.`);
            } else {
                alert("Tudo atualizado. Nenhuma nova atividade encontrada.");
            }
            
            document.getElementById('profile-modal').classList.add('hidden');

        } catch(e) { 
            console.error(e);
            alert("Erro Sync: "+e.message); 
        } finally { 
            if(btn) { btn.disabled=false; btn.textContent="Sincronizar Strava"; }
            if(statusMsg) statusMsg.textContent = "";
        }
    },

    // --- MODAL DE FEEDBACK E VISUALIZAÇÃO ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        document.getElementById('feedback-modal-title').textContent = title;
        
        // Reset UI
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        document.getElementById('modal-strava-data').classList.add('hidden');

        // Carregar Dados do Treino
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
                if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
                
                // Exibir Strava Data (Splits e Infos)
                if(d.stravaData) {
                    const sd = document.getElementById('modal-strava-content');
                    const container = document.getElementById('modal-strava-data');
                    container.classList.remove('hidden');
                    
                    let html = `
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px; text-align:center;">
                            <div><b>Dist</b><br>${d.stravaData.distancia}</div>
                            <div><b>Pace</b><br>${d.stravaData.ritmo}</div>
                            <div><b>Elev</b><br>${d.stravaData.elevacao}</div>
                        </div>
                    `;
                    
                    if(d.stravaData.splits && d.stravaData.splits.length > 0) {
                        html += `<table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                                    <tr style="border-bottom:1px solid #ddd; text-align:left;"><th>Km</th><th>Pace</th><th>Elev</th></tr>`;
                        d.stravaData.splits.forEach(sp => {
                            html += `<tr><td>${sp.km}</td><td>${sp.pace}</td><td>${sp.elev}m</td></tr>`;
                        });
                        html += `</table>`;
                    }
                    sd.innerHTML = html;
                }
            }
        });
        
        // Carregar Comentários
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) return;
            s.forEach(c => {
                const v = c.val();
                list.innerHTML += `<div class="comment-item" style="border-bottom:1px solid #eee; padding:5px;"><b>${v.name}:</b> ${v.text}</div>`;
            });
        });
        
        modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        
        // Upload de Foto (Opcional)
        let imageUrl = null;
        const fileInput = document.getElementById('photo-upload-input');
        if (fileInput.files.length > 0) {
            document.getElementById('save-feedback-btn').textContent = "Enviando Foto...";
            imageUrl = await AppPrincipal.uploadFileToCloudinary(fileInput.files[0], 'workouts');
        }

        const updates = { 
            status: document.getElementById('workout-status').value, 
            feedback: document.getElementById('workout-feedback-text').value, 
            realizadoAt: new Date().toISOString() 
        };
        if(imageUrl) updates.imageUrl = imageUrl;

        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        
        // Atualiza Feed Público
        const fullSnap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
        const fullData = fullSnap.val();
        
        if(updates.status !== 'planejado') {
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                ownerId: currentOwnerId, 
                ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || "Atleta", 
                ...fullData
            });
        }
        
        document.getElementById('feedback-modal').classList.add('hidden');
        document.getElementById('save-feedback-btn').textContent = "Salvar Feedback";
    },
    
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({ 
            uid: AppPrincipal.state.currentUser.uid, 
            name: AppPrincipal.state.userData.name, 
            text: text, 
            timestamp: firebase.database.ServerValue.TIMESTAMP 
        });
        document.getElementById('comment-input').value = "";
    },
    
    handleLogActivitySubmit: async (e) => { 
        e.preventDefault();
        const currentUser = AppPrincipal.state.currentUser;
        const data = {
            date: document.getElementById('log-activity-date').value,
            title: document.getElementById('log-activity-title').value,
            description: document.getElementById('log-activity-feedback').value, // Usando feedback como desc
            status: 'realizado',
            realizadoAt: new Date().toISOString(),
            createdBy: currentUser.uid,
            createdAt: new Date().toISOString()
        };
        const ref = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).push(data);
        await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({
            ownerId: currentUser.uid,
            ownerName: AppPrincipal.state.userData.name,
            ...data
        });
        alert("Atividade salva!");
        document.getElementById('log-activity-modal').classList.add('hidden');
    },

    // Utilities
    handlePhotoUpload: () => {}, // Stub
    handleProfilePhotoUpload: () => {}, // Stub
    
    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const u = AppPrincipal.state.userData;
        if(u) {
            document.getElementById('profile-name').value = u.name || "";
            document.getElementById('profile-bio').value = u.bio || "";
            document.getElementById('profile-pic-preview').src = u.photoUrl || "https://placehold.co/150";
        }

        // Render Strava Button
        const container = document.getElementById('strava-connection-area');
        container.innerHTML = "";
        
        const btn = document.createElement('button');
        btn.id='btn-strava-action'; 
        btn.type='button'; 
        btn.className='btn btn-secondary'; 
        btn.style.width='100%';
        
        if (AppPrincipal.state.stravaTokenData) {
            btn.innerHTML = "<i class='bx bx-refresh'></i> Sincronizar Strava (Deep Sync)";
            btn.style.backgroundColor = "#fc4c02";
            btn.onclick = AppPrincipal.handleStravaSyncActivities;
            const status = document.createElement('p');
            status.id = "strava-sync-status";
            status.style.fontSize="0.8rem"; status.style.color="#666";
            container.appendChild(status);
        } else {
            btn.innerHTML = "<i class='bx bxl-strava'></i> Conectar Strava";
            btn.onclick = AppPrincipal.handleStravaConnect;
        }
        container.appendChild(btn);
    },

    handleProfileSubmit: async (e) => { 
        e.preventDefault(); 
        const name = document.getElementById('profile-name').value;
        const bio = document.getElementById('profile-bio').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({name, bio});
        alert("Perfil salvo.");
        document.getElementById('profile-modal').classList.add('hidden');
    },
    
    // IA Integration
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) throw new Error("Sem Chave API");
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if(r.status === 429) return "⚠️ Limite de uso da IA atingido. Tente novamente mais tarde.";
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    },

    handleSaveIaAnalysis: async () => {
        if(!AppPrincipal.state.currentAnalysisData) return;
        const athleteId = AdminPanel.state.selectedAthleteId;
        await AppPrincipal.state.db.ref(`iaAnalysisHistory/${athleteId}`).push(AppPrincipal.state.currentAnalysisData);
        alert("Análise salva no histórico do atleta!");
        document.getElementById('ia-analysis-modal').classList.add('hidden');
    },

    uploadFileToCloudinary: async (file, folder) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `lerunners/${folder}`);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        return data.secure_url;
    }
};

const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .then(() => window.location.href = 'app.html')
                .catch(e => document.getElementById('login-error').textContent = e.message);
        });
    }
};

// Start
document.addEventListener('DOMContentLoaded', AppPrincipal.init);
