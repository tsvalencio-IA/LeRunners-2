/* =================================================================== */
/* APP.JS - VERSÃO COMPLETA (SEM OMISSÕES) - V3.0 DEFINITIVA
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null, 
        userData: null, 
        db: null, 
        auth: null,
        listeners: {}, 
        currentView: 'planilha', 
        viewMode: 'admin',
        userCache: {}, 
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaTokenData: null, 
        currentAnalysisData: null
    },
    elements: {},

    // 1. INICIALIZAÇÃO
    init: () => {
        // Verifica configurações
        if(typeof window.firebaseConfig === 'undefined') {
            console.error("ERRO: config.js não carregado.");
            return;
        }
        
        try { 
            if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); 
        } catch(e) {
            console.error("Erro Firebase Init:", e);
        }
        
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento Inicial
        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    // 2. PLATAFORMA PRINCIPAL
    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.mainContent = document.getElementById('app-main-content');

        // Listeners Globais de Navegação
        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        
        // Fechamento Genérico de Modais
        document.querySelectorAll('.close-btn').forEach(b => {
            b.onclick = (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if(overlay) overlay.classList.add('hidden');
            };
        });
        
        // Listeners de Formulários (com verificação de existência)
        const feedbackForm = document.getElementById('feedback-form');
        if(feedbackForm) feedbackForm.onsubmit = AppPrincipal.handleFeedbackSubmit;

        const commentForm = document.getElementById('comment-form');
        if(commentForm) commentForm.onsubmit = AppPrincipal.handleCommentSubmit;

        const profileForm = document.getElementById('profile-form');
        if(profileForm) profileForm.onsubmit = AppPrincipal.handleProfileSubmit;

        const logActivityForm = document.getElementById('log-activity-form');
        if(logActivityForm) logActivityForm.onsubmit = AppPrincipal.handleLogActivitySubmit;
        
        // Upload de Foto para Análise IA (Gemini Vision)
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) photoInput.onchange = AppPrincipal.handlePhotoUpload;
        
        // Botão Salvar Análise IA
        const btnSaveIa = document.getElementById('save-ia-analysis-btn');
        if(btnSaveIa) btnSaveIa.onclick = AppPrincipal.handleSaveIaAnalysis;

        // Verifica Retorno do Strava (OAuth)
        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) { 
                window.location.href = 'index.html'; 
                return; 
            }
            
            AppPrincipal.state.currentUser = user;
            
            // Se tiver código Strava na URL, troca por token
            if (urlParams.get('code')) { 
                AppPrincipal.exchangeStravaCode(urlParams.get('code')); 
                return; 
            }
            
            // Carrega dados do usuário
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        // Cache de Usuários para exibir nomes
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        
        // Carrega Perfil
        AppPrincipal.state.db.ref('users/' + uid).once('value', s => {
            let data = s.val();
            
            // Verifica se é Admin (hardcoded no DB)
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                
                // Cria perfil básico se for admin e não existir
                if (!data && isAdmin) { 
                    data = { name: AppPrincipal.state.currentUser.email, role: 'admin' }; 
                    AppPrincipal.state.db.ref('users/' + uid).set(data); 
                }
                
                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; 
                        
                        // Cria Botão Toggle Coach/Atleta no Header
                        const nav = document.querySelector('.app-header nav');
                        if(!document.getElementById('admin-toggle')) {
                            const btn = document.createElement('button');
                            btn.id = 'admin-toggle'; 
                            btn.className = 'btn btn-nav'; 
                            btn.innerHTML = "Modo Atleta"; 
                            btn.style.border = "1px solid white";
                            btn.style.marginLeft = "10px";
                            btn.onclick = () => {
                                AppPrincipal.state.viewMode = AppPrincipal.state.viewMode === 'admin' ? 'atleta' : 'admin';
                                btn.innerHTML = AppPrincipal.state.viewMode === 'admin' ? "Modo Atleta" : "Modo Coach";
                                AppPrincipal.updateClasses(); 
                                AppPrincipal.navigateTo('planilha');
                            };
                            // Insere antes do botão Sair
                            const logoutBtn = document.getElementById('logoutButton');
                            nav.insertBefore(btn, logoutBtn);
                        }
                    }
                    
                    // Monitora token Strava
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => {
                        AppPrincipal.state.stravaTokenData = ts.val();
                    });
                    
                    AppPrincipal.updateClasses();
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    updateClasses: () => {
        const c = document.getElementById('app-container');
        if(AppPrincipal.state.viewMode==='admin') { 
            c.classList.add('admin-view'); 
            c.classList.remove('atleta-view'); 
        } else { 
            c.classList.add('atleta-view'); 
            c.classList.remove('admin-view'); 
        }
    },

    // 3. NAVEGAÇÃO SEGURA (CLONE NODE)
    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        
        // UI Feedback
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); 
        if(btn) btn.classList.add('active');

        // Limpeza de memória
        if(window.panels && window.panels.cleanup) window.panels.cleanup();

        // Limpa conteúdo
        mainContent.innerHTML = ""; 
        
        // Seleciona Template
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

        // Clona e Injeta
        const template = document.getElementById(templateId);
        if (template) {
            const clone = template.content.cloneNode(true);
            mainContent.appendChild(clone);
            
            // Inicia Lógica Específica após o DOM existir
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

    handleLogout: () => {
        AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html');
    },

    // 4. INTEGRAÇÃO STRAVA (DEEP SYNC)
    handleStravaConnect: () => { 
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; 
    },
    
    exchangeStravaCode: async (code) => {
        try {
            const token = await AppPrincipal.state.currentUser.getIdToken();
            await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, 
                body: JSON.stringify({code}) 
            });
            window.history.replaceState({}, document.title, "app.html"); 
            window.location.reload();
        } catch(e) {
            alert("Erro ao conectar Strava: " + e.message);
        }
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        
        const btn = document.getElementById('btn-strava-action');
        const statusMsg = document.getElementById('strava-sync-status');
        
        if(btn) { btn.disabled=true; btn.textContent="Sincronizando..."; }
        if(statusMsg) statusMsg.textContent = "Iniciando...";

        try {
            // Pega treinos atuais para evitar duplicatas e fazer match
            const existingSnap = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).once('value');
            const existingWorkouts = existingSnap.val() || {};

            const updates = {};
            let totalImported = 0;
            let page = 1;
            let keepFetching = true;
            const perPage = 30; 

            // LOOP WHILE: Continua até o Strava não devolver mais nada
            while (keepFetching) {
                if(statusMsg) statusMsg.textContent = `Buscando página ${page}...`;
                console.log(`Strava Sync: Página ${page}`);
                
                const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`, { 
                    headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } 
                });
                
                if (!response.ok) {
                    if(response.status === 429) alert("Limite do Strava atingido. Tente mais tarde.");
                    break;
                }
                
                const activities = await response.json();
                
                if (activities.length === 0) {
                    keepFetching = false;
                    break;
                }

                for(const act of activities) {
                    let matchKey = null;
                    const actDate = act.start_date.split('T')[0];
                    let alreadyExists = false;

                    // Verifica se já existe pelo ID
                    for (const [key, val] of Object.entries(existingWorkouts)) {
                        if (String(val.stravaActivityId) === String(act.id)) alreadyExists = true;
                        // Verifica Match de Data (se não realizado)
                        if (val.date === actDate && val.status !== 'realizado') matchKey = key;
                    }

                    // Se já existe e não é um match pendente, pula
                    if(alreadyExists && !matchKey) continue;

                    // Busca DETALHES (Splits) com pequeno delay para não estourar API
                    await new Promise(r => setTimeout(r, 200)); 
                    
                    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { 
                        headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } 
                    });
                    const detail = await detailRes.json();
                    
                    // Processa Splits
                    let splits = [];
                    if(detail.splits_metric) {
                        splits = detail.splits_metric.map((s, i) => {
                            const pMin = Math.floor((s.moving_time/60)/(s.distance/1000)); 
                            const pSec = Math.round(((s.moving_time/60)/(s.distance/1000)-pMin)*60);
                            const pStr = (isFinite(pMin) && isFinite(pSec)) ? `${pMin}'${pSec.toString().padStart(2,'0')}"` : "-";
                            return { 
                                km: i+1, 
                                pace: pStr, 
                                time: new Date(s.moving_time*1000).toISOString().substr(14,5), 
                                elev: (s.elevation_difference||0).toFixed(0) 
                            };
                        });
                    }
                    
                    const distKm = (act.distance/1000).toFixed(2)+" km";
                    const paceMin = Math.floor((act.moving_time/60)/(act.distance/1000));
                    const paceSec = Math.round(((act.moving_time/60)/(act.distance/1000)-paceMin)*60);
                    const paceTotal = (isFinite(paceMin) && isFinite(paceSec)) ? `${paceMin}:${paceSec.toString().padStart(2,'0')}` : "-";
                    
                    const stravaPayload = { 
                        distancia: distKm, 
                        tempo: new Date(act.moving_time*1000).toISOString().substr(11,8), 
                        ritmo: paceTotal, 
                        id: act.id,
                        splits: splits, 
                        elevacao: (act.total_elevation_gain||0)+"m",
                        calorias: (detail.calories || 0) + " kcal",
                        mapLink: detail.map?.summary_polyline ? `https://www.strava.com/activities/${act.id}` : null
                    };

                    if (matchKey) {
                        // Atualiza treino existente
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/status`] = 'realizado';
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/realizadoAt`] = new Date().toISOString();
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/stravaData`] = stravaPayload;
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/stravaActivityId`] = act.id;
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}/feedback`] = `Sincronizado. ${distKm} em ${stravaPayload.tempo}.`;
                        
                        // Atualiza Public
                        updates[`/publicWorkouts/${matchKey}`] = { 
                            ownerId: currentUser.uid, 
                            ownerName: AppPrincipal.state.userData.name, 
                            ...existingWorkouts[matchKey], 
                            status: 'realizado', 
                            stravaData: stravaPayload 
                        };
                        totalImported++;
                    } else {
                        // Cria novo treino avulso
                        const newKey = AppPrincipal.state.db.ref().push().key;
                        const wData = {
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
                        updates[`/data/${currentUser.uid}/workouts/${newKey}`] = wData;
                        updates[`/publicWorkouts/${newKey}`] = { 
                            ownerId: currentUser.uid, 
                            ownerName: AppPrincipal.state.userData.name, 
                            ...wData 
                        };
                        totalImported++;
                    }
                } // Fim For Activities

                page++; // Incrementa página
            } // Fim While

            if(Object.keys(updates).length > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                alert(`Sincronização concluída! ${totalImported} atividades processadas.`);
            } else {
                alert("Tudo atualizado. Nenhuma nova atividade.");
            }
            
            // Fecha modal
            document.getElementById('profile-modal').classList.add('hidden');

        } catch(e) { 
            console.error(e); 
            alert("Erro Sync: "+e.message); 
        } finally { 
            if(btn) { btn.disabled=false; btn.textContent="Sincronizar Strava"; }
            if(statusMsg) statusMsg.textContent = "";
        }
    },

    // 5. GESTÃO DE FEEDBACK E MODAIS
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        document.getElementById('feedback-modal-title').textContent = title;
        document.getElementById('comments-list').innerHTML = "Carregando...";
        document.getElementById('modal-strava-data').classList.add('hidden');
        document.getElementById('photo-upload-feedback').textContent = "";

        // Carrega Treino
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
                if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
                
                // Exibe Dados Strava no Modal
                if(d.stravaData) {
                    const sd = document.getElementById('modal-strava-content');
                    document.getElementById('modal-strava-data').classList.remove('hidden');
                    
                    let html = `<div style="text-align:center; margin-bottom:10px; font-size:1.1em;">
                        <b>${d.stravaData.distancia}</b> | ${d.stravaData.tempo} | ${d.stravaData.ritmo}
                    </div>`;
                    
                    if(d.stravaData.splits) {
                        html += `<table style="width:100%; font-size:0.85rem; border-collapse:collapse; text-align:center;">
                            <thead style="background:#f0f0f0;"><tr><th style="padding:5px;">Km</th><th>Pace</th><th>Elev</th></tr></thead>
                            <tbody>`;
                        d.stravaData.splits.forEach(sp => {
                            html += `<tr><td style="padding:4px; border-bottom:1px solid #eee;">${sp.km}</td><td style="border-bottom:1px solid #eee;">${sp.pace}</td><td style="border-bottom:1px solid #eee;">${sp.elev}m</td></tr>`;
                        });
                        html += `</tbody></table>`;
                    }
                    sd.innerHTML = html;
                }
            }
        });
        
        // Carrega Comentários
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) return;
            s.forEach(c => {
                const v = c.val();
                list.innerHTML += `<div class="comment-item" style="border-bottom:1px solid #eee; padding:5px; font-size:0.9rem;">
                    <b>${v.name}:</b> ${v.text}
                </div>`;
            });
        });
        
        modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const btn = document.getElementById('save-feedback-btn');
        
        btn.disabled = true;
        btn.textContent = "Salvando...";

        try {
            // Upload Foto
            let imageUrl = null;
            const fileInput = document.getElementById('photo-upload-input');
            if (fileInput.files.length > 0) {
                document.getElementById('photo-upload-feedback').textContent = "Enviando imagem...";
                imageUrl = await AppPrincipal.uploadFileToCloudinary(fileInput.files[0], 'workouts');
            }

            const updates = { 
                status: document.getElementById('workout-status').value, 
                feedback: document.getElementById('workout-feedback-text').value,
                realizadoAt: new Date().toISOString()
            };
            if(imageUrl) updates.imageUrl = imageUrl;

            await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
            
            // Atualiza cópia pública se não for planejado
            if(updates.status !== 'planejado') {
                const fullSnap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
                const fullData = fullSnap.val();
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                    ownerId: currentOwnerId, 
                    ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || "Atleta", 
                    ...fullData
                });
            }
            
            document.getElementById('feedback-modal').classList.add('hidden');
        } catch(err) {
            alert("Erro ao salvar: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Salvar Feedback";
        }
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
            description: document.getElementById('log-activity-feedback').value,
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
        
        alert("Atividade registrada!");
        document.getElementById('log-activity-modal').classList.add('hidden');
    },

    // 6. GESTÃO DE PERFIL E FOTOS
    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        
        // Preenche dados atuais
        const u = AppPrincipal.state.userData;
        if(u) {
            document.getElementById('profile-name').value = u.name || "";
            document.getElementById('profile-bio').value = u.bio || "";
            document.getElementById('profile-pic-preview').src = u.photoUrl || "https://placehold.co/150";
        }

        // Renderiza Botão Strava
        const container = document.getElementById('strava-connection-area');
        container.innerHTML = "";
        
        const btn = document.createElement('button');
        btn.id = 'btn-strava-action'; 
        btn.type = 'button'; 
        btn.className = 'btn btn-secondary'; 
        btn.style.width = '100%';
        btn.style.marginTop = '15px';
        
        if (AppPrincipal.state.stravaTokenData) {
            btn.innerHTML = "<i class='bx bx-refresh'></i> Sincronizar Strava (Deep Sync)";
            btn.style.backgroundColor = "#fc4c02";
            btn.onclick = AppPrincipal.handleStravaSyncActivities;
            
            const status = document.createElement('p');
            status.id = "strava-sync-status";
            status.style.fontSize = "0.8rem"; 
            status.style.color = "#666";
            status.style.marginTop = "5px";
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
        
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({
            name: name,
            bio: bio
        });
        
        alert("Perfil atualizado com sucesso.");
        document.getElementById('profile-modal').classList.add('hidden');
    },
    
    // --- GEMINI VISION (IA LÊ FOTO) ---
    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        const feedback = document.getElementById('photo-upload-feedback');
        feedback.textContent = "Analisando imagem com IA...";
        
        try {
            // Converte para Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                
                // Prompt para Gemini
                const prompt = `Analise esta imagem de treino (relógio ou app). Extraia JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
                
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: file.type, data: base64 } }
                            ]
                        }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });
                
                const data = await response.json();
                const text = data.candidates[0].content.parts[0].text;
                const json = JSON.parse(text);
                
                // Preenche o modal automaticamente
                feedback.textContent = "Dados extraídos!";
                
                // Cria objeto simulando Strava Data para exibição
                AppPrincipal.state.modal.stravaDataTemp = json;
                
                const sd = document.getElementById('modal-strava-content');
                document.getElementById('modal-strava-data').classList.remove('hidden');
                sd.innerHTML = `<div><b>IA Vision:</b> ${json.distancia} | ${json.tempo} | ${json.ritmo}</div>`;
            };
        } catch (err) {
            console.error(err);
            feedback.textContent = "Falha na leitura da imagem.";
        }
    },

    // --- GEMINI TEXT (ANÁLISE DE PERFORMANCE) ---
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) throw new Error("Chave API do Gemini não configurada.");
        
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        if(r.status === 429) return "⚠️ Limite de uso da IA atingido. Tente novamente mais tarde.";
        
        const d = await r.json(); 
        return d.candidates[0].content.parts[0].text;
    },

    handleSaveIaAnalysis: async () => {
        if(!AppPrincipal.state.currentAnalysisData) return;
        const athleteId = AdminPanel.state.selectedAthleteId; // Dependência do AdminPanel
        
        await AppPrincipal.state.db.ref(`iaAnalysisHistory/${athleteId}`).push(AppPrincipal.state.currentAnalysisData);
        
        alert("Análise salva no histórico do atleta!");
        document.getElementById('ia-analysis-modal').classList.add('hidden');
    },

    // --- UPLOAD REAL (CLOUDINARY) ---
    uploadFileToCloudinary: async (file, folder) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `lerunners/${AppPrincipal.state.currentUser.uid}/${folder}`);
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { 
            method: 'POST', 
            body: formData 
        });
        
        if (!res.ok) throw new Error("Falha no upload da imagem");
        
        const data = await res.json();
        return data.secure_url;
    }
};

// 7. LÓGICA DE AUTENTICAÇÃO
const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const pass = document.getElementById('loginPassword').value;
            
            auth.signInWithEmailAndPassword(email, pass)
                .then(() => window.location.href = 'app.html')
                .catch(e => {
                    let msg = "Erro ao entrar.";
                    if(e.code === 'auth/wrong-password') msg = "Senha incorreta.";
                    if(e.code === 'auth/user-not-found') msg = "Usuário não encontrado.";
                    document.getElementById('login-error').textContent = msg;
                });
        });
    }
};

// Start
document.addEventListener('DOMContentLoaded', AppPrincipal.init);
