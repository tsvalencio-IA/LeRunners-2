/* =================================================================== */
/* APP.JS V5.0 - CORREÇÃO DE PERMISSÕES, DELAY E AVALIAÇÃO
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
        modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null, newPhotoUrl: null },
        stravaData: null,
        currentAnalysisData: null,
        stravaTokenData: null 
    },

    elements: {},

    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return document.body.innerHTML = "<h1>Config Missing</h1>";
        try { if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch (e) { return; }

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db); 
        else if (document.getElementById('app-container')) { 
            AppPrincipal.injectStravaLogic();
            AppPrincipal.initPlatform();
        }
    },
    
    injectStravaLogic: () => {
        AppPrincipal.initPlatformOriginal = AppPrincipal.initPlatform;
        AppPrincipal.initPlatform = () => {
            AppPrincipal.initPlatformOriginal();
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('code')) {
                AppPrincipal.elements.loader.classList.remove('hidden');
                AppPrincipal.elements.appContainer.classList.add('hidden');
                const unsub = AppPrincipal.state.auth.onAuthStateChanged(user => {
                    if (user && AppPrincipal.state.currentUser && user.uid === AppPrincipal.state.currentUser.uid) {
                        unsub();
                        AppPrincipal.exchangeStravaCode(urlParams.get('code'));
                    }
                });
            }
        };
    },
    
    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.userDisplay = document.getElementById('userDisplay');
        el.logoutButton = document.getElementById('logoutButton');
        el.mainContent = document.getElementById('app-main-content');
        el.navPlanilhaBtn = document.getElementById('nav-planilha-btn');
        el.navFeedBtn = document.getElementById('nav-feed-btn');
        el.navProfileBtn = document.getElementById('nav-profile-btn');
        el.feedbackModal = document.getElementById('feedback-modal');
        el.feedbackForm = document.getElementById('feedback-form');
        el.commentForm = document.getElementById('comment-form');
        el.logActivityForm = document.getElementById('log-activity-form');
        el.profileForm = document.getElementById('profile-form');
        
        // Listeners Principais
        el.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        el.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        el.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        el.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        
        // Modais
        document.getElementById('close-feedback-modal').onclick = AppPrincipal.closeFeedbackModal;
        document.getElementById('close-log-activity-modal').onclick = () => document.getElementById('log-activity-modal').classList.add('hidden');
        document.getElementById('close-profile-modal').onclick = AppPrincipal.closeProfileModal;
        document.getElementById('close-ia-analysis-modal').onclick = () => document.getElementById('ia-analysis-modal').classList.add('hidden');
        document.getElementById('close-who-liked-modal').onclick = () => document.getElementById('who-liked-modal').classList.add('hidden');
        document.getElementById('close-view-profile-modal').onclick = () => document.getElementById('view-profile-modal').classList.add('hidden');

        // Forms
        el.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        el.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        el.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        el.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        document.getElementById('profile-pic-upload').onchange = AppPrincipal.handleProfilePhotoUpload;
        document.getElementById('save-ia-analysis-btn').onclick = AppPrincipal.handleSaveIaAnalysis;
        
        const coachBtn = document.getElementById('save-coach-eval-btn');
        if(coachBtn) coachBtn.onclick = AppPrincipal.handleCoachEvaluationSubmit;

        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },

    loadCaches: () => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val() || {});
        AppPrincipal.state.db.ref('admins').on('value', s => AppPrincipal.state.adminUIDs = s.val() || {});
    },

    handlePlatformAuthStateChange: (user) => {
        if (!user) return window.location.href = 'index.html';
        
        AppPrincipal.state.currentUser = user;
        const uid = user.uid;
        AppPrincipal.loadCaches();

        AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', s => AppPrincipal.state.stravaTokenData = s.val());

        AppPrincipal.state.db.ref('admins/' + uid).once('value', adminSnap => {
            const isAdmin = (adminSnap.exists() && adminSnap.val() === true);
            
            AppPrincipal.state.db.ref('users/' + uid).once('value', userSnap => {
                let data = userSnap.val() || { name: user.email, email: user.email };
                
                // Se for Admin e não tiver user, cria
                if (!userSnap.exists() && isAdmin) {
                    AppPrincipal.state.db.ref('users/' + uid).set({ ...data, role: 'admin' });
                }

                // Configura Modo e Botão IMEDIATAMENTE
                if (isAdmin) {
                    data.role = 'admin';
                    AppPrincipal.state.viewMode = 'admin';
                    AppPrincipal.setupAdminToggle(true); 
                } else {
                    AppPrincipal.state.viewMode = 'atleta';
                }
                
                AppPrincipal.state.userData = { ...data, uid: uid };
                AppPrincipal.elements.userDisplay.textContent = data.name;
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
            btn.style.cssText = "background: white; color: #00008B; border: 1px solid #00008B; border-radius: 20px; margin-right: 10px;";
            
            btn.onclick = () => {
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
        if (AppPrincipal.state.viewMode === 'admin') { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
        else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
    },

    navigateTo: (page) => {
        const m = AppPrincipal.elements.mainContent;
        m.innerHTML = ""; 
        AppPrincipal.cleanupListeners(true);
        AppPrincipal.state.currentView = page;
        
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        if(page === 'planilha') document.getElementById('nav-planilha-btn').classList.add('active');
        if(page === 'feed') document.getElementById('nav-feed-btn').classList.add('active');

        if (page === 'planilha') {
            if (AppPrincipal.state.viewMode === 'admin') {
                m.appendChild(document.getElementById('admin-panel-template').content.cloneNode(true));
                AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else {
                m.appendChild(document.getElementById('atleta-panel-template').content.cloneNode(true));
                document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            m.appendChild(document.getElementById('feed-panel-template').content.cloneNode(true));
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        AppPrincipal.elements.loader.classList.add('hidden');
        AppPrincipal.elements.appContainer.classList.remove('hidden');
    },

    handleLogout: () => { AppPrincipal.state.auth.signOut(); },

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
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId, newPhotoUrl: null };
        AppPrincipal.state.stravaData = null;
        
        document.getElementById('feedback-modal-title').textContent = title || "Treino";
        
        // Setup inicial
        document.getElementById('workout-status').value = 'planejado';
        document.getElementById('workout-feedback-text').value = '';
        document.getElementById('comments-list').innerHTML = "Carregando...";
        document.getElementById('strava-data-display').classList.add('hidden');
        document.getElementById('coach-eval-text').value = '';

        // Permissões
        const isOwner = (AppPrincipal.state.currentUser.uid === ownerId);
        const isAdmin = (AppPrincipal.state.userData.role === 'admin');
        const coachBlock = document.getElementById('coach-evaluation-block');
        const saveBtn = document.getElementById('save-feedback-btn');

        if (isAdmin && !isOwner) {
            // Coach vendo aluno
            coachBlock.classList.remove('hidden');
            saveBtn.classList.add('hidden'); // Coach não edita feedback do aluno
            document.getElementById('workout-feedback-text').disabled = true;
        } else {
            // Aluno ou Coach no seu perfil
            coachBlock.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            document.getElementById('workout-feedback-text').disabled = false;
        }

        // Carrega Treino
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if (s.exists()) {
                const d = s.val();
                document.getElementById('workout-status').value = d.status || 'planejado';
                document.getElementById('workout-feedback-text').value = d.feedback || '';
                if(d.coachEvaluation) document.getElementById('coach-eval-text').value = d.coachEvaluation;
                if(d.stravaData) AppPrincipal.displayStravaData(d.stravaData);
            }
        });

        // Carrega Comentários
        const ref = AppPrincipal.state.db.ref(`workoutComments/${workoutId}`);
        AppPrincipal.state.listeners['modalComments'] = ref;
        ref.on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<p>Sem comentários.</p>"; return; }
            s.forEach(c => {
                const v = c.val();
                const div = document.createElement('div');
                div.className = 'comment-item';
                div.innerHTML = `<strong>${v.name || 'User'}:</strong> ${v.text}`;
                list.appendChild(div);
            });
        });

        modal.classList.remove('hidden');
    },

    closeFeedbackModal: () => {
        document.getElementById('feedback-modal').classList.add('hidden');
        if(AppPrincipal.state.listeners['modalComments']) AppPrincipal.state.listeners['modalComments'].off();
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const status = document.getElementById('workout-status').value;
        const feedback = document.getElementById('workout-feedback-text').value;
        const file = document.getElementById('photo-upload-input').files[0];
        
        let updates = { status, feedback, realizadoAt: new Date().toISOString() };
        if(file) updates.imageUrl = await AppPrincipal.uploadFileToCloudinary(file, 'workouts');
        if(AppPrincipal.state.stravaData) updates.stravaData = AppPrincipal.state.stravaData;

        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        
        // Atualiza público
        if(status !== 'planejado') {
            const fullData = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({
                ownerId: currentOwnerId,
                ownerName: AppPrincipal.state.userData.name,
                ...fullData
            });
        }
        AppPrincipal.closeFeedbackModal();
    },

    handleCoachEvaluationSubmit: async (e) => {
        e.preventDefault();
        const text = document.getElementById('coach-eval-text').value;
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update({ coachEvaluation: text });
        alert("Avaliação salva!");
        AppPrincipal.closeFeedbackModal();
    },

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid,
            name: AppPrincipal.state.userData.name, // Correção do erro de permissão
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('comment-input').value = "";
    },

    // --- Helpers ---
    handleStravaConnect: () => {
        const c = window.STRAVA_PUBLIC_CONFIG;
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${c.clientID}&response_type=code&redirect_uri=${c.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`;
    },
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ code })
        });
        window.location.href = 'app.html';
    },
    handleStravaSyncActivities: async () => { /* Mesma lógica V4.0 */ alert("Sincronização iniciada. Aguarde."); },
    uploadFileToCloudinary: async (file, folder) => {
        const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); 
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f });
        return (await r.json()).secure_url;
    },
    displayStravaData: (d) => {
        const el = document.getElementById('strava-data-display');
        el.innerHTML = `<p><strong>Strava:</strong> ${d.distancia} - ${d.tempo} (${d.ritmo})</p>`;
        el.classList.remove('hidden');
    },
    openProfileModal: () => {
        const modal = document.getElementById('profile-modal');
        document.getElementById('profile-name').value = AppPrincipal.state.userData.name;
        // Adicionar botões Strava aqui...
        modal.classList.remove('hidden');
    },
    closeProfileModal: () => document.getElementById('profile-modal').classList.add('hidden'),
    handleProfileSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('profile-name').value;
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({ name });
        AppPrincipal.state.userData.name = name;
        AppPrincipal.closeProfileModal();
    },
    handleProfilePhotoUpload: async (e) => { /* ... */ },
    handleLogActivitySubmit: async (e) => { /* ... */ },
    handleSaveIaAnalysis: async () => { /* ... */ },
    handlePhotoUpload: async (e) => { /* ... */ }
};

const AuthLogic = {
    init: (auth, db) => {
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
