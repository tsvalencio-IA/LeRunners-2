/* =================================================================== */
/* ARQUIVO DE LÓGICA (V13.0 - IMPORTAÇÃO TOTAL 200)
/* =================================================================== */
const AppPrincipal = {
    state: { currentUser: null, userData: null, db: null, auth: null, listeners: {}, currentView: 'planilha', adminUIDs: {}, userCache: {}, modal: { isOpen: false }, stravaData: null, stravaTokenData: null },
    elements: {},
    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return;
        try { if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch (e) { return; }
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();
        if (document.getElementById('login-form')) AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db); 
        else if (document.getElementById('app-container')) { AppPrincipal.injectStravaLogic(); AppPrincipal.initPlatform(); }
    },
    injectStravaLogic: () => {
        AppPrincipal.initPlatformOriginal = AppPrincipal.initPlatform;
        AppPrincipal.initPlatform = () => {
            AppPrincipal.initPlatformOriginal();
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code) {
                AppPrincipal.elements.loader.classList.remove('hidden');
                AppPrincipal.elements.appContainer.classList.add('hidden');
                const unsub = AppPrincipal.state.auth.onAuthStateChanged(user => {
                    if (user && AppPrincipal.state.currentUser && user.uid === AppPrincipal.state.currentUser.uid) {
                        unsub(); AppPrincipal.exchangeStravaCode(code);
                    }
                });
            }
        };
    },
    initPlatform: () => {
        AppPrincipal.elements = {
            loader: document.getElementById('loader'), appContainer: document.getElementById('app-container'), userDisplay: document.getElementById('userDisplay'), logoutButton: document.getElementById('logoutButton'), mainContent: document.getElementById('app-main-content'), navPlanilhaBtn: document.getElementById('nav-planilha-btn'), navFeedBtn: document.getElementById('nav-feed-btn'), navProfileBtn: document.getElementById('nav-profile-btn'), feedbackModal: document.getElementById('feedback-modal'), closeFeedbackModal: document.getElementById('close-feedback-modal'), feedbackModalTitle: document.getElementById('feedback-modal-title'), feedbackForm: document.getElementById('feedback-form'), workoutStatusSelect: document.getElementById('workout-status'), workoutFeedbackText: document.getElementById('workout-feedback-text'), photoUploadInput: document.getElementById('photo-upload-input'), photoUploadFeedback: document.getElementById('photo-upload-feedback'), stravaDataDisplay: document.getElementById('strava-data-display'), saveFeedbackBtn: document.getElementById('save-feedback-btn'), commentForm: document.getElementById('comment-form'), commentInput: document.getElementById('comment-input'), commentsList: document.getElementById('comments-list'), logActivityModal: document.getElementById('log-activity-modal'), closeLogActivityModal: document.getElementById('close-log-activity-modal'), logActivityForm: document.getElementById('log-activity-form'), whoLikedModal: document.getElementById('who-liked-modal'), closeWhoLikedModal: document.getElementById('close-who-liked-modal'), whoLikedList: document.getElementById('who-liked-list'), iaAnalysisModal: document.getElementById('ia-analysis-modal'), closeIaAnalysisModal: document.getElementById('close-ia-analysis-modal'), iaAnalysisOutput: document.getElementById('ia-analysis-output'), saveIaAnalysisBtn: document.getElementById('save-ia-analysis-btn'), profileModal: document.getElementById('profile-modal'), closeProfileModal: document.getElementById('close-profile-modal'), profileForm: document.getElementById('profile-form'), profilePicPreview: document.getElementById('profile-pic-preview'), profilePicUpload: document.getElementById('profile-pic-upload'), profileUploadFeedback: document.getElementById('profile-upload-feedback'), profileName: document.getElementById('profile-name'), profileBio: document.getElementById('profile-bio'), saveProfileBtn: document.getElementById('save-profile-btn'), viewProfileModal: document.getElementById('view-profile-modal'), closeViewProfileModal: document.getElementById('close-view-profile-modal'), viewProfilePic: document.getElementById('view-profile-pic'), viewProfileName: document.getElementById('view-profile-name'), viewProfileBio: document.getElementById('view-profile-bio'),
        };
        AppPrincipal.elements.logoutButton.addEventListener('click', AppPrincipal.handleLogout);
        AppPrincipal.elements.navPlanilhaBtn.addEventListener('click', () => AppPrincipal.navigateTo('planilha'));
        AppPrincipal.elements.navFeedBtn.addEventListener('click', () => AppPrincipal.navigateTo('feed'));
        AppPrincipal.elements.closeFeedbackModal.addEventListener('click', AppPrincipal.closeFeedbackModal);
        AppPrincipal.elements.feedbackForm.addEventListener('submit', AppPrincipal.handleFeedbackSubmit);
        AppPrincipal.elements.commentForm.addEventListener('submit', AppPrincipal.handleCommentSubmit);
        AppPrincipal.elements.photoUploadInput.addEventListener('change', AppPrincipal.handlePhotoUpload);
        AppPrincipal.elements.closeLogActivityModal.addEventListener('click', AppPrincipal.closeLogActivityModal);
        AppPrincipal.elements.logActivityForm.addEventListener('submit', AppPrincipal.handleLogActivitySubmit);
        AppPrincipal.elements.closeWhoLikedModal.addEventListener('click', AppPrincipal.closeWhoLikedModal);
        AppPrincipal.elements.closeIaAnalysisModal.addEventListener('click', AppPrincipal.closeIaAnalysisModal);
        AppPrincipal.elements.saveIaAnalysisBtn.addEventListener('click', AppPrincipal.handleSaveIaAnalysis);
        AppPrincipal.elements.navProfileBtn.addEventListener('click', AppPrincipal.openProfileModal);
        AppPrincipal.elements.closeProfileModal.addEventListener('click', AppPrincipal.closeProfileModal);
        AppPrincipal.elements.profileForm.addEventListener('submit', AppPrincipal.handleProfileSubmit);
        AppPrincipal.elements.profilePicUpload.addEventListener('change', AppPrincipal.handleProfilePhotoUpload);
        AppPrincipal.elements.closeViewProfileModal.addEventListener('click', AppPrincipal.closeViewProfileModal);
        AppPrincipal.state.auth.onAuthStateChanged(AppPrincipal.handlePlatformAuthStateChange);
    },
    handlePlatformAuthStateChange: (user) => {
        if (!user) return window.location.href = 'index.html';
        AppPrincipal.state.currentUser = user;
        AppPrincipal.state.db.ref(`users/${user.uid}/stravaAuth`).on('value', s => AppPrincipal.state.stravaTokenData = s.val());
        AppPrincipal.state.db.ref('admins/' + user.uid).once('value', adminSnap => {
            const role = (adminSnap.exists() && adminSnap.val()) ? "admin" : "atleta";
            AppPrincipal.state.db.ref('users/' + user.uid).once('value', userSnap => {
                if (userSnap.exists()) {
                    AppPrincipal.state.userData = { ...userSnap.val(), uid: user.uid, role };
                    AppPrincipal.elements.userDisplay.textContent = AppPrincipal.state.userData.name;
                    AppPrincipal.elements.appContainer.className = role === 'admin' ? 'admin-view' : 'atleta-view';
                    AppPrincipal.navigateTo('planilha');
                } else if (role === 'admin') {
                    const p = { name: user.email, email: user.email, role: "admin", createdAt: new Date().toISOString() };
                    AppPrincipal.state.db.ref('users/' + user.uid).set(p);
                    AppPrincipal.state.userData = p;
                    AppPrincipal.elements.appContainer.className = 'admin-view';
                    AppPrincipal.navigateTo('planilha');
                } else { AppPrincipal.handleLogout(); }
            });
        });
    },
    navigateTo: (page) => {
        const { mainContent, loader, appContainer, navPlanilhaBtn, navFeedBtn } = AppPrincipal.elements;
        mainContent.innerHTML = ""; AppPrincipal.state.currentView = page;
        navPlanilhaBtn.classList.toggle('active', page === 'planilha'); navFeedBtn.classList.toggle('active', page === 'feed');
        if (page === 'planilha') {
            if (AppPrincipal.state.userData.role === 'admin') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            else {
                mainContent.appendChild(document.getElementById('atleta-panel-template').content.cloneNode(true));
                document.getElementById('atleta-welcome-name').textContent = AppPrincipal.state.userData.name;
                AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            }
        } else if (page === 'feed') {
            mainContent.appendChild(document.getElementById('feed-panel-template').content.cloneNode(true));
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        loader.classList.add('hidden'); appContainer.classList.remove('hidden');
    },
    handleLogout: () => { AppPrincipal.state.auth.signOut(); },
    openProfileModal: () => {
        const { profileModal, profileName, profileBio, profilePicPreview } = AppPrincipal.elements;
        const { userData, stravaTokenData } = AppPrincipal.state;
        profileName.value = userData.name || ''; profileBio.value = userData.bio || '';
        profilePicPreview.src = userData.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta';
        let stravaSection = document.getElementById('strava-connect-section');
        if (stravaSection) stravaSection.remove();
        stravaSection = document.createElement('div'); stravaSection.id = 'strava-connect-section';
        stravaSection.style.marginTop = "20px"; stravaSection.style.borderTop = "1px solid #eee"; stravaSection.style.paddingTop = "10px";
        if (stravaTokenData && stravaTokenData.accessToken) {
            stravaSection.innerHTML = `<fieldset style="border-color:green"><legend style="color:green"><i class='bx bxl-strava'></i> Strava</legend><p style="color:green; font-size:0.9rem;">Conectado.</p><button id="btn-sync-strava" class="btn btn-primary" style="background:#fc4c02;color:white;width:100%"><i class='bx bx-refresh'></i> Sincronizar (200)</button><p id="strava-sync-status"></p></fieldset>`;
        } else {
            stravaSection.innerHTML = `<fieldset><legend><i class='bx bxl-strava'></i> Integração</legend><button id="btn-connect-strava" class="btn btn-secondary" style="background:#fc4c02;color:white;width:100%"><i class='bx bxl-strava'></i> Conectar</button></fieldset>`;
        }
        profileModal.querySelector('.modal-body').appendChild(stravaSection);
        const btnConn = document.getElementById('btn-connect-strava'); if(btnConn) btnConn.onclick = AppPrincipal.handleStravaConnect;
        const btnSync = document.getElementById('btn-sync-strava'); if(btnSync) btnSync.onclick = AppPrincipal.handleStravaSyncActivities;
        profileModal.classList.remove('hidden');
    },
    closeProfileModal: () => AppPrincipal.elements.profileModal.classList.add('hidden'),
    handleProfileSubmit: async (e) => { 
        e.preventDefault();
        const updates = {};
        updates[`/users/${AppPrincipal.state.currentUser.uid}/name`] = AppPrincipal.elements.profileName.value;
        updates[`/users/${AppPrincipal.state.currentUser.uid}/bio`] = AppPrincipal.elements.profileBio.value;
        if (AppPrincipal.state.modal.newPhotoUrl) updates[`/users/${AppPrincipal.state.currentUser.uid}/photoUrl`] = AppPrincipal.state.modal.newPhotoUrl;
        await AppPrincipal.state.db.ref().update(updates);
        AppPrincipal.closeProfileModal();
        window.location.reload();
    },
    handleProfilePhotoUpload: async (e) => {
        const url = await AppPrincipal.uploadFileToCloudinary(e.target.files[0], 'profile');
        AppPrincipal.state.modal.newPhotoUrl = url;
        AppPrincipal.elements.profilePicPreview.src = url;
    },
    handleStravaConnect: () => {
        const c = window.STRAVA_PUBLIC_CONFIG;
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${c.clientID}&response_type=code&redirect_uri=${c.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`;
    },
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        const res = await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${token}`}, body:JSON.stringify({code}) });
        if(res.ok) { alert("Conectado!"); window.location.href = "app.html"; } else { alert("Erro ao conectar."); }
    },
    handleStravaSyncActivities: async () => {
        const btn = document.getElementById('btn-sync-strava'); const status = document.getElementById('strava-sync-status'); const uid = AppPrincipal.state.currentUser.uid;
        btn.disabled = true; status.textContent = "Buscando (200)...";
        try {
            const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=200`, { headers: { 'Authorization': `Bearer ${AppPrincipal.state.stravaTokenData.accessToken}` } });
            if (!res.ok) throw new Error("Erro Strava API");
            const activities = await res.json();
            const snap = await AppPrincipal.state.db.ref(`data/${uid}/workouts`).once('value');
            const existingStravaIds = []; const plannedMap = {};
            if (snap.exists()) { snap.forEach(child => { const w = child.val(); if (w.stravaActivityId) existingStravaIds.push(String(w.stravaActivityId)); if (w.status === 'planejado' && w.date) plannedMap[w.date] = { key: child.key, title: w.title, desc: w.description }; }); }
            const updates = {}; let countImport = 0;
            for (const activity of activities) {
                if (existingStravaIds.includes(String(activity.id))) continue;
                const date = activity.start_date.split('T')[0]; let key, title, descPrefix;
                if (plannedMap[date]) { key = plannedMap[date].key; title = plannedMap[date].title; descPrefix = plannedMap[date].desc + "\n\n[REALIZADO via Strava]: "; } 
                else { key = AppPrincipal.state.db.ref(`data/${uid}/workouts`).push().key; title = activity.name; descPrefix = "[Importado]: "; }
                const dist = (activity.distance/1000).toFixed(2) + " km";
                const time = new Date(activity.moving_time * 1000).toISOString().substr(11, 8);
                const pace = (activity.average_speed > 0 ? (60 / (activity.average_speed * 3.6)).toFixed(2) : "0") + " /km";
                const stravaData = { distancia: dist, tempo: time, ritmo: pace, elevacao: activity.total_elevation_gain + "m", mapLink: `https://www.strava.com/activities/${activity.id}` };
                const workoutData = { title: title, date: date, status: 'realizado', description: descPrefix + (activity.type === 'Run' ? 'Corrida' : activity.type), feedback: `Sincronizado. ${dist} em ${time}.`, stravaActivityId: String(activity.id), stravaData: stravaData, realizadoAt: new Date().toISOString() };
                updates[`/data/${uid}/workouts/${key}`] = workoutData; updates[`/publicWorkouts/${key}`] = { ...workoutData, ownerId: uid, ownerName: AppPrincipal.state.userData.name }; countImport++;
            }
            if (Object.keys(updates).length > 0) { await AppPrincipal.state.db.ref().update(updates); alert(`${countImport} novos!`); AppPrincipal.closeProfileModal(); } else { alert("Atualizado."); }
        } catch (err) { alert("Erro: " + err.message); } finally { btn.disabled = false; status.textContent = ""; }
    },
    openFeedbackModal: (wid, oid, title) => {
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: wid, currentOwnerId: oid };
        const { feedbackModal, feedbackModalTitle, workoutStatusSelect, workoutFeedbackText, commentsList } = AppPrincipal.elements;
        feedbackModalTitle.textContent = title; workoutStatusSelect.value = 'planejado'; workoutFeedbackText.value = ''; commentsList.innerHTML = "Carregando..."; feedbackModal.classList.remove('hidden');
        AppPrincipal.state.db.ref(`data/${oid}/workouts/${wid}`).once('value', s => { if(s.exists()) { workoutStatusSelect.value = s.val().status || 'planejado'; workoutFeedbackText.value = s.val().feedback || ''; if(s.val().stravaData) AppPrincipal.displayStravaData(s.val().stravaData); } });
        AppPrincipal.state.db.ref(`workoutComments/${wid}`).on('value', s => { commentsList.innerHTML = ""; s.forEach(c => commentsList.innerHTML += `<div class="comment-item"><b>${AppPrincipal.state.userCache[c.val().uid]?.name || 'User'}:</b> ${c.val().text}</div>`); });
    },
    closeFeedbackModal: () => AppPrincipal.elements.feedbackModal.classList.add('hidden'),
    handleFeedbackSubmit: async (e) => { 
        e.preventDefault(); const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const updates = {}; const data = { status: AppPrincipal.elements.workoutStatusSelect.value, feedback: AppPrincipal.elements.workoutFeedbackText.value, realizadoAt: new Date().toISOString() };
        updates[`/data/${currentOwnerId}/workouts/${currentWorkoutId}/status`] = data.status; updates[`/data/${currentOwnerId}/workouts/${currentWorkoutId}/feedback`] = data.feedback;
        updates[`/publicWorkouts/${currentWorkoutId}/status`] = data.status; updates[`/publicWorkouts/${currentWorkoutId}/feedback`] = data.feedback;
        await AppPrincipal.state.db.ref().update(updates); AppPrincipal.closeFeedbackModal();
    },
    handleCommentSubmit: (e) => {
        e.preventDefault(); if(!AppPrincipal.elements.commentInput.value) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({ uid: AppPrincipal.state.currentUser.uid, text: AppPrincipal.elements.commentInput.value, timestamp: Date.now() });
        AppPrincipal.elements.commentInput.value = "";
    },
    displayStravaData: (d) => { document.getElementById('strava-data-display').innerHTML = `<p>Dist: ${d.distancia}</p><p>Tempo: ${d.tempo}</p><p>Pace: ${d.ritmo}</p>`; document.getElementById('strava-data-display').classList.remove('hidden'); },
    uploadFileToCloudinary: async (file, folder) => {
        const f = new FormData(); f.append('file', file); f.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); f.append('folder', `lerunners/${AppPrincipal.state.currentUser.uid}/${folder}`);
        const r = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: f }); const d = await r.json(); return d.secure_url;
    },
    openLogActivityModal: () => { AppPrincipal.elements.logActivityModal.classList.remove('hidden'); },
    closeLogActivityModal: () => AppPrincipal.elements.logActivityModal.classList.add('hidden'),
    handleLogActivitySubmit: async (e) => { 
        e.preventDefault(); 
        const workoutData = { date: document.getElementById('log-activity-date').value, title: document.getElementById('log-activity-title').value, description: `(${document.getElementById('log-activity-type').value})`, feedback: document.getElementById('log-activity-feedback').value, createdBy: AppPrincipal.state.currentUser.uid, createdAt: new Date().toISOString(), status: "realizado", realizadoAt: new Date().toISOString() };
        const ref = await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.currentUser.uid}/workouts`).push(workoutData);
        await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({ ownerId: AppPrincipal.state.currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...workoutData });
        AppPrincipal.closeLogActivityModal(); 
    },
    openWhoLikedModal: (id) => { AppPrincipal.elements.whoLikedModal.classList.remove('hidden'); },
    closeWhoLikedModal: () => AppPrincipal.elements.whoLikedModal.classList.add('hidden'),
    openIaAnalysisModal: (data) => { const { iaAnalysisModal, iaAnalysisOutput, saveIaAnalysisBtn } = AppPrincipal.elements; iaAnalysisModal.classList.remove('hidden'); if (data) { iaAnalysisOutput.textContent = data.analysisResult; saveIaAnalysisBtn.classList.add('hidden'); } else { iaAnalysisOutput.textContent = "Coletando dados..."; saveIaAnalysisBtn.classList.add('hidden'); AppPrincipal.state.currentAnalysisData = null; } },
    closeIaAnalysisModal: () => AppPrincipal.elements.iaAnalysisModal.classList.add('hidden'),
    handleSaveIaAnalysis: async () => { if(!AppPrincipal.state.currentAnalysisData) return; const athleteId = AdminPanel.state.selectedAthleteId; await AppPrincipal.state.db.ref(`iaAnalysisHistory/${athleteId}`).push(AppPrincipal.state.currentAnalysisData); alert("Salvo!"); AppPrincipal.closeIaAnalysisModal(); },
    fileToBase64: (file) => new Promise((r, j) => { const reader = new FileReader(); reader.onload = () => r(reader.result.split(',')[1]); reader.onerror = j; reader.readAsDataURL(file); }),
    callGeminiTextAPI: async (prompt) => { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); const d = await r.json(); return d.candidates[0].content.parts[0].text; },
    callGeminiVisionAPI: async (prompt, base64, mime) => { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data: base64 } }] }], generationConfig: { responseMimeType: "application/json" } }) }); const d = await r.json(); return d.candidates[0].content.parts[0].text; },
    handlePhotoUpload: async (e) => { const file = e.target.files[0]; if (!file) return; AppPrincipal.elements.photoUploadFeedback.textContent = "Analisando..."; try { const base64 = await AppPrincipal.fileToBase64(file); const prompt = `Analise a imagem. Retorne JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`; const json = await AppPrincipal.callGeminiVisionAPI(prompt, base64, file.type); const data = JSON.parse(json); AppPrincipal.state.stravaData = data; AppPrincipal.displayStravaData(data); AppPrincipal.elements.photoUploadFeedback.textContent = "Dados extraídos!"; } catch (err) { console.error(err); AppPrincipal.elements.photoUploadFeedback.textContent = "Falha na leitura IA."; } },
    openViewProfileModal: (uid) => { const u = AppPrincipal.state.userCache[uid]; if(!u) return; AppPrincipal.elements.viewProfilePic.src = u.photoUrl || 'https://placehold.co/150x150/4169E1/FFFFFF?text=Atleta'; AppPrincipal.elements.viewProfileName.textContent = u.name; AppPrincipal.elements.viewProfileBio.textContent = u.bio || "Sem bio."; AppPrincipal.elements.viewProfileModal.classList.remove('hidden'); },
    closeViewProfileModal: () => AppPrincipal.elements.viewProfileModal.classList.add('hidden')
};
const AuthLogic = {
    auth: null, db: null, elements: {},
    init: (auth, db) => {
        AuthLogic.auth = auth; AuthLogic.db = db;
        document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); });
        document.getElementById('toggleToRegister').onclick = () => { document.getElementById('login-form').classList.add('hidden'); document.getElementById('register-form').classList.remove('hidden'); };
        document.getElementById('toggleToLogin').onclick = () => { document.getElementById('register-form').classList.add('hidden'); document.getElementById('login-form').classList.remove('hidden'); };
        auth.onAuthStateChanged(u => { if(u) window.location.href = 'app.html'; else document.getElementById('login-form').classList.remove('hidden'); });
    }
};
document.addEventListener('DOMContentLoaded', AppPrincipal.init);