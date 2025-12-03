/* =================================================================== */
/* APP.JS V3.0 - VERSÃO ESTÁVEL E BLINDADA
/* =================================================================== */

const AppPrincipal = {
    state: {
        currentUser: null, userData: null, db: null, auth: null,
        listeners: {}, currentView: 'planilha', viewMode: 'admin',
        userCache: {}, modal: { isOpen: false, currentWorkoutId: null, currentOwnerId: null },
        stravaTokenData: null, currentAnalysisData: null
    },
    elements: {},

    init: () => {
        if(typeof window.firebaseConfig === 'undefined') return;
        try { if(firebase.apps.length === 0) firebase.initializeApp(window.firebaseConfig); } catch(e){}
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

        // Binds Globais
        const bind = (id, fn) => { const b = document.getElementById(id); if(b) b.onclick = fn; };
        bind('logoutButton', AppPrincipal.handleLogout);
        bind('nav-planilha-btn', () => AppPrincipal.navigateTo('planilha'));
        bind('nav-feed-btn', () => AppPrincipal.navigateTo('feed'));
        bind('nav-profile-btn', AppPrincipal.openProfileModal);
        
        document.querySelectorAll('.close-btn').forEach(b => b.onclick = (e) => e.target.closest('.modal-overlay').classList.add('hidden'));
        
        // Forms
        const bindForm = (id, fn) => { const f = document.getElementById(id); if(f) f.onsubmit = fn; };
        bindForm('feedback-form', AppPrincipal.handleFeedbackSubmit);
        bindForm('comment-form', AppPrincipal.handleCommentSubmit);
        bindForm('profile-form', AppPrincipal.handleProfileSubmit);
        bindForm('log-activity-form', AppPrincipal.handleLogActivitySubmit);
        
        const photoInput = document.getElementById('photo-upload-input');
        if(photoInput) photoInput.onchange = AppPrincipal.handlePhotoUpload;
        
        const btnSaveIa = document.getElementById('save-ia-analysis-btn');
        if(btnSaveIa) btnSaveIa.onclick = AppPrincipal.handleSaveIaAnalysis;

        const urlParams = new URLSearchParams(window.location.search);
        
        AppPrincipal.state.auth.onAuthStateChanged((user) => {
            if(!user) { window.location.href = 'index.html'; return; }
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
                    const display = document.getElementById('userDisplay');
                    if(display) display.textContent = data.name;
                    
                    if (isAdmin) {
                        AppPrincipal.state.userData.role = 'admin'; 
                        const nav = document.querySelector('.app-header nav');
                        if(nav && !document.getElementById('admin-toggle')) {
                            const btn = document.createElement('button');
                            btn.id = 'admin-toggle'; btn.className = 'btn btn-nav'; btn.innerHTML = "Modo Atleta"; btn.style.border = "1px solid white"; btn.style.marginLeft="10px";
                            btn.onclick = () => {
                                AppPrincipal.state.viewMode = AppPrincipal.state.viewMode === 'admin' ? 'atleta' : 'admin';
                                btn.innerHTML = AppPrincipal.state.viewMode === 'admin' ? "Modo Atleta" : "Modo Coach";
                                AppPrincipal.updateClasses(); AppPrincipal.navigateTo('planilha');
                            };
                            const logout = document.getElementById('logoutButton');
                            if(logout) nav.insertBefore(btn, logout);
                        }
                    }
                    AppPrincipal.state.db.ref(`users/${uid}/stravaAuth`).on('value', ts => AppPrincipal.state.stravaTokenData = ts.val());
                    AppPrincipal.updateClasses();
                    AppPrincipal.navigateTo('planilha');
                }
            });
        });
    },

    updateClasses: () => {
        const c = document.getElementById('app-container');
        if(!c) return;
        if(AppPrincipal.state.viewMode==='admin') { c.classList.add('admin-view'); c.classList.remove('atleta-view'); }
        else { c.classList.add('atleta-view'); c.classList.remove('admin-view'); }
    },

    navigateTo: (page) => {
        const { mainContent, loader, appContainer } = AppPrincipal.elements;
        document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`nav-${page}-btn`); if(btn) btn.classList.add('active');

        if(window.panels && window.panels.cleanup) window.panels.cleanup();
        if(mainContent) mainContent.innerHTML = "";
        
        let templateId = "";
        if (page === 'planilha') {
            templateId = (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') ? "admin-panel-template" : "atleta-panel-template";
        } else if (page === 'feed') {
            templateId = "feed-panel-template";
        }

        const template = document.getElementById(templateId);
        if (template && mainContent) {
            const clone = template.content.cloneNode(true);
            mainContent.appendChild(clone);
            
            if (page === 'planilha') {
                if (AppPrincipal.state.userData.role === 'admin' && AppPrincipal.state.viewMode === 'admin') AdminPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
                else AtletaPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
            } else if (page === 'feed') FeedPanel.init(AppPrincipal.state.currentUser, AppPrincipal.state.db);
        }
        if(loader) loader.classList.add('hidden');
        if(appContainer) appContainer.classList.remove('hidden');
    },

    handleLogout: () => AppPrincipal.state.auth.signOut().then(() => window.location.href = 'index.html'),

    // STRAVA SYNC ROBUSTO
    handleStravaConnect: () => { window.location.href = `https://www.strava.com/oauth/authorize?client_id=${window.STRAVA_PUBLIC_CONFIG.clientID}&response_type=code&redirect_uri=${window.STRAVA_PUBLIC_CONFIG.redirectURI}&approval_prompt=force&scope=read_all,activity:read_all,profile:read_all`; },
    
    exchangeStravaCode: async (code) => {
        try {
            const token = await AppPrincipal.state.currentUser.getIdToken();
            await fetch(window.STRAVA_PUBLIC_CONFIG.vercelAPI, { method: 'POST', headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`}, body: JSON.stringify({code}) });
            window.history.replaceState({}, document.title, "app.html"); window.location.reload();
        } catch(e) { alert("Erro Strava Auth: " + e.message); }
    },

    handleStravaSyncActivities: async () => {
        const { stravaTokenData, currentUser } = AppPrincipal.state;
        if (!stravaTokenData) return alert("Conecte o Strava primeiro.");
        const btn = document.getElementById('btn-strava-action');
        const statusMsg = document.getElementById('strava-sync-status');
        if(btn) { btn.disabled=true; btn.textContent="Sincronizando..."; }

        try {
            const existingSnap = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).once('value');
            const existingWorkouts = existingSnap.val() || {};
            const updates = {};
            let totalImported = 0;
            let page = 1;
            let keepFetching = true;
            const perPage = 30;

            while (keepFetching) {
                if(statusMsg) statusMsg.textContent = `Buscando página ${page}...`;
                const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}&page=${page}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } });
                if (!response.ok) break;
                
                const activities = await response.json();
                if (!Array.isArray(activities) || activities.length === 0) { keepFetching = false; break; }

                for(const act of activities) {
                    if(!act.start_date) continue; // Pula se dados incompletos
                    let matchKey = null;
                    const actDate = act.start_date.split('T')[0];
                    let alreadyExists = false;

                    for (const [key, val] of Object.entries(existingWorkouts)) {
                        if (val && String(val.stravaActivityId) === String(act.id)) alreadyExists = true;
                        if (val && val.date === actDate && val.status !== 'realizado') matchKey = key;
                    }

                    if(alreadyExists && !matchKey) continue;

                    await new Promise(r => setTimeout(r, 150)); // Rate Limit Protection
                    const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${act.id}`, { headers: { 'Authorization': `Bearer ${stravaTokenData.accessToken}` } });
                    const detail = await detailRes.json();
                    
                    let splits = [];
                    if(detail.splits_metric) {
                        splits = detail.splits_metric.map((s, i) => {
                            const pMin = Math.floor((s.moving_time/60)/(s.distance/1000)); 
                            const pSec = Math.round(((s.moving_time/60)/(s.distance/1000)-pMin)*60);
                            const pStr = (isFinite(pMin) && isFinite(pSec)) ? `${pMin}'${pSec.toString().padStart(2,'0')}"` : "-";
                            return { km: i+1, pace: pStr, time: new Date(s.moving_time*1000).toISOString().substr(14,5), elev: (s.elevation_difference||0).toFixed(0) };
                        });
                    }
                    
                    const distKm = (act.distance/1000).toFixed(2)+" km";
                    const paceMin = Math.floor((act.moving_time/60)/(act.distance/1000));
                    const paceSec = Math.round(((act.moving_time/60)/(act.distance/1000)-paceMin)*60);
                    const pTotal = (isFinite(paceMin) && isFinite(paceSec)) ? `${paceMin}:${paceSec.toString().padStart(2,'0')}` : "-";
                    
                    const stravaPayload = { 
                        distancia: distKm, tempo: new Date(act.moving_time*1000).toISOString().substr(11,8), 
                        ritmo: pTotal, id: act.id, splits: splits, elevacao: (act.total_elevation_gain||0)+"m",
                        mapLink: detail.map?.summary_polyline ? `https://www.strava.com/activities/${act.id}` : null
                    };

                    const commonData = {
                        status: 'realizado',
                        realizadoAt: new Date().toISOString(),
                        stravaData: stravaPayload,
                        stravaActivityId: act.id,
                        feedback: `Sincronizado. ${distKm} em ${stravaPayload.tempo}.`
                    };

                    if (matchKey) {
                        updates[`/data/${currentUser.uid}/workouts/${matchKey}`] = { ...existingWorkouts[matchKey], ...commonData };
                        updates[`/publicWorkouts/${matchKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...existingWorkouts[matchKey], ...commonData };
                        totalImported++;
                    } else if (!alreadyExists) {
                        const newKey = AppPrincipal.state.db.ref().push().key;
                        const wData = {
                            title: act.name, date: actDate, description: `[Importado]: ${act.type}`, 
                            createdBy: currentUser.uid, ...commonData
                        };
                        updates[`/data/${currentUser.uid}/workouts/${newKey}`] = wData;
                        updates[`/publicWorkouts/${newKey}`] = { ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...wData };
                        totalImported++;
                    }
                }
                page++;
            }

            if(Object.keys(updates).length > 0) {
                await AppPrincipal.state.db.ref().update(updates);
                alert(`Sync Completo! ${totalImported} novos.`);
            } else {
                alert("Tudo atualizado.");
            }
            document.getElementById('profile-modal').classList.add('hidden');

        } catch(e) { console.error(e); alert("Erro Sync: "+e.message); } 
        finally { if(btn) { btn.disabled=false; btn.textContent="Sincronizar Strava"; } if(statusMsg) statusMsg.textContent=""; }
    },

    // FEEDBACK & MODALS
    openFeedbackModal: (workoutId, ownerId, title) => {
        const modal = document.getElementById('feedback-modal');
        if(!modal) return;
        AppPrincipal.state.modal = { isOpen: true, currentWorkoutId: workoutId, currentOwnerId: ownerId };
        
        const titleEl = document.getElementById('feedback-modal-title');
        if(titleEl) titleEl.textContent = title;
        
        const commList = document.getElementById('comments-list');
        if(commList) commList.innerHTML = "Carregando...";
        
        const sdDiv = document.getElementById('modal-strava-data');
        if(sdDiv) sdDiv.classList.add('hidden');

        AppPrincipal.state.db.ref(`data/${ownerId}/workouts/${workoutId}`).once('value', s => {
            if(s.exists()) {
                const d = s.val();
                const st = document.getElementById('workout-status');
                const fb = document.getElementById('workout-feedback-text');
                if(st) st.value = d.status || 'planejado';
                if(fb) fb.value = d.feedback || '';
                
                if(d.stravaData) {
                    const sd = document.getElementById('modal-strava-content');
                    if(sdDiv) sdDiv.classList.remove('hidden');
                    let html = `<div style="text-align:center; margin-bottom:10px;"><b>${d.stravaData.distancia}</b> | ${d.stravaData.ritmo} | ${d.stravaData.tempo}</div>`;
                    if(d.stravaData.splits) {
                        html += `<table style="width:100%; font-size:0.8rem; border-collapse:collapse; text-align:center;"><thead style="background:#eee;"><tr><th>Km</th><th>Pace</th><th>Elev</th></tr></thead><tbody>`;
                        d.stravaData.splits.forEach(sp => html += `<tr><td>${sp.km}</td><td>${sp.pace}</td><td>${sp.elev}m</td></tr>`);
                        html += `</tbody></table>`;
                    }
                    if(sd) sd.innerHTML = html;
                }
            }
        });
        
        AppPrincipal.state.db.ref(`workoutComments/${workoutId}`).on('value', s => {
            if(commList) {
                commList.innerHTML = "";
                if(!s.exists()) return;
                s.forEach(c => commList.innerHTML += `<div style="border-bottom:1px solid #eee; padding:5px;"><b>${c.val().name}:</b> ${c.val().text}</div>`);
            }
        });
        modal.classList.remove('hidden');
    },

    handleFeedbackSubmit: async (e) => {
        e.preventDefault();
        const { currentWorkoutId, currentOwnerId } = AppPrincipal.state.modal;
        const btn = document.getElementById('save-feedback-btn');
        if(btn) { btn.disabled=true; btn.textContent="Enviando..."; }

        try {
            let imageUrl = null;
            const fileInput = document.getElementById('photo-upload-input');
            if (fileInput && fileInput.files.length > 0) {
                const fb = document.getElementById('photo-upload-feedback');
                if(fb) fb.textContent = "Upload...";
                imageUrl = await AppPrincipal.uploadFileToCloudinary(fileInput.files[0], 'workouts');
            }

            const updates = { 
                status: document.getElementById('workout-status').value, 
                feedback: document.getElementById('workout-feedback-text').value,
                realizadoAt: new Date().toISOString()
            };
            if(imageUrl) updates.imageUrl = imageUrl;

            await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).update(updates);
            
            const fullSnap = await AppPrincipal.state.db.ref(`data/${currentOwnerId}/workouts/${currentWorkoutId}`).once('value');
            if(updates.status !== 'planejado') await AppPrincipal.state.db.ref(`publicWorkouts/${currentWorkoutId}`).set({ ownerId: currentOwnerId, ownerName: AppPrincipal.state.userCache[currentOwnerId]?.name, ...fullSnap.val() });
            
            document.getElementById('feedback-modal').classList.add('hidden');
        } catch(err) { alert("Erro: " + err.message); } 
        finally { if(btn) { btn.disabled=false; btn.textContent="Salvar Feedback"; } }
    },
    
    handleCommentSubmit: (e) => {
        e.preventDefault();
        const inp = document.getElementById('comment-input');
        if(!inp || !inp.value) return;
        AppPrincipal.state.db.ref(`workoutComments/${AppPrincipal.state.modal.currentWorkoutId}`).push({ uid: AppPrincipal.state.currentUser.uid, name: AppPrincipal.state.userData.name, text: inp.value, timestamp: firebase.database.ServerValue.TIMESTAMP });
        inp.value = "";
    },
    
    handleLogActivitySubmit: async (e) => { 
        e.preventDefault();
        const currentUser = AppPrincipal.state.currentUser;
        const data = { date: document.getElementById('log-activity-date').value, title: document.getElementById('log-activity-title').value, description: document.getElementById('log-activity-feedback').value, status: 'realizado', createdBy: currentUser.uid, createdAt: new Date().toISOString() };
        const ref = await AppPrincipal.state.db.ref(`data/${currentUser.uid}/workouts`).push(data);
        await AppPrincipal.state.db.ref(`publicWorkouts/${ref.key}`).set({ ownerId: currentUser.uid, ownerName: AppPrincipal.state.userData.name, ...data });
        document.getElementById('log-activity-modal').classList.add('hidden');
    },

    handlePhotoUpload: async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const feedback = document.getElementById('photo-upload-feedback');
        if(feedback) feedback.textContent = "Analisando...";
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                const prompt = `Analise esta imagem. JSON: { "distancia": "X km", "tempo": "HH:MM:SS", "ritmo": "X:XX /km" }`;
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }] }) });
                const data = await res.json();
                const json = JSON.parse(data.candidates[0].content.parts[0].text);
                if(feedback) feedback.textContent = "Dados: " + json.distancia;
                const sd = document.getElementById('modal-strava-content');
                const box = document.getElementById('modal-strava-data');
                if(box) box.classList.remove('hidden');
                if(sd) sd.innerHTML = `<div><b>IA Vision:</b> ${json.distancia} | ${json.tempo} | ${json.ritmo}</div>`;
            };
        } catch (err) { if(feedback) feedback.textContent = "Erro leitura IA."; }
    },

    openProfileModal: () => { 
        document.getElementById('profile-modal').classList.remove('hidden'); 
        const u = AppPrincipal.state.userData;
        if(u) {
            document.getElementById('profile-name').value = u.name || "";
            document.getElementById('profile-bio').value = u.bio || "";
            document.getElementById('profile-pic-preview').src = u.photoUrl || "https://placehold.co/150";
        }
        const container = document.getElementById('strava-connection-area');
        if(container) {
            container.innerHTML = "";
            const btn = document.createElement('button'); btn.id='btn-strava-action'; btn.className='btn btn-secondary'; btn.style.width='100%'; btn.style.marginTop='15px';
            if (AppPrincipal.state.stravaTokenData) {
                btn.innerHTML = "Sincronizar Strava (Deep)"; btn.style.backgroundColor = "#fc4c02"; btn.onclick = AppPrincipal.handleStravaSyncActivities;
                const status = document.createElement('p'); status.id="strava-sync-status"; status.style.fontSize="0.8rem"; container.appendChild(status);
            } else {
                btn.innerHTML = "Conectar Strava"; btn.onclick = AppPrincipal.handleStravaConnect;
            }
            container.appendChild(btn);
        }
    },

    handleProfileSubmit: async (e) => { 
        e.preventDefault(); 
        await AppPrincipal.state.db.ref(`users/${AppPrincipal.state.currentUser.uid}`).update({name: document.getElementById('profile-name').value, bio: document.getElementById('profile-bio').value});
        document.getElementById('profile-modal').classList.add('hidden');
    },
    
    callGeminiTextAPI: async (prompt) => {
        if(!window.GEMINI_API_KEY) return "Sem Chave API";
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        const d = await r.json(); return d.candidates[0].content.parts[0].text;
    },

    handleSaveIaAnalysis: async () => {
        if(!AppPrincipal.state.currentAnalysisData) return;
        await AppPrincipal.state.db.ref(`iaAnalysisHistory/${AdminPanel.state.selectedAthleteId}`).push(AppPrincipal.state.currentAnalysisData);
        document.getElementById('ia-analysis-modal').classList.add('hidden');
    },

    uploadFileToCloudinary: async (file, folder) => {
        const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', window.CLOUDINARY_CONFIG.uploadPreset); formData.append('folder', `lerunners/${folder}`);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: formData });
        const data = await res.json(); return data.secure_url;
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
