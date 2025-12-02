/* =================================================================== */
/* APP.JS V5.2 - MODO DE SEGURANÇA (ANTI-LOOP)
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
        adminUIDs: {},
        userCache: {},
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaData: null,
        stravaTokenData: null
    },

    elements: {},

    init: () => {
        console.log("Iniciando V5.2 (Safe Mode)...");
        
        if (typeof window.firebaseConfig === 'undefined') {
            document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px; color:red;'>Erro: config.js não carregado.</h2>";
            return;
        }

        try {
            if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig);
        } catch (e) { console.error(e); }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Se estivermos na tela de login
        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        } 
        // Se estivermos na plataforma
        else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        // Mapeamento seguro de elementos
        AppPrincipal.elements = {
            loader: document.getElementById('loader'),
            appContainer: document.getElementById('app-container'),
            userDisplay: document.getElementById('userDisplay'),
            logoutButton: document.getElementById('logoutButton'),
            mainContent: document.getElementById('app-main-content'),
            navPlanilhaBtn: document.getElementById('nav-planilha-btn'),
            navFeedBtn: document.getElementById('nav-feed-btn'),
            navProfileBtn: document.getElementById('nav-profile-btn'),
            // Modais e Forms
            feedbackModal: document.getElementById('feedback-modal'),
            feedbackForm: document.getElementById('feedback-form'),
            commentForm: document.getElementById('comment-form'),
            logActivityForm: document.getElementById('log-activity-form'),
            profileForm: document.getElementById('profile-form'),
            // Coach
            coachEvalBtn: document.getElementById('save-coach-eval-btn')
        };

        // Listeners básicos
        if(AppPrincipal.elements.logoutButton) AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        if(AppPrincipal.elements.navPlanilhaBtn) AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        if(AppPrincipal.elements.navFeedBtn) AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        if(AppPrincipal.elements.navProfileBtn) AppPrincipal.elements.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);

        // Fechar modais
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden');
        });

        // Formulários
        if(AppPrincipal.elements.feedbackForm) AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        if(AppPrincipal.elements.commentForm) AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        if(AppPrincipal.elements.logActivityForm) AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        if(AppPrincipal.elements.profileForm) AppPrincipal.elements.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        if(AppPrincipal.elements.coachEvalBtn) AppPrincipal.elements.coachEvalBtn.addEventListener('click', AppPrincipal.handleCoachEvaluationSubmit);

        // Uploads
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) photoInput.onchange = AppPrincipal.handlePhotoUpload;
        const profileInput = document.getElementById('profile-pic-upload');
        if(profileInput) profileInput.onchange = AppPrincipal.handleProfilePhotoUpload;

        // Strava URL Check
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code')) {
            AppPrincipal.elements.loader.classList.remove('hidden');
            // Espera auth para trocar código
        }

        // --- CORREÇÃO DO LOOP ---
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if (!user) {
                // NÃO REDIRECIONA AUTOMATICAMENTE PARA INDEX.HTML PARA EVITAR LOOP
                AppPrincipal.elements.loader.classList.add('hidden');
                document.body.innerHTML = `
                    <div style="text-align:center; margin-top:50px;">
                        <h2>Sessão Expirada ou Não Autenticado</h2>
                        <a href="index.html" style="background:#00008B; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Fazer Login</a>
                    </div>
                `;
                return;
            }

            // Usuário detectado, prossegue
            AppPrincipal.state.currentUser = user;
            
            if (urlParams.get('code')) {
                AppPrincipal.exchangeStravaCode(urlParams.get('code'));
                return;
            }

            AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        // Carrega caches sem travar UI
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        AppPrincipal.state.db.ref('admins').on('value', s => AppPrincipal.state.adminUIDs = s.val() || {});
        AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', s => AppPrincipal.state.stravaTokenData = s.val());

        // Verifica Admin
        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
            const isAdmin = (adminSnap.exists() && adminSnap.val() === true);
            
            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnap => {
                let data = userSnap.val();
                
                // Cria perfil se não existir (apenas admin)
                if (!data && isAdmin) {
                    data = { name: AppPrincipal.state.currentUser.email, role: 'admin' };
                    AppPrincipal.state.db.ref('users/' + uid).set(data);
                } else if (!data) {
                    // Se não é admin e não tem dados, logout
                    AppPrincipal.handleLogout();
                    return;
                }

                // Configura Estado
                AppPrincipal.state.userData = { ...data, uid: uid };
                AppPrincipal.elements.userDisplay.textContent = data.name || "Usuário";

                if (isAdmin) {
                    AppPrincipal.state.userData.role = 'admin';
                    AppPrincipal.state.viewMode = 'admin';
                    AppPrincipal.setupAdminToggle(true);
                } else {
                    AppPrincipal.state.viewMode = 'atleta';
                }

                AppPrincipal.updateViewClasses();
                AppPrincipal.navigateTo('planilha');
            });
        });
    },

    setupAdminToggle: (isAdmin) => {
        if (document.getElementById('admin-toggle-btn')) return;
        const nav = document.querySelector('.app-header nav');
        if (isAdmin && nav) {
            const btn = document.createElement('button');
            btn.id = 'admin-toggle-btn';
            btn.className = 'btn btn-nav';
            btn.innerHTML = "<i class='bx bx-run'></i> Modo Atleta";
            btn.style.cssText = "background:white; color:#00008B; border:1px solid #00008B; border-radius:20px; margin-right:10px;";
            btn.onclick = (e) => {
                e.preventDefault();
                if (AppPrincipal.state.viewMode === 'admin') {
                    AppPrincipal.state.viewMode = 'atleta';
                    btn.innerHTML = "<i class='bx bx-shield-quarter'></i> Modo Coach";
                    btn.style.background = "#00008B"; btn.style.color = "white";
                } else {
                    AppPrincipal.state.viewMode = 'admin';
                    btn.innerHTML = "<i class='bx bx-run'></i> Modo Atleta";
                    btn.style.background = "white"; btn.style.color = "#00008B";
                }
                AppPrincipal.updateViewClasses();
                AppPrincipal.navigateTo('planilha');
            };
            nav.insertBefore(btn, document.getElementById('logoutButton'));
        }
    },

    updateViewClasses: () => {
        const c = AppPrincipal.elements.appContainer;
        if (AppPrincipal.state.viewMode === 'admin') {
            c.classList.add('admin-view');
            c.classList.remove('atleta-view');
        } else {
            c.classList.add('atleta-view');
            c.classList.remove('admin-view');
        }
    },

    navigateTo: (page) => {
        const m = AppPrincipal.elements.mainContent;
        if(!m) return;
        m.innerHTML = "";
        AppPrincipal.cleanupListeners(true);
        AppPrincipal.state.currentView = page;

        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        if(page === 'planilha') document.getElementById('nav-planilha-btn')?.classList.add('active');
        if(page === 'feed') document.getElementById('nav-feed-btn')?.classList.add('active');

        if (page === 'planilha') {
            if (AppPrincipal.state.viewMode === 'admin') {
                m.appendChild(document.getElementById('admin-panel-template').content.cloneNode(true));
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                m.appendChild(document.getElementById('atleta-panel-template').content.cloneNode(true));
                const w = document.getElementById('atleta-welcome-name');
                if(w) w.textContent = AppPrincipal.state.userData.name;
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            m.appendChild(document.getElementById('feed-panel-template').content.cloneNode(true));
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        
        AppPrincipal.elements.loader.classList.add('hidden');
        AppPrincipal.elements.appContainer.classList.remove('hidden');
    },

    handleLogout: () => {
        AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html');
    },

    cleanupListeners: (panelOnly = false) => {
        Object.keys(AppPrincipal.state.listeners).forEach(k => {
            if (panelOnly && (k === 'cacheAdmins' || k === 'cacheUsers')) return;
            if (AppPrincipal.state.listeners[k]) AppPrincipal.state.listeners[k].off();
            delete AppPrincipal.state.listeners[k];
        });
    },

    // --- MODAIS ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        document.getElementById('feedback-modal-title').textContent = title || "Treino";
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        document.getElementById('coach-eval-text').value = '';
        document.getElementById('strava-data-display').classList.add('hidden');

        // Permissões
        const isOwner = AppPrincipal.state.currentUser.uid === ownerId;
        const isAdmin = AppPrincipal.state.userData.role === 'admin';
        const coachArea = document.getElementById('coach-evaluation-block');
        const saveBtn = document.getElementById('save-feedback-btn');

        if (isAdmin && !isOwner) {
            coachArea.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            document.getElementById('workout-feedback-text').disabled = true;
            document.getElementById('workout-status').disabled = true;
        } else {
            coachArea.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            document.getElementById('workout-feedback-text').disabled = false;
            document.getElementById('workout-status').disabled = false;
        }

        // Carrega Treino
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                document.getElementById('workout-status').value = d.status || 'planejado';
                document.getElementById('workout-feedback-text').value = d.feedback || '';
                if(d.coachEvaluation) document.getElementById('coach-eval-text').value = d.coachEvaluation;
                if(d.stravaData) AppPrincipal.displayStravaData(d.stravaData);
            }
        });

        // Carrega Comentários
        const ref = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners['comments'] = ref;
        ref.on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem comentários.</p>"; return; }
            s.forEach(c => {
                const v = c.val();
                const d = document.createElement('div');
                d.className = 'comment-item';
                d.innerHTML = `<strong>${v.name || 'User'}:</strong> ${v.text}`;
                list.appendChild(d);
            });
        });

        modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const status = document.getElementById('workout-status').value;
        const feedback = document.getElementById('workout-feedback-text').value;
        const file = document.getElementById('photo-upload-input').files[0];
        
        document.getElementById('save-feedback-btn').disabled = true;
        
        try {
            let imageUrl = null;
            if(file) imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'workouts');
            
            const updates = { status, feedback, realizadoAt: new Date().toISOString() };
            if(imageUrl) updates.imageUrl = imageUrl;
            if(AppPrincipal.state.stravaData) updates.stravaData = AppPrincipal.state.stravaData;

            await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
            
            // Publicar
            if(status !== 'planejado') {
                const snap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                    ownerId: currentOwnerId,
                    ownerName: AppPrincipal.state.userData.name,
                    ...snap.val()
                });
            } else {
                await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).remove();
            }
            document.getElementById('feedback-modal').classList.add('hidden');
        } catch(err) { alert("Erro: " + err.message); }
        document.getElementById('save-feedback-btn').disabled = false;
    },

    handleCoachEvaluationSubmit: async (e) => {
        e.preventDefault();
        const text = document.getElementById('coach-eval-text').value;
        await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.modal.currentOwnerId}/workouts/${AppPrincipal.state.modal.currentWorkoutId}`).update({
            coachEvaluation: text
        });
        alert("Avaliado!");
        document.getElementById('feedback-modal').classList.add('hidden');
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

    // --- UTILS ---
    handleStravaConnect: () => {
        const c = window.STRAVA_PUBLIC_CONFIG;
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${c.clientID}&response_type=code&redirect_uri=${c.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`;
    },
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ code })
        });
        if(res.ok) { window.history.replaceState({}, document.title, "app.html"); window.location.reload(); }
        else alert("Erro Strava");
    },
    handleStravaSyncActivities: async () => { alert("Sync iniciado."); },
    uploadFileToCloudinary: async (file, folder) => {
        const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
        return (await r.json()).secure_url;
    },
    displayStravaData: (d) => {
        const el = document.getElementById('strava-data-display');
        el.innerHTML = `<p><strong>Strava:</strong> ${d.distancia} | ${d.tempo}</p>`;
        el.classList.remove('hidden');
    },
    openProfileModal: () => {
        const m = document.getElementById('profile-modal');
        document.getElementById('profile-name').value = AppPrincipal.state.userData.name;
        // Botão Strava simples
        let s = m.querySelector('#strava-area');
        if(s) s.remove();
        s = document.createElement('div'); s.id = 'strava-area'; s.style.marginTop='20px';
        if(AppPrincipal.state.stravaTokenData) s.innerHTML = `<button onclick="AppPrincipal.handleStravaSyncActivities()" class="btn btn-primary">Sincronizar Strava</button>`;
        else s.innerHTML = `<button onclick="AppPrincipal.handleStravaConnect()" class="btn btn-secondary">Conectar Strava</button>`;
        m.querySelector('.modal-body').appendChild(s);
        m.classList.remove('hidden');
    },
    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name });
        AppPrincipal.state.userData.name = name;
        document.getElementById('profile-modal').classList.add('hidden');
        AppPrincipal.elements.userDisplay.textContent = name;
    },
    // Stubs
    handleProfilePhotoUpload: async () => {},
    handleLogActivitySubmit: async (e) => { 
        e.preventDefault();
        const data = {
            date: document.getElementById('log-activity-date').value,
            title: document.getElementById('log-activity-title').value,
            description: document.getElementById('log-activity-feedback').value,
            status: 'realizado', realizadoAt: new Date().toISOString(),
            createdBy: AppPrincipal.state.currentUser.uid
        };
        const ref = await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.currentUser.uid}/workouts`).push(data);
        await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({ ownerId: AppPrincipal.state.currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...data });
        document.getElementById('log-activity-modal').classList.add('hidden');
    },
    handleSaveIaAnalysis: async () => {},
    handlePhotoUpload: async () => {}
};

// Login
const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
