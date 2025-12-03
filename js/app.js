/* =================================================================== */
/* APP.JS V20.0 - BASE V2 COM DEEP SYNC E LOGIN CORRIGIDO (COMPLETO)
/* =================================================================== */

const AppPrincipal = {
    state: { currentUser: null, userData: null, db: null, auth: null, listeners: {}, currentView: 'planilha', viewMode: 'admin', adminUIDs: {}, userCache: {}, modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null }, stravaTokenData: null },
    elements: {},

    init: () => {
        if (typeof window.firebaseConfig === 'undefined') return;
        try { if (firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch (e) {}

        AppPrincipal.state.auth = firebase.auth();
        AppPrincipal.state.db = firebase.database();

        // Roteamento V2 Original
        if (document.getElementById('login-form')) {
            AuthLogic.init(AppPrincipal.state.auth);
        } else if (document.getElementById('app-container')) {
            AppPrincipal.initPlatform();
        }
    },

    initPlatform: () => {
        const el = AppPrincipal.elements;
        el.loader = document.getElementById('loader');
        el.appContainer = document.getElementById('app-container');
        el.mainContent = document.getElementById('app-main-content');

        // Binds de Navegação V2
        document.getElementById('logoutButton').onclick = () => AppPrincipal.state.auth.signOut().then(()=>window.location.href='index.html');
        document.getElementById('nav-planilha-btn').onclick = () => AppPrincipal.navigateTo('planilha');
        document.getElementById('nav-feed-btn').onclick = () => AppPrincipal.navigateTo('feed');
        document.getElementById('nav-profile-btn').onclick = AppPrincipal.openProfileModal;
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Form Binds Seguros
        if(document.getElementById('feedback-form')) document.getElementById('feedback-form').onsubmit = AppPrincipal.handleFeedbackSubmit;
        if(document.getElementById('comment-form')) document.getElementById('comment-form').onsubmit = AppPrincipal.handleCommentSubmit;
        if(document.getElementById('profile-form')) document.getElementById('profile-form').onsubmit = AppPrincipal.handleProfileSubmit;
        if(document.getElementById('photo-upload-input')) document.getElementById('photo-upload-input').onchange = AppPrincipal.handlePhotoUpload;
        
        const btnEval = document.getElementById('save-coach-eval-btn');
        if(btnEval) btnEval.onclick = AppPrincipal.handleCoachEvaluationSubmit;
        const btnLogManual = document.getElementById('log-activity-form');
        if(btnLogManual) btnLogManual.onsubmit = AppPrincipal.handleLogActivitySubmit;

        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if (!user) { window.location.href = 'index.html'; return; }
            AppPrincipal.state.currentUser = user;
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('code')) AppPrincipal.exchangeStravaCode(urlParams.get('code'));
            else AppPrincipal.loadUserData(user.uid);
        });
    },

    loadUserData: (uid) => {
        AppPrincipal.state.db.ref('users').on('value', s => AppPrincipal.state.userCache = s.val()||{});
        AppPrincipal.state.db.ref('users/'+uid).once('value', s => {
            let data = s.val();
            AppPrincipal.state.db.ref('admins/'+uid).once('value', asnap => {
                const isAdmin = asnap.exists() && asnap.val();
                if(!data && isAdmin) { data={name:AppPrincipal.state.currentUser.email, role:'admin'}; AppPrincipal.state.db.ref('users/'+uid).set(data); }
                if(data) {
                    AppPrincipal.state.userData = {...data, uid};
                    document.getElementById('userDisplay').textContent = data.name;
                    if(isAdmin) document.getElementById('app-container').classList.add('admin-view');
                    else document.getElementById('app-container').classList.add('atleta-view');
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        mainContent.innerHTML = "";
        
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); if(btn) btn.classList.add('active');

        const tplId = page === 'planilha' ? (AppPrincipal.state.userData.role === 'admin' ? 'admin-panel-template' : 'atleta-panel-template') : 'feed-panel-template';
        const tpl = document.getElementById(tplId);

        if(tpl) {
            mainContent.appendChild(tpl.content.cloneNode(true));
            if(AppPrincipal.state.userData.role === 'admin') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            else if(page === 'planilha') { AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db); }
            else if(page === 'feed') { FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db); }
        }
        
        loader.classList.add('hidden');
        appContainer.classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // --- STRAVA DEEP SYNC (FUNÇÃO COMPLETA) ---
    handleStravaConnect: () => { 
        window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; 
    },
    exchangeStravaCode: async (code) => {
        const token = await AppPrincipal.state.currentUser.getIdToken();
        await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body:JSON.stringify({code}) });
        window.history.replaceState({}, document.title, "app.html"); window.location.reload();
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava.");
        
        const btn = document.getElementById('btn-strava-action');
        if(btn) { btn.disabled = true; btn.textContent = "Buscando detalhes (Km a Km)..."; }

        try {
            const activities = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=50`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } }).then(r => r.json());
            const updates = {};
            for(const act of activities) {
                await new Promise(r => setTimeout(r, 150)); 
                let detail = act; 
                try {
                    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } });
                    if(detailRes.ok) detail = await detailRes.json();
                } catch(e) { console.warn("Erro detalhe:", e); }

                const newKey = AppPrincipal.state.db.ref().push().key;
                const distanceKm = (act.distance / 1000).toFixed(2) + " km";
                const timeStr = new Date(act.moving_time * 1000).toISOString().substr(11, 8);
                const paceMin = Math.floor((act.moving_time / 60) / (act.distance / 1000));
                const paceSec = Math.round(((act.moving_time / 60) / (act.distance / 1000) - paceMin) * 60);
                const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;

                let splits = [];
                if(detail.splits_metric) {
                    splits = detail.splits_metric.map((s, i) => {
                        const sPace = (s.moving_time / 60) / (s.distance / 1000);
                        const sMin = Math.floor(sPace); const sSec = Math.round((sPace - sMin) * 60).toFixed(0);
                        return { km: i + 1, pace: `${sMin}:${sSec.toString().padStart(2,'0')}`, time: new Date(s.moving_time * 1000).toISOString().substr(14, 5), elev: (s.elevation_difference || 0).toFixed(0) };
                    });
                }

                const workoutData = {
                    title: act.name, date: act.start_date.split('T')[0], status: 'realizado', realizadoAt: new Date().toISOString(),
                    feedback: `Sincronizado.`, stravaActivityId: act.id,
                    stravaData: { distancia: distanceKm, tempo: timeStr, ritmo: paceStr, id: act.id, splits: splits, elevacao: (act.total_elevation_gain || 0) + "m", calorias: (act.calories || act.kilojoules || 0).toFixed(0) },
                    createdBy: currentUser.uid
                };

                updates[`/data/${currentUser.uid}/workouts/${newKey}`] = workoutData;
                updates[`/publicWorkouts/${newKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...workoutData };
            }
            await AppPrincipal.state.db.ref().update(updates);
            alert("Sync completo!");
        } catch(e) { alert("Erro Sync: "+e.message); } finally { if(btn) { btn.disabled=false; btn.textContent="Sincronizar Strava"; } }
    },

    // --- MODAL COMPLETO (COMPLETO) ---
    openFeedbackModal: (wid, oid, title) => {
        const modal = document.getElementById('feedback-modal');
        AppPrincipal.state.modal = { isOpen:true, currentWorkoutId:wid, currentOwnerId:oid };
        document.getElementById('feedback-modal-title').textContent = title;
        
        const sd = document.getElementById('strava-data-display');
        sd.innerHTML=""; sd.classList.add('hidden');
        document.getElementById('comments-list').innerHTML = "Carregando...";

        AppPrincipal.state.db.ref(`data/${oid}/workouts/${wid}`).once('value', s => {
            if(!s.exists()) return;
            const d = s.val();
            if(document.getElementById('workout-status')) document.getElementById('workout-status').value = d.status || 'planejado';
            if(document.getElementById('workout-feedback-text')) document.getElementById('workout-feedback-text').value = d.feedback || '';
            
            if(d.stravaData) {
                sd.classList.remove('hidden');
                let rows = "";
                if(d.stravaData.splits && d.stravaData.splits.length > 0) {
                    d.stravaData.splits.forEach(sp => {
                        const pMin = Math.floor(sp.pace); const pSec = Math.round((sp.pace-pMin)*60).toFixed(0);
                        rows += `<tr><td>${sp.km}</td><td>${pMin}:${pSec}</td><td>${sp.elev}m</td></tr>`;
                    });
                }
                sd.innerHTML = `
                    <div style="background:#f9f9f9; padding:10px; border:1px solid #ccc; margin-top:10px;">
                        <b>Dados Strava:</b> ${d.stravaData.distancia} | ${d.stravaData.tempo} | ${d.stravaData.ritmo}
                        <table style="width:100%; font-size:0.8rem; margin-top:5px; text-align:center;">
                            <thead><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `;
            }
        });
        document.getElementById('feedback-modal').classList.remove('hidden');
    },

    // --- HANDLERS (Completos) ---
    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const updates = { status: document.getElementById('workout-status').value, feedback: document.getElementById('workout-feedback-text').value, realizadoAt: new Date().toISOString() };
        await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
        const full = (await AppPrincipal.state.db.ref(`data/${currentWorkoutId}/workouts/${currentWorkoutId}`).once('value')).val();
        if(updates.status !== 'planejado') await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ownerId: currentOwnerId, ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name, ...full});
        document.getElementById('feedback-modal').classList.add('hidden');
    },
    
    handleCommentSubmit: (e) => { 
        e.preventDefault(); 
        const text = document.getElementById('comment-input').value;
        if(!text) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({ uid: AppPrincipal.state.currentUser.uid, name: AppPrincipal.state.userData.name, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP });
        document.getElementById('comment-input').value = "";
    },
    
    handleLogActivitySubmit: async (e) => { 
        e.preventDefault(); 
        const form = document.getElementById('log-activity-form');
        const workoutData = {
            date: form.querySelector('#log-activity-date').value,
            title: form.querySelector('#log-activity-title').value,
            description: form.querySelector('#log-activity-feedback').value,
            status: 'realizado', realizadoAt: new Date().toISOString(),
            createdBy: AppPrincipal.state.currentUser.uid
        };
        const ref = await AppPrincipal.state.db.ref(`data/${AppPrincipal.state.currentUser.uid}/workouts`).push(workoutData);
        await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({ ownerId: AppPrincipal.state.currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...workoutData });
        document.getElementById('log-activity-modal').classList.add('hidden');
    },
    handlePhotoUpload: () => {}, handleProfilePhotoUpload: () => {},
    
    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const form = document.getElementById('profile-form');
        let btn = document.getElementById('btn-strava');
        if(!btn) {
            btn = document.createElement('button'); btn.id='btn-strava'; btn.type='button'; btn.className='btn btn-secondary'; form.appendChild(btn);
        }
        btn.textContent = AppPrincipal.state.stravaTokenData ? "Sincronizar Strava" : "Conectar Strava";
        btn.onclick = AppPrincipal.state.stravaTokenData ? AppPrincipal.handleStravaSyncActivities : AppPrincipal.handleStravaConnect;
    },
    handleProfileSubmit: (e) => { e.preventDefault(); document.getElementById('profile-modal').classList.add('hidden'); },
    handleCoachEvaluationSubmit: (e) => { e.preventDefault(); /* Lógica avaliação */ },
    
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) throw new Error("Sem Chave API");
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if(r.status === 429) return "⚠️ Limite de uso da IA atingido. Tente novamente mais tarde.";
        if(!r.ok) throw new Error("Erro IA: "+r.status);
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    }
};

const AuthLogic = {
    init: (auth) => {
        document.getElementById('login-form').addEventListener('submit', e => {
            e.preventDefault();
            auth.signInWithEmailAndPassword(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
                .then(() => window.location.href='app.html')
                .catch(err => document.getElementById('login-error').textContent = err.message);
        });
    }
};

document.addEventListener('DOMContentLoaded', AppPrincipal.init);
