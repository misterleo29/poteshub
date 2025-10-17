// app.js - Mobile-first PotesHub (remplacer complètement)
// 🔧 Remplace VAPID_KEY par ta clé publique VAPID (Firebase Cloud Messaging)
// NE METS PAS de Server Key côté client.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getDatabase, ref, set, push, onValue, get, remove, update
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';

// ---------- CONFIG ----------
const firebaseConfig = {
  apiKey: "AIzaSyDmsgNKyXAckhoHpdRSuZxYgR3DmzXWmd0",
  authDomain: "poteshub-8d37b.firebaseapp.com",
  databaseURL: "https://poteshub-8d37b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "poteshub-8d37b",
  storageBucket: "poteshub-8d37b.firebasestorage.app",
  messagingSenderId: "457001877075",
  appId: "1:457001877075:web:1e0d09aec0c02349db10a6"
};

// Colle ici ta VAPID public key (Firebase Console -> Cloud Messaging -> Web push certificates)
const VAPID_KEY = "<COLLE_ICI_TA_VAPID_KEY_WEB_PUSH>";

// ---------- INIT ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let messaging;
try { messaging = getMessaging(app); } catch (e) { console.warn('messaging init fail', e); }

let currentUser = null;
let isAdmin = false;
let adminUnlocked = false;

// DOM refs
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerUsername = document.getElementById('registerUsername');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authPage = document.getElementById('authPage');
const mainApp = document.getElementById('mainApp');

const userNameElem = document.getElementById('userName');
const userAvatarElem = document.getElementById('userAvatar');
const adminBadge = document.getElementById('adminBadge');

const messagesList = document.getElementById('messagesList');
const usersList = document.getElementById('usersList');
const adminMessagesList = document.getElementById('adminMessagesList');

// Buttons
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('registerBtn').addEventListener('click', register);
document.getElementById('showRegisterBtn').addEventListener('click', showRegister);
document.getElementById('showLoginBtn').addEventListener('click', showLogin);
document.getElementById('logoutBtn').addEventListener('click', logout);

document.getElementById('quickPlayBtn').addEventListener('click', ()=> openQuickEdit('jouer'));
document.getElementById('quickHelpBtn').addEventListener('click', ()=> openQuickEdit('aide'));
document.getElementById('customMessageBtn').addEventListener('click', openMessageModal);
document.getElementById('sendCustomMessageBtn').addEventListener('click', sendCustomMessage);
document.getElementById('closeMessageModalBtn').addEventListener('click', closeMessageModal);

document.getElementById('mainNavBtn').addEventListener('click', ()=> showView('main'));
document.getElementById('adminNavBtn').addEventListener('click', ()=> attemptOpenAdmin());

document.getElementById('sendReplyBtn').addEventListener('click', sendReply);
document.getElementById('closeReplyModalBtn').addEventListener('click', closeReplyModal);

document.getElementById('adminBroadcastBtn').addEventListener('click', adminBroadcast);
document.getElementById('adminClearMessagesBtn').addEventListener('click', adminClearMessages);
document.getElementById('adminExportCsvBtn').addEventListener('click', adminExportUsersCSV);
document.getElementById('adminSetPassBtn').addEventListener('click', adminInitChangePassword);

document.getElementById('adminPassSubmitBtn').addEventListener('click', submitAdminPass);
document.getElementById('adminPassCancelBtn').addEventListener('click', ()=> closeModal('adminPassModal'));

const speechBtn = document.getElementById('speechBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener('result', (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById('customMessage').value = text;
    showSuccess("Message dicté !");
  });
  recognition.addEventListener('error', (e) => showError("Erreur vocale: " + e.error));
} else {
  if (speechBtn) speechBtn.style.display = 'none';
}

// Auth observer
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snapshot = await get(ref(db, 'users/' + user.uid));
    const userData = snapshot.val();
    if (userData) {
      isAdmin = userData.isAdmin || false;
      showMainApp(userData);
    } else {
      showError("Erreur de chargement du profil");
    }
  } else {
    showAuthPage();
  }
});

// ---------- VIEWS ----------
function showAuthPage(){ authPage.classList.remove('hidden'); mainApp.classList.add('hidden'); }
function showMainApp(userData){
  authPage.classList.add('hidden');
  mainApp.classList.remove('hidden');
  userNameElem.textContent = userData.username || 'Utilisateur';
  userAvatarElem.textContent = userData.username ? userData.username[0].toUpperCase() : 'U';
  if (isAdmin) {
    adminBadge.classList.remove('hidden');
    document.getElementById('adminNavBtn').style.display = 'block';
  } else {
    adminBadge.classList.add('hidden');
    document.getElementById('adminNavBtn').style.display = 'none';
  }
  loadMessages();
  if (isAdmin) loadUsers();
  registerServiceWorkerAndNotifications();
}

function showRegister(){ loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); }
function showLogin(){ registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); }

// ---------- AUTH ----------
async function register(){
  const email = registerEmail.value;
  const password = registerPassword.value;
  const username = registerUsername.value;
  if (!email || !password || !username){ showError("Tous les champs sont requis"); return; }
  if (password.length < 6){ showError("Mot de passe trop court"); return; }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await set(ref(db, 'users/' + userCredential.user.uid), { username, email, isAdmin:false, createdAt: Date.now() });
    showSuccess("Compte créé !");
    showLogin();
  } catch (err) { showError(err.message); }
}

async function login(){
  const email = loginEmail.value;
  const password = loginPassword.value;
  const rememberMe = document.getElementById('rememberMe').checked;
  if (!email || !password){ showError("Email et mot de passe requis"); return; }
  try {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) { showError(err.message); }
}

async function logout(){ try { await signOut(auth); } catch (e){ showError(e.message); } }

// ---------- MESSAGES ----------
async function sendQuickMessage(type, textOverride){
  if (!currentUser) return;
  const snapshot = await get(ref(db, 'users/' + currentUser.uid));
  const userData = snapshot.val();
  const messages = { jouer: textOverride || "Qui est dispo pour jouer ?", aide: textOverride || "J'ai besoin d'aide !" };
  await push(ref(db, 'messages'), { userId: currentUser.uid, username: userData.username, type, text: messages[type], timestamp: Date.now() });
  showSuccess("Message envoyé !");
}

function openQuickEdit(type){
  document.getElementById('customMessage').value = (type === 'jouer') ? "Qui est dispo pour jouer ?" : "J'ai besoin d'aide !";
  document.getElementById('messageModal').classList.add('active');
  document.getElementById('sendCustomMessageBtn').onclick = async () => {
    const text = document.getElementById('customMessage').value;
    if (!text || !currentUser) return;
    const snapshot = await get(ref(db,'users/'+currentUser.uid));
    const userData = snapshot.val();
    await push(ref(db,'messages'), { userId:currentUser.uid, username:userData.username, type:type, text:text, timestamp:Date.now() });
    closeMessageModal();
  };
}

function openMessageModal(){ document.getElementById('messageModal').classList.add('active'); document.getElementById('sendCustomMessageBtn').onclick = sendCustomMessage; document.getElementById('customMessage').value = ''; }
function closeMessageModal(){ document.getElementById('messageModal').classList.remove('active'); }

async function sendCustomMessage(){
  const text = document.getElementById('customMessage').value;
  if (!text || !currentUser) return;
  const snapshot = await get(ref(db,'users/'+currentUser.uid));
  const userData = snapshot.val();
  await push(ref(db,'messages'), { userId: currentUser.uid, username: userData.username, type: 'message', text: text, timestamp: Date.now() });
  closeMessageModal(); showSuccess("Message envoyé !");
}

// replies
let replyTargetId = null;
function openReplyModal(parentId, parentUsername){ replyTargetId = parentId; document.getElementById('replyText').value = `@${parentUsername} `; document.getElementById('replyModal').classList.add('active'); }
function closeReplyModal(){ replyTargetId = null; document.getElementById('replyModal').classList.remove('active'); }
async function sendReply(){
  const text = document.getElementById('replyText').value;
  if (!text || !currentUser || !replyTargetId) return;
  const snapshot = await get(ref(db,'users/'+currentUser.uid));
  const userData = snapshot.val();
  await push(ref(db,'messages'), { userId: currentUser.uid, username: userData.username, type: 'reply', text: text, timestamp: Date.now(), parentId: replyTargetId });
  closeReplyModal(); showSuccess("Réponse envoyée !");
}

// ---------- RENDER MESSAGES ----------
function loadMessages(){
  const messagesRef = ref(db,'messages');
  onValue(messagesRef, snapshot => {
    const msgs = [];
    snapshot.forEach(child => msgs.push({ id: child.key, ...child.val() }));
    msgs.sort((a,b) => b.timestamp - a.timestamp);
    const map = {}; msgs.forEach(m => map[m.id] = {...m, replies: []});
    const roots = [];
    msgs.forEach(m => { if (m.parentId && map[m.parentId]) map[m.parentId].replies.push(map[m.id]); else roots.push(map[m.id]); });
    const html = roots.map(m => renderMessageItem(m)).join('');
    messagesList.innerHTML = html;
    if (adminMessagesList) adminMessagesList.innerHTML = html;
    messagesList.scrollTop = 0;
  });
}

function renderMessageItem(m){
  const time = new Date(m.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const typeClass = m.type ? `type-${m.type}` : 'type-message';
  const repliesHtml = (m.replies && m.replies.length) ? `<div style="margin-left:12px;margin-top:8px;">${m.replies.map(r=>renderReplyInline(r)).join('')}</div>` : '';
  return `<div class="message-item" id="msg-${m.id}">
    <div class="message-header">
      <span class="message-author">${escapeHtml(m.username)}${m.userId===currentUser?.uid ? ' (moi)':''}</span>
      <span class="message-time">${time}</span>
    </div>
    <span class="message-type ${typeClass}">${(m.type||'message').toUpperCase()}</span>
    <div class="message-text">${escapeHtml(m.text)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn btn-secondary" onclick="openReplyFromList('${m.id}','${escapeJs(m.username)}')">↩ Répondre</button>
      <button class="btn btn-secondary" onclick="listenMessage('${escapeJs(m.text)}')">🔊 Écouter</button>
      ${isAdmin ? `<button class="delete-btn" onclick="deleteMessage('${m.id}')">Supprimer</button>` : ''}
    </div>
    ${repliesHtml}
  </div>`;
}

function renderReplyInline(r){
  const time = new Date(r.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  return `<div class="message-item" style="background:rgba(255,255,255,0.02);border-left:3px solid rgba(99,102,241,0.6);">
    <div class="message-header">
      <span class="message-author">${escapeHtml(r.username)}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-text">${escapeHtml(r.text)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn btn-secondary" onclick="openReplyFromList('${r.id}','${escapeJs(r.username)}')">↩ Répondre</button>
      <button class="btn btn-secondary" onclick="listenMessage('${escapeJs(r.text)}')">🔊 Écouter</button>
      ${isAdmin ? `<button class="delete-btn" onclick="deleteMessage('${r.id}')">Supprimer</button>` : ''}
    </div>
  </div>`;
}

window.openReplyFromList = (id, username) => openReplyModal(id, username);
window.listenMessage = (text) => {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } else showError("Synthèse vocale non supportée");
};

// ---------- ADMIN ----------
async function attemptOpenAdmin(){
  if (!currentUser) return showError("Connecte-toi d'abord");
  if (!isAdmin) return showError("Tu n'es pas admin");
  if (adminUnlocked) { showView('admin'); return; }
  openModal('adminPassModal');
}

async function submitAdminPass(){
  const pass = document.getElementById('adminPassInput').value;
  if (!pass) return showError("Mot de passe requis");
  closeModal('adminPassModal');
  const hash = await sha256Hex(pass);
  const snap = await get(ref(db,'admin/passwordHash'));
  const stored = snap.val();
  if (stored && stored === hash) {
    adminUnlocked = true; showView('admin'); showSuccess("Accès admin activé"); loadUsers();
  } else showError("Mot de passe admin incorrect");
}

async function loadUsers(){
  const usersRef = ref(db,'users');
  onValue(usersRef, snapshot => {
    const users = [];
    snapshot.forEach(child => users.push({ uid: child.key, ...child.val() }));
    const html = users.map(u => {
      const adminTag = u.isAdmin ? '<span class="admin-badge" style="font-size:10px;padding:2px 8px;">ADMIN</span>' : '';
      const actions = `<button class="btn btn-secondary" onclick="toggleAdmin('${u.uid}',${u.isAdmin})">${u.isAdmin ? 'Retirer admin' : 'Promouvoir'}</button>${u.uid!==currentUser.uid?` <button class="delete-btn" onclick="deleteUser('${u.uid}')">Supprimer</button>`:''}`;
      return `<div class="user-card"><div class="user-card-info"><div class="user-avatar">${u.username?u.username[0].toUpperCase():'U'}</div><div><div style="font-weight:600">${escapeHtml(u.username)}</div><div style="font-size:12px;color:rgba(255,255,255,0.5)">${escapeHtml(u.email)}</div>${adminTag}</div></div><div>${actions}</div></div>`;
    }).join('');
    usersList.innerHTML = html;
  });
}

window.toggleAdmin = async function(uid, currentFlag){
  if (!adminUnlocked) return showError("Accès admin requis");
  await update(ref(db, 'users/' + uid), { isAdmin: !currentFlag });
  showSuccess("Rôle mis à jour");
};

window.deleteUser = async function(uid){
  if (!adminUnlocked) return showError("Accès admin requis");
  if (!confirm("Supprimer cet utilisateur ?")) return;
  await remove(ref(db, 'users/' + uid));
  showSuccess("Utilisateur supprimé");
};

window.deleteMessage = async function(id){
  if (!adminUnlocked) return showError("Accès admin requis");
  if (!confirm("Supprimer ce message ?")) return;
  await remove(ref(db,'messages/'+id));
  showSuccess("Message supprimé");
};

async function adminBroadcast(){
  if (!adminUnlocked) return showError("Accès admin requis");
  const text = prompt("Message broadcast (envoyé par ADMIN) :");
  if (!text) return;
  await push(ref(db,'messages'), { userId: 'ADMIN', username: 'ADMIN', type: 'broadcast', text, timestamp: Date.now() });
  showSuccess("Broadcast envoyé");
}

async function adminClearMessages(){
  if (!adminUnlocked) return showError("Accès admin requis");
  if (!confirm("Vider tous les messages ? Cette action est irréversible.")) return;
  await remove(ref(db,'messages'));
  showSuccess("Messages vidés");
}

async function adminExportUsersCSV(){
  if (!adminUnlocked) return showError("Accès admin requis");
  const snap = await get(ref(db, 'users'));
  const users = []; snap.forEach(child => users.push({ uid: child.key, ...child.val() }));
  const header = ['uid','username','email','isAdmin','createdAt'];
  const csv = [header.join(',')].concat(users.map(u => [u.uid, `"${(u.username||'').replace(/"/g,'""')}"`, `"${(u.email||'').replace(/"/g,'""')}"`, u.isAdmin ? 'true' : 'false', u.createdAt || ''].join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'poteshub_users.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function adminInitChangePassword(){
  if (!currentUser) return showError("Connecte-toi");
  const newPass = prompt("Nouveau mot de passe admin (sera hashé) :");
  if (!newPass) return;
  if (!confirm("Action sensible : es-tu sûr ?")) return;
  const h = await sha256Hex(newPass);
  await set(ref(db,'admin/passwordHash'), h);
  showSuccess("Mot de passe admin initialisé");
}

// ---------- NOTIFICATIONS & SW ----------
async function registerServiceWorkerAndNotifications(){
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); console.log('SW registered'); } catch(e){ console.warn('SW reg fail', e); }
  }
  if (!messaging) return;
  if (!('Notification' in window)) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (VAPID_KEY && VAPID_KEY.indexOf('<') === -1) {
        try {
          const token = await getToken(messaging, { vapidKey: VAPID_KEY });
          console.log('FCM token:', token);
          if (currentUser) await set(ref(db,'fcmTokens/'+currentUser.uid), { token, createdAt: Date.now() });
        } catch(e){ console.warn('getToken fail', e); }
      } else console.warn('VAPID_KEY manquante');
    }
  } catch(e){ console.warn('Notif perm fail', e); }
  try {
    onMessage(messaging, payload => {
      console.log('FG message', payload);
      if (Notification.permission === 'granted') {
        const title = payload.notification?.title || 'PotesHub';
        const options = { body: payload.notification?.body || '', icon: payload.notification?.icon || '/icon-192.png' };
        navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.showNotification(title, options); else new Notification(title, options); });
      }
    });
  } catch(e){}
}

// ---------- UTIL ----------
function showView(view){ document.getElementById('mainView').classList.toggle('hidden', view!=='main'); document.getElementById('adminView').classList.toggle('hidden', view!=='admin'); document.getElementById('mainNavBtn').classList.toggle('active', view==='main'); document.getElementById('adminNavBtn').classList.toggle('active', view==='admin'); }

function showError(msg){ const e=document.getElementById('errorMsg'); e.textContent=msg; e.style.display='block'; setTimeout(()=>e.style.display='none',5000); }
function showSuccess(msg){ const e=document.getElementById('successMsg'); e.textContent=msg; e.style.display='block'; setTimeout(()=>e.style.display='none',3000); }

function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

function escapeHtml(unsafe){ if (!unsafe && unsafe!==0) return ''; return String(unsafe).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;"); }
function escapeJs(s){ if (!s && s!==0) return ''; return String(s).replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,' '); }

async function sha256Hex(message){ const msgUint8 = new TextEncoder().encode(message); const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b=>b.toString(16).padStart(2,'0')).join(''); }

// dictation
function startDictation(){ if (!recognition) return showError("Reconnaissance vocale non supportée"); try { recognition.start(); showSuccess("Parle maintenant..."); } catch(e){ showError("Impossible de démarrer la dictée"); } }
if (speechBtn) speechBtn.addEventListener('click', startDictation);

// mobile helpers: install prompt + scroll inputs
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; const btn = document.getElementById('installBtn'); if (btn) btn.style.display = 'block'; });
document.getElementById('installBtn').addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); const { outcome } = await deferredPrompt.userChoice; deferredPrompt = null; document.getElementById('installBtn').style.display = 'none'; });

// scroll inputs into view on focus (mobile)
(function(){ const inputs = document.querySelectorAll('input, textarea'); inputs.forEach(inp=>inp.addEventListener('focus', ()=> setTimeout(()=>{ try{ inp.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){} }, 300) )); const observer = new MutationObserver(muts=>{ muts.forEach(m=>{ if (m.type==='attributes' && m.attributeName==='class'){ const el = m.target; if (el.classList.contains('active')){ const first = el.querySelector('input, textarea'); if (first) setTimeout(()=>first.scrollIntoView({behavior:'smooth', block:'center'}),250); }}}); }); document.querySelectorAll('.modal').forEach(mod=>observer.observe(mod,{attributes:true})); })();

// expose helpers
window.sha256Hex = sha256Hex;
window.openAdminPassModal = () => openModal('adminPassModal');

// EOF
