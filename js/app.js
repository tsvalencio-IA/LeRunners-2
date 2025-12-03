/* =================================================================== */
/* APP.JS - VERSÃO 2 ORIGINAL + MODO PROFESSOR-ATLETA (FINAL)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null,
        userData: null,
        db: null,
        auth: null,
        listeners: {},
        currentView: 'planilha',
        viewMode: 'admin', // Controla a visão do Coach
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaTokenData: null
    },
    elements: {},

    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return;
        try { 
            if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); 
        } catch (e) {
            console.error("Erro Firebase:", e);
        }
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

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

        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;

        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));

        if (document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if (document.getElementById('comment-form')) document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        if (document.getElementById('profile-form')) document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        
        // Listener para Upload de Foto (Perfil e Treino)
        const photoInput = document.getElementById('photo-upload-input');
        if (photoInput) photoInput.onchange = AppPrincipal.handlePhotoUpload;
        
        if (document.getElementById('log-activity-form')) document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;

        const urlParams = new URLSearchParams(window.location.search);

        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if (!user) { window.location.href = 'index.html'; return; }
            AppPrincipal.state.currentUser = user;
            if (urlParams.get('code')) { AppPrincipal.exchangeStravaCode(urlParams.get('code')); return; }
            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        AppPrincipal.state.db.ref('users/' + uid).once('value', s => {
            let data = s.val();
            AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
                const isAdmin = adminSnap.exists() && adminSnap.val() === true;
                
                // Cria perfil de admin se não existir
                if (!data && isAdmin) { 
                    data = { name: AppPrincipal.state.currentUser.email, role: 'admin' }; 
                    AppPrincipal.state.db.ref('users/' + uid).set(data); 
                }
                
                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;

                    // --- MODO PROFESSOR-ATLETA (TOGGLE) ---
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin';
                        const nav = document.querySelector('.app-header nav');
                        
                        // Evita criar botões duplicados
                        if(!document.getElementById('admin-toggle')) {
                            const btn = document.createElement('button');
                            btn.id = 'admin-toggle'; 
                            btn.className = 'btn btn-nav'; 
                            btn.innerHTML = "Modo Atleta"; 
                            btn.style.border = "1px solid white";
                            btn.style.marginLeft = "10px";
                            
                            btn.onclick = () => {
                                if (AppPrincipal.state.viewMode === 'admin') {
                                    AppPrincipal.state.viewMode = 'atleta';
                                    btn.innerHTML = "Modo Coach";
                                    document.getElementById('app-container').classList.add('atleta-view');
                                    document.getElementById('app-container').classList.remove('admin-view');
                                } else {
                                    AppPrincipal.state.viewMode = 'admin';
                                    btn.innerHTML = "Modo Atleta";
                                    document.getElementById('app-container').classList.add('admin-view');
                                    document.getElementById('app-container').classList.remove('atleta-view');
                                }
                                AppPrincipal.navigateTo('planilha');
                            };
                            
                            const logoutBtn = document.getElementById('logoutButton');
                            nav.insertBefore(btn, logoutBtn);
                        }
                    }

                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    
                    const container = document.getElementById('app-container');
                    if(isAdmin) container.classList.add('admin-view');
                    else container.classList.add('atleta-view');

                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        mainContent.innerHTML = "";

        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); 
        if (btn) btn.classList.add('active');

        // Limpeza de Listeners (Segurança)
        if(window.panels && window.panels.cleanup) window.panels.cleanup();

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

            if (page === 'planilha') {
                if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') {
                    if(window.AdminPanel) AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                } else {
                    if(window.AtletaPanel) AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                }
            } else if (page === 'feed') {
                if(window.FeedPanel) FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        }

        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // --- STRAVA (Lógica V2) ---
    handleStravaConnect: () => { 
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; 
    },

    exchangeStravaCode: async (code) => {
        try {
            const token = await AppPrincipal.state.currentUser.getIdToken();
            await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify({ code }) 
            });
            window.history.replaceState({}, document.title, "app.html"); 
            window.location.reload();
        } catch (e) {
            alert("Erro ao conectar Strava: " + e.message);
        }
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        
        const btn = document.getElementById('btn-strava-action');
        if(btn) { 
            btn.disabled = true; 
            btn.textContent = "Sincronizando..."; 
        }

        try {
            const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, { 
                headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } 
            });
            
            if (!response.ok) throw new Error("Erro na API do Strava");
            
            const activities = await response.json();
            const existingSnap = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).once('value');
            const existingWorkouts = existingSnap.val() || {};
            const updates = {};
            let count = 0;

            activities.forEach(act => {
                let alreadyExists = false;
                for (const key in existingWorkouts) {
                    if (String(existingWorkouts[key].stravaActivityId) === String(act.id)) {
                        alreadyExists = true;
                        break;
                    }
                }

                if (!alreadyExists) {
                    const newKey = AppPrincipal.state.db.ref().push().key;
                    
                    // Tratamento seguro de dados
                    const distKm = (act.distance / 1000).toFixed(2) + " km";
                    const tempoStr = new Date(act.moving_time * 1000).toISOString().substr(11, 8);
                    
                    const workoutData = {
                        title: act.name,
                        date: act.start_date.split('T')[0],
                        description: `[Importado]: ${act.type}`,
                        status: 'realizado',
                        realizadoAt: new Date().toISOString(),
                        feedback: "Treino importado do Strava.",
                        stravaActivityId: act.id,
                        stravaData: {
                            distancia: distKm,
                            tempo: tempoStr,
                            ritmo: "N/A"
                        },
                        createdBy: currentUser.uid
                    };
                    
                    updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                    updates[`/publicWorkouts/${newKey}`] = { 
                        ownerId: currentUser.uid, 
                        ownerName: AppPrincipal.state.userData.name, 
                        ...workoutData 
                    };
                    count++;
                }
            });

            if (Object.keys(updates).length > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                alert(`Sincronização realizada. ${count} novas atividades.`);
            } else {
                alert("Tudo atualizado. Nenhuma nova atividade encontrada.");
            }
            
            document.getElementById('profile-modal').classList.add('hidden');

        } catch (e) {
            console.error(e);
            alert("Erro na sincronização: " + e.message);
        } finally {
            if(btn) { 
                btn.disabled = false; 
                btn.textContent = "Sincronizar Strava"; 
            }
        }
    },

    // --- MODAIS ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        document.getElementById('feedback-modal-title').textContent = title;
        
        // Reset
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        document.getElementById('photo-upload-feedback').textContent = "";

        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
                if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
            }
        });

        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) return;
            s.forEach(c => {
                const v = c.val();
                list.innerHTML += `<div class="comment-item"><b>${v.name}:</b> ${v.text}</div>`;
            });
        });

        modal.classList.remove('hidden');
    },
    
    handleFeedbackSubmit: async (e) => { 
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const btn = document.getElementById('save-feedback-btn');
        btn.textContent = "Salvando...";
        btn.disabled = true;

        try {
            let imageUrl = null;
            const fileInput = document.getElementById('photo-upload-input');
            
            // Upload se houver arquivo
            if (fileInput.files.length > 0) {
                document.getElementById('photo-upload-feedback').textContent = "Enviando imagem...";
                imageUrl = await AppPrincipal.uploadFileToCloudinary(fileInput.files[0], 'workouts');
            }

            const updates = { 
                status: document.getElementById('workout-status').value, 
                feedback: document.getElementById('workout-feedback-text').value,
                realizadoAt: new Date().toISOString()
            };
            
            if (imageUrl) updates.imageUrl = imageUrl;

            await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
            
            // Atualiza publico
            const fullSnap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
            if(updates.status !== 'planejado') {
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ 
                    ownerId: currentOwnerId, 
                    ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name, 
                    ...fullSnap.val() 
                });
            }
            
            document.getElementById('feedback-modal').classList.add('hidden');
        } catch (err) {
            alert("Erro ao salvar: " + err.message);
        } finally {
            btn.textContent = "Salvar Feedback";
            btn.disabled = false;
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
        
        const newRef = AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).push();
        newRef.set(data).then(() => {
            AppPrincipal.state.db.ref(`publicWorkouts/${newRef.key}`).set({
                ownerId: currentUser.uid,
                ownerName: AppPrincipal.state.userData.name,
                ...data
            });
            document.getElementById('log-activity-modal').classList.add('hidden');
        });
    },
    
    // --- PERFIL E FOTOS ---
    openProfileModal: () => {
        document.getElementById('profile-modal').classList.remove('hidden');
        const u = AppPrincipal.state.userData;
        if (u) {
            document.getElementById('profile-name').value = u.name || "";
            document.getElementById('profile-bio').value = u.bio || "";
            document.getElementById('profile-pic-preview').src = u.photoUrl || "https://placehold.co/150";
        }
        
        // Área Strava
        const container = document.getElementById('strava-connection-area');
        if (container) {
            container.innerHTML = "";
            const btn = document.createElement('button'); 
            btn.className = 'btn btn-secondary'; 
            btn.style.width = '100%';
            btn.style.marginTop = '10px';
            
            if (AppPrincipal.state.stravaTokenData) {
                btn.innerHTML = "Sincronizar Strava"; 
                btn.onclick = AppPrincipal.handleStravaSyncActivities;
            } else {
                btn.innerHTML = "Conectar Strava"; 
                btn.onclick = AppPrincipal.handleStravaConnect;
            }
            container.appendChild(btn);
        }
    },

    handleProfileSubmit: async (e) => {
        e.preventDefault();
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ 
            name: document.getElementById('profile-name').value, 
            bio: document.getElementById('profile-bio').value 
        });
        document.getElementById('profile-modal').classList.add('hidden');
    },

    // FUNÇÃO DE UPLOAD COMPLETA
    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        const feedback = document.getElementById('photo-upload-feedback');
        if (feedback) feedback.textContent = "Enviando imagem...";
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset);
        
        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { 
                method: 'POST', 
                body: formData 
            });
            const data = await res.json();
            
            // Se for upload de PERFIL
            if (e.target.id === 'profile-pic-upload') {
                await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ photoUrl: data.secure_url });
                document.getElementById('profile-pic-preview').src = data.secure_url;
                if(feedback) feedback.textContent = "Foto de perfil atualizada!";
            } 
            // Se for upload de TREINO (Modal aberto)
            else if (AppPrincipal.state.modal.isOpen) {
                const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
                await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update({ imageUrl: data.secure_url });
                if(feedback) feedback.textContent = "Foto salva no treino!";
            }
        } catch(err) {
            console.error(err);
            if(feedback) feedback.textContent = "Erro no upload.";
        }
    },

    // Upload Helper
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

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
