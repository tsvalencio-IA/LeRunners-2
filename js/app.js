/* =================================================================== */
/* APP.JS (RESTAURADO BASE V2 + DEEP SYNC CORRIGIDO)
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null, userData: null, db: null, auth: null,
        listeners: {}, currentView: 'planilha', viewMode: 'admin',
        adminUIDs: {}, userCache: {}, modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaTokenData: null
    },
    elements: {},

    init: () => {
        if(typeof window.firebaseConfig === 'undefined') return;
        try { if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        if (document.getElementById('login-form')) AuthLogic.init(AppPrincipal.state.auth, AppPrincipal.state.db);
        else if (document.getElementById('app-container')) AppPrincipal.initPlatform();
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        
        document.getElementById('logoutButton').onclick = AppPrincipal.handleLogout;
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms
        if(document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if(document.getElementById('comment-form')) document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        if(document.getElementById('log-activity-form')) document.getElementById('log-activity-form').onsubmit = AppPrincipal.handleLogActivitySubmit;
        if(document.getElementById('profile-form')) document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        if(document.getElementById('photo-upload-input')) document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        
        const btnEval = document.getElementById('save-coach-eval-btn');
        if(btnEval) btnEval.onclick = AppPrincipal.handleCoachEvaluationSubmit;

        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) { if(el.loader) el.loader.classList.add('hidden'); window.location.href = 'index.html'; return; }
            if(AppPrincipal.state.currentUser && AppPrincipal.state.currentUser.uid === user.uid) return;
            
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
                if (!data && isAdmin) { data = { name: AppPrincipal.state.currentUser.email, role: 'admin' }; AppPrincipal.state.db.ref('users/' + uid).set(data); }
                if (data) {
                    AppPrincipal.state.userData = { ...data, uid: uid };
                    document.getElementById('userDisplay').textContent = data.name;
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; AppPrincipal.state.viewMode = 'admin';
                        AppPrincipal.setupAdminToggle();
                    } else {
                        AppPrincipal.state.viewMode = 'atleta';
                    }
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    AppPrincipal.updateViewClasses();
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    setupAdminToggle: () => {
        if(document.getElementById('admin-toggle-btn')) return;
        const nav = document.querySelector('.app-header nav');
        const btn = document.createElement('button');
        btn.id = 'admin-toggle-btn'; btn.className = 'btn btn-nav';
        btn.innerHTML = "<i class='bx bx-run'></i> Modo Atleta";
        btn.style.cssText = "background:white; color:#00008B; border:1px solid #00008B; border-radius:20px; margin-right:10px;";
        btn.onclick = () => {
            AppPrincipal.state.viewMode = AppPrincipal.state.viewMode === 'admin' ? 'atleta' : 'admin';
            btn.innerHTML = AppPrincipal.state.viewMode === 'admin' ? "<i class='bx bx-run'></i> Modo Atleta" : "<i class='bx bx-shield-quarter'></i> Modo Coach";
            AppPrincipal.updateViewClasses(); AppPrincipal.navigateTo('planilha');
        };
        nav.insertBefore(btn, document.getElementById('logoutButton'));
    },

    updateViewClasses: () => {
        const c = document.getElementById('app-container');
        if(AppPrincipal.state.viewMode === 'admin') { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
        else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
    },

    navigateTo: (page) => {
        const m = document.getElementById('app-main-content');
        m.innerHTML = "";
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); if(btn) btn.classList.add('active');

        if(page === 'planilha') {
            if(AppPrincipal.state.viewMode === 'admin') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            else AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        } else if (page === 'feed') {
            FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // --- STRAVA DEEP SYNC (VERSÃO SEGURA PARA EVITAR TRAVAMENTO) ---
    handleStravaConnect: () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; },
    
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ code }) });
        window.history.replaceState({}, document.title, "app.html"); window.location.reload();
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        
        const btn = document.getElementById('btn-strava-action');
        if(btn) { btn.disabled = true; btn.textContent = "Sincronizando... aguarde..."; }

        try {
            // Busca as últimas 50 atividades
            const activities = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } }).then(r => r.json());
            const updates = {};
            let count = 0;

            for(const act of activities) {
                // Loop profundo com atraso de 200ms para evitar erro 429
                await new Promise(r => setTimeout(r, 200)); 
                
                const detail = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } }).then(r => r.json());

                const newKey = AppPrincipal.state.db.ref().push().key;
                const distanceKm = (act.distance / 1000).toFixed(2) + "km";
                const timeStr = new Date(act.moving_time * 1000).toISOString().substr(11, 8);
                const pace = (act.moving_time / 60) / (act.distance / 1000); 
                const paceMin = Math.floor(pace); const paceSec = Math.round((pace - paceMin) * 60);
                const paceStr = `${paceMin}:${paceSec < 10 ? '0' : ''}${paceSec}/km`;

                let splits = [];
                if(detail.splits_metric) {
                    splits = detail.splits_metric.map((s, i) => {
                        const sPace = (s.moving_time / 60) / (s.distance / 1000);
                        const sMin = Math.floor(sPace); const sSec = Math.round((sPace - sMin) * 60);
                        return { km: i + 1, pace: `${sMin}'${sSec < 10 ? '0' : ''}${sSec}"`, time: new Date(s.moving_time * 1000).toISOString().substr(14, 5), elev: s.elevation_difference || 0 };
                    });
                }

                const workoutData = {
                    title: act.name,
                    date: act.start_date.split('T')[0],
                    description: `[Importado Strava] ${act.type} - ${distanceKm}`,
                    status: 'realizado',
                    realizadoAt: new Date().toISOString(),
                    feedback: `Sincronizado via Strava. Dist: ${distanceKm}, Pace: ${paceStr}.`,
                    stravaActivityId: act.id,
                    stravaData: { 
                        distancia: distanceKm, tempo: timeStr, ritmo: paceStr, id: act.id,
                        splits: splits, elevacao: (act.total_elevation_gain || 0) + "m", calorias: (act.calories || 0)
                    },
                    createdBy: currentUser.uid
                };

                updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                updates[`/publicWorkouts/${newKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...workoutData };
                count++;
            }
            await AppPrincipal.state.db.ref().update(updates);
            alert(`${count} atividades sincronizadas com sucesso!`);
            document.getElementById('profile-modal').classList.add('hidden');
        } catch(e) { alert("Erro na sincronização: " + e.message); } finally { if(btn) { btn.disabled = false; btn.textContent = "Sincronizar Strava Agora"; } }
    },

    // --- MODAL DETALHADO (RESTAURADO) ---
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        document.getElementById('feedback-modal-title').textContent = title;
        
        const sd = document.getElementById('strava-data-display');
        if(sd) { sd.innerHTML = ""; sd.classList.add('hidden'); }
        document.getElementById('comments-list').innerHTML = "Carregando...";
        
        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
                if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
                
                // RENDERIZAÇÃO DO STRAVA COM TABELA
                if(d.stravaData && sd) {
                    sd.classList.remove('hidden');
                    let tableHTML = "";
                    if(d.stravaData.splits && d.stravaData.splits.length > 0) {
                        tableHTML = `
                            <div style="margin-top:15px; border:1px solid #eee; border-radius:8px; overflow:hidden;">
                                <table style="width:100%; font-size:0.85rem; border-collapse:collapse; text-align:center;">
                                    <thead style="background:#f9f9f9; color:#666;"><tr><th style="padding:8px;">Km</th><th>Pace</th><th>Tempo</th></tr></thead>
                                    <tbody>${d.stravaData.splits.map(s => `<tr style="border-top:1px solid #eee;"><td style="padding:6px;">${s.km}</td><td><b>${s.pace}</b></td><td>${s.time}</td></tr>`).join('')}</tbody>
                                </table>
                            </div>
                        `;
                    }
                    sd.innerHTML = `
                        <div style="padding:15px; background:#fff; border:1px solid #e0e0e0; border-radius:8px; margin-top:10px;">
                            <h4 style="color:#fc4c02; margin:0;"><i class='bx bxl-strava'></i> Dados Strava</h4>
                            <p><b>Dist:</b> ${d.stravaData.distancia} | <b>Tempo:</b> ${d.stravaData.tempo} | <b>Pace:</b> ${d.stravaData.ritmo}</p>
                            ${tableHTML}
                        </div>
                    `;
                }
            }
        });
        
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            const list = document.getElementById('comments-list');
            list.innerHTML = "";
            if(!s.exists()) { list.innerHTML = "<small>Nenhum comentário.</small>"; return; }
            s.forEach(c => {
                const v = c.val();
                const div = document.createElement('div'); div.className = 'comment-item';
                div.innerHTML = `<strong>${v.name || 'Usuário'}:</strong> ${v.text}`;
                list.appendChild(div);
            });
        });
        if(modal) modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const updates = { status: document.getElementById('workout-status').value, feedback: document.getElementById('workout-feedback-text').value, realizadoAt: new Date().toISOString() };
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        const fullData = (await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value')).val();
        if(updates.status !== 'planejado') {
            await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ ownerId: currentOwnerId, ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name || "Atleta", ...fullData });
        }
        document.getElementById('feedback-modal').classList.add('hidden');
    },

    handleCommentSubmit: (e) => {
        e.preventDefault();
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({
            uid: AppPrincipal.state.currentUser.uid, name: AppPrincipal.state.userData.name || "Usuário", text: text, timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        document.getElementById('comment-input').value = "";
    },
    
    handleLogActivitySubmit: async (e) => { e.preventDefault(); },
    handlePhotoUpload: () => {}, handleProfilePhotoUpload: () => {},
    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const form = document.getElementById('profile-form');
        let btn = document.getElementById('btn-strava-action');
        if(!btn) {
            btn = document.createElement('button'); btn.id='btn-strava-action'; btn.type='button';
            btn.className='btn btn-secondary'; btn.style.marginTop='15px'; btn.style.width='100%'; btn.style.background='#fc4c02'; btn.style.color='white'; btn.style.border='none';
            form.appendChild(btn);
        }
        btn.textContent = AppPrincipal.state.stravaTokenData ? "Sincronizar Strava" : "Conectar Strava";
        btn.onclick = AppPrincipal.state.stravaTokenData ? AppPrincipal.handleStravaSyncActivities : AppPrincipal.handleStravaConnect;
    },
    handleProfileSubmit: (e) => { e.preventDefault(); document.getElementById('profile-modal').classList.add('hidden'); },
    
    callGeminiTextAPI: async (prompt) => {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    }
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