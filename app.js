// app.js - PotesHub (v2) - enregistrement audio en Base64 (pas de Storage)
// IMPORTANT: Remplace VAPID_KEY par ta clé publique Web Push (Cloud Messaging -> Web push certificates)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence,
  browserLocalPersistence, browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getDatabase, ref, push, onValue, get, remove, update, query, orderByChild, limitToLast
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';

// ---------- CONFIG ----------
const firebaseConfig = {
  apiKey: "AIzaSyDmsgNKyXAckhoHpdRSuZxYgR3DmzXWmd0",
  authDomain: "poteshub-8d37b.firebaseapp.com",
  databaseURL: "https://poteshub-8d37b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "poteshub-8d37b",
  storageBucket: "poteshub-8d37b.firebasedatabase.app",
  messagingSenderId: "457001877075",
  appId: "1:457001877075:web:1e0d09aec0c02349db10a6"
};

// Colle ta VAPID public key ici
const VAPID_KEY = "BB17qG7_5I5vQUX8Dltmk0_GTbBB9avg-pUR7PMBHPpghVE6yybsle-FDapwWEdd3_xRp-3zMMlWl6ssqH792R0";

// ---------- INIT ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
let messaging;
try { messaging = getMessaging(app); } catch(e){ console.warn('messaging init failed', e); }

let currentUser = null;
let currentUserData = null;
let adminUnlocked = false;

// ---------- DOM references ----------
const $ = id => document.getElementById(id);
const ui = {
  authPage: $('authPage'),
  mainApp: $('mainApp'),

  // auth
  loginEmail: $('loginEmail'),
  loginPassword: $('loginPassword'),
  registerUsername: $('registerUsername'),
  registerEmail: $('registerEmail'),
  registerPassword: $('registerPassword'),
  loginForm: $('loginForm'),
  registerForm: $('registerForm'),

  // main
  userName: $('userName'),
  userAvatar: $('userAvatar'),
  userMood: $('userMood'),
  logoutBtn: $('logoutBtn'),
  roomSelect: $('roomSelect'),
  messagesList: $('messagesList'),
  messagesTitle: $('messagesTitle'),
  messageInput: $('messageInput'),
  sendBtn: $('sendBtn'),

  // controls
  btnQuickPlay: $('btnQuickPlay'),
  btnHelp: $('btnHelp'),
  btnPoll: $('btnPoll'),
  btnChallenge: $('btnChallenge'),
  openRecorderBtn: $('openRecorderBtn'),
  openDictBtn: $('openDictBtn'),
  btnMood: $('btnMood'),
  openProfileBtn: $('openProfileBtn'),
  openAdminBtn: $('openAdminBtn'),
  navAdmin: $('navAdmin'),

  // recorder modal
  recModal: $('recModal'),
  startRecBtn: $('startRecBtn'),
  stopRecBtn: $('stopRecBtn'),
  closeRecBtn: $('closeRecBtn'),
  recStatus: $('recStatus'),
  recPreview: $('recPreview'),

  // poll modal
  pollModal: $('pollModal'),
  pollQuestion: $('pollQuestion'),
  pollOpt1: $('pollOpt1'),
  pollOpt2: $('pollOpt2'),
  createPollBtn: $('createPollBtn'),
  closePollBtn: $('closePollBtn'),

  // challenge modal
  challengeModal: $('challengeModal'),
  challengeText: $('challengeText'),
  createChallengeBtn: $('createChallengeBtn'),
  closeChallengeBtn: $('closeChallengeBtn'),

  // profile modal
  profileModal: $('profileModal'),
  profileName: $('profileName'),
  profileBio: $('profileBio'),
  profileEmoji: $('profileEmoji'),
  saveProfileBtn: $('saveProfileBtn'),
  closeProfileBtn: $('closeProfileBtn'),

  // admin
  adminPassModal: $('adminPassModal'),
  adminPassInput: $('adminPassInput'),
  adminPassSubmitBtn: $('adminPassSubmitBtn'),
  adminPassCancelBtn: $('adminPassCancelBtn'),
  adminPanel: $('adminPanel'),
  admBroadcastBtn: $('admBroadcastBtn'),
  admPushBtn: $('admPushBtn'),
  admExportUsersBtn: $('admExportUsersBtn'),
  admExportTokensBtn: $('admExportTokensBtn'),
  admClearMessagesBtn: $('admClearMessagesBtn'),
  admSetPassBtn: $('admSetPassBtn'),
  adminUsersList: $('adminUsersList'),
  adminMessagesList: $('adminMessagesList'),
  closeAdminBtn: $('closeAdminBtn'),

  // feedback
  errorMsg: $('errorMsg'),
  successMsg: $('successMsg'),
};

// ---------- Event wiring ----------
$('loginBtn').addEventListener('click', login);
$('showRegisterBtn').addEventListener('click', ()=>{ ui.loginForm.classList.add('hidden'); ui.registerForm.classList.remove('hidden'); });
$('showLoginBtn').addEventListener('click', ()=>{ ui.registerForm.classList.add('hidden'); ui.loginForm.classList.remove('hidden'); });
$('registerBtn').addEventListener('click', register);
ui.logoutBtn.addEventListener('click', logout);

ui.sendBtn.addEventListener('click', sendMessage);
ui.messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

ui.btnQuickPlay.addEventListener('click', ()=> quickMessage('jouer'));
ui.btnHelp.addEventListener('click', ()=> quickMessage('aide'));
ui.btnPoll.addEventListener('click', ()=> openModal('pollModal'));
ui.btnChallenge.addEventListener('click', ()=> openModal('challengeModal'));

ui.openRecorderBtn.addEventListener('click', ()=> openModal('recModal'));
ui.openDictBtn.addEventListener('click', startDictation);
ui.btnMood.addEventListener('click', ()=> { const mood = prompt("Ton mood du jour"); if (mood) setMood(mood); });

ui.createPollBtn.addEventListener('click', createPoll);
ui.closePollBtn.addEventListener('click', ()=> closeModal('pollModal'));

ui.createChallengeBtn.addEventListener('click', createChallenge);
ui.closeChallengeBtn.addEventListener('click', ()=> closeModal('challengeModal'));

ui.openProfileBtn.addEventListener('click', openProfile);
ui.saveProfileBtn.addEventListener('click', saveProfile);
ui.closeProfileBtn.addEventListener('click', ()=> closeModal('profileModal'));

ui.adminPassSubmitBtn.addEventListener('click', submitAdminPass);
ui.adminPassCancelBtn.addEventListener('click', ()=> closeModal('adminPassModal'));
ui.openAdminBtn.addEventListener('click', ()=> openModal('adminPassModal'));

ui.admBroadcastBtn.addEventListener('click', adminBroadcast);
ui.admPushBtn.addEventListener('click', adminCreateNotificationNode);
ui.admExportUsersBtn.addEventListener('click', adminExportUsersCSV);
ui.admExportTokensBtn.addEventListener('click', adminExportTokens);
ui.admClearMessagesBtn.addEventListener('click', adminClearMessages);
ui.admSetPassBtn.addEventListener('click', adminInitChangePassword);
ui.closeAdminBtn.addEventListener('click', ()=> closeModal('adminPanel'));

// recorder
ui.startRecBtn.addEventListener('click', startRecording);
ui.stopRecBtn.addEventListener('click', stopRecording);
ui.closeRecBtn.addEventListener('click', ()=> closeModal('recModal'));

// ---------- Helpers ----------
function showError(msg){ ui.errorMsg.textContent = msg; ui.errorMsg.style.display = 'block'; setTimeout(()=> ui.errorMsg.style.display='none',5000); }
function showSuccess(msg){ ui.successMsg.textContent = msg; ui.successMsg.style.display = 'block'; setTimeout(()=> ui.successMsg.style.display='none',3000); }
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

function escapeHtml(s){ if (s === undefined || s === null) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function escapeJs(s){ if (!s) return ''; return String(s).replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,' '); }

// ---------- AUTH ----------
async function register(){
  const username = ui.registerUsername.value.trim();
  const email = ui.registerEmail.value.trim();
  const password = ui.registerPassword.value;
  if (!username || !email || !password) return showError("Remplis tous les champs");
  if (password.length < 6) return showError("Mot de passe >= 6");
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    await push(ref(db, 'users/' + res.user.uid), { username, email, isAdmin:false, createdAt: Date.now() });
    showSuccess("Compte créé, connecte-toi !");
    ui.registerForm.classList.add('hidden'); ui.loginForm.classList.remove('hidden');
  } catch (e){ showError(e.message); }
}

async function login(){
  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value;
  if (!email || !password) return showError("Email & mot de passe requis");
  try {
    const persistence = document.getElementById('rememberMe')?.checked ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e){ showError(e.message); }
}

async function logout(){
  try { await signOut(auth); } catch(e){ console.warn(e); }
}

// ---------- Auth state ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null; currentUserData = null;
    ui.authPage.classList.remove('hidden'); ui.mainApp.classList.add('hidden');
    return;
  }
  currentUser = user;
  // read profile
  const snap = await get(ref(db, 'users/' + user.uid));
  currentUserData = snap.val() || { username: 'Utilisateur', isAdmin:false };
  ui.userName.textContent = currentUserData.username || 'Utilisateur';
  ui.userAvatar.textContent = (currentUserData.username||'U')[0].toUpperCase();
  ui.userMood.textContent = currentUserData.mood || '—';
  ui.authPage.classList.add('hidden'); ui.mainApp.classList.remove('hidden');

  // admin UI
  if (currentUserData.isAdmin) {
    ui.openAdminBtn.style.display = 'inline-block';
    ui.navAdmin.style.display = 'block';
  } else {
    ui.openAdminBtn.style.display = 'none';
    ui.navAdmin.style.display = 'none';
  }

  // rooms & messages
  await loadRooms();
  attachMessagesListener();

  // notifications
  registerServiceWorkerAndNotifications();
});

// ---------- Rooms ----------
async function loadRooms(){
  const defaultRooms = [{ id:'general', name:'Général' }, { id:'gaming', name:'Gaming' }];
  const snap = await get(ref(db, 'rooms'));
  const rooms = snap.exists() ? Object.keys(snap.val()).map(k=>({ id:k, name: snap.val()[k].name || k })) : defaultRooms;
  if (!rooms.find(r=>r.id==='general')) rooms.unshift({id:'general',name:'Général'});
  if (!rooms.find(r=>r.id==='gaming')) rooms.push({id:'gaming',name:'Gaming'});
  ui.roomSelect.innerHTML = rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  ui.roomSelect.addEventListener('change', () => { attachMessagesListener(); });
}

// ---------- Messages: send & receive ----------
function getCurrentRoom(){ return ui.roomSelect.value || 'general'; }

async function sendMessage(){
  if (!currentUser) return showError("Connecte-toi");
  const text = ui.messageInput.value.trim();
  if (!text) return;
  const room = getCurrentRoom();
  const payload = {
    text,
    timestamp: Date.now(),
    username: currentUserData.username || 'Utilisateur',
    userId: currentUser.uid,
    type: 'message',
    room
  };
  await push(ref(db, 'messages'), payload);
  ui.messageInput.value = '';
  showSuccess("Message envoyé");
}

// Listen last 200 messages and display those in current room
function attachMessagesListener(){
  ui.messagesList.innerHTML = '<div style="color:rgba(255,255,255,0.5)">Chargement...</div>';
  const msgsQuery = query(ref(db, 'messages'), orderByChild('timestamp'), limitToLast(200));
  onValue(msgsQuery, snapshot => {
    const arr = [];
    snapshot.forEach(ch => {
      const v = ch.val(); v.id = ch.key;
      if (!v.room) v.room = 'general';
      if (v.room === getCurrentRoom()) arr.push(v);
    });
    arr.sort((a,b)=>a.timestamp - b.timestamp);
    ui.messagesList.innerHTML = arr.map(m => renderMessage(m)).join('');
    ui.messagesList.scrollTop = ui.messagesList.scrollHeight;
    // update admin panel messages
    renderAdminMessagesList(arr);
  });
}

function renderMessage(m){
  const t = new Date(m.timestamp).toLocaleString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  const isMine = currentUser && m.userId === currentUser.uid;
  const audioHtml = m.audioData ? `<div style="margin-top:8px;"><audio controls src="${m.audioData}"></audio></div>` : '';
  const pollHtml = m.poll ? renderPollInline(m.poll, m.pollId || '') : '';
  const challengeHtml = m.challenge ? `<div style="margin-top:8px;border-left:3px solid rgba(255,192,203,0.06);padding-left:8px;">Défi: ${escapeHtml(m.challenge.text)}</div>` : '';
  return `<div class="message-item" id="msg-${m.id}">
    <div class="message-header">
      <span class="message-author">${escapeHtml(m.username)}${isMine? ' (moi)':''}</span>
      <span class="message-time">${t}</span>
    </div>
    <div class="message-text">${escapeHtml(m.text || '')}</div>
    ${audioHtml}
    ${pollHtml}
    ${challengeHtml}
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button class="btn btn-secondary" onclick="openReplyPrompt('${m.id}','${escapeJs(m.username||'')}')">↩ Répondre</button>
      <button class="btn btn-secondary" onclick="speakText('${escapeJs(m.text||'')}')">🔊 Écouter</button>
      ${isMine ? `<button class="delete-btn" onclick="deleteMessage('${m.id}')">Supprimer</button>` : ''}
    </div>
  </div>`;
}

window.openReplyPrompt = async (msgId, uname) => {
  const reply = prompt(`Répondre à ${uname}:`);
  if (!reply || !currentUser) return;
  await push(ref(db, 'messages'), { text: reply, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, type:'reply', room:getCurrentRoom(), parentId: msgId });
  showSuccess("Réponse envoyée");
};

window.speakText = (text) => {
  if (!('speechSynthesis' in window)) return showError("Synthèse vocale non disponible");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
};

// ---------- Quick messages ----------
async function quickMessage(kind){
  if (!currentUser) return showError("Connecte-toi");
  const messages = { jouer: "Qui est dispo pour jouer ?", aide: "J'ai besoin d'aide !" };
  const text = messages[kind] || "Message rapide";
  await push(ref(db, 'messages'), { text, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, type: kind, room:getCurrentRoom() });
  showSuccess("Message rapide envoyé");
}

// ---------- Polls ----------
async function createPoll(){
  const q = ui.pollQuestion.value.trim();
  const o1 = ui.pollOpt1.value.trim() || 'Oui';
  const o2 = ui.pollOpt2.value.trim() || 'Non';
  if (!q) return showError("Question requise");
  const pollRef = push(ref(db, 'polls'), { question:q, options:[o1,o2], votes:{}, creator: currentUser.uid, createdAt: Date.now() });
  const pollObj = { pollId: pollRef.key, question:q, options:[o1,o2], votes:{} };
  await push(ref(db, 'messages'), { text: `Sondage: ${q}`, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, poll: pollObj, pollId: pollRef.key, room:getCurrentRoom() });
  closeModal('pollModal'); showSuccess("Sondage créé");
}

function renderPollInline(poll, pollId){
  if (!poll) return '';
  const counts = poll.options.map((opt, idx) => {
    const votes = poll.votes ? Object.values(poll.votes).filter(v=>v===idx).length : 0;
    return { opt, votes };
  });
  const optionsHtml = counts.map((c, idx) => `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
    <button class="btn btn-secondary" onclick="votePoll('${pollId}', ${idx})">${c.opt}</button>
    <div style="font-size:13px;color:rgba(255,255,255,0.7)">${c.votes} vote(s)</div>
  </div>`).join('');
  return `<div style="margin-top:10px;border-left:3px solid rgba(99,102,241,0.6);padding-left:8px;">${escapeHtml(poll.question)}${optionsHtml}</div>`;
}

window.votePoll = async (pollId, optionIdx) => {
  if (!pollId) return showError("Sondage introuvable");
  await update(ref(db, `polls/${pollId}/votes/${currentUser.uid}`), optionIdx);
  showSuccess("Vote enregistré");
};

// ---------- Challenges ----------
async function createChallenge(){
  const text = ui.challengeText.value.trim();
  if (!text) return showError("Écris un défi");
  const chRef = push(ref(db, 'challenges'), { text, creator: currentUser.uid, createdAt: Date.now(), acceptedBy: null });
  await push(ref(db, 'messages'), { text: `Défi: ${text}`, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, challenge:{ text, id: chRef.key }, room:getCurrentRoom() });
  closeModal('challengeModal'); showSuccess("Défi lancé");
}

// ---------- Mood & Profile ----------
async function setMood(text){
  if (!currentUser) return showError("Connecte-toi");
  await update(ref(db, `users/${currentUser.uid}`), { mood: text });
  await setUserMoodNode(currentUser.uid, text);
  ui.userMood.textContent = text;
  showSuccess("Mood partagé");
}
async function setUserMoodNode(uid, text){
  await push(ref(db, 'moods'), { uid, text, ts: Date.now(), username: currentUserData.username || '' });
}

function openProfile(){
  ui.profileName.value = currentUserData.username || '';
  ui.profileBio.value = currentUserData.bio || '';
  ui.profileEmoji.value = currentUserData.emoji || '';
  openModal('profileModal');
}

async function saveProfile(){
  const username = ui.profileName.value.trim() || currentUserData.username;
  const bio = ui.profileBio.value.trim() || '';
  const emoji = ui.profileEmoji.value.trim() || '';
  await update(ref(db, 'users/' + currentUser.uid), { username, bio, emoji });
  currentUserData.username = username; currentUserData.bio = bio; currentUserData.emoji = emoji;
  ui.userName.textContent = username;
  ui.userAvatar.textContent = username[0].toUpperCase();
  closeModal('profileModal'); showSuccess("Profil mis à jour");
}

// ---------- Audio recording -> Stored as Base64 in Realtime DB ----------
let mediaRecorder = null;
let audioChunks = [];
const MAX_AUDIO_BYTES = 2_200_000; // ~2.2MB recommended upper bound (adjust as needed)

async function startRecording(){
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      // size check
      if (blob.size > MAX_AUDIO_BYTES) {
        showError("Enregistrement trop long — réduis la durée (max ~2MB).");
        return;
      }
      // convert to dataURL (Base64)
      const dataUrl = await blobToDataURL(blob);
      // prepare message payload with audioData (data:image...)
      const payload = {
        text: '(Message vocal)',
        audioData: dataUrl,
        timestamp: Date.now(),
        username: currentUserData.username,
        userId: currentUser.uid,
        type: 'audio',
        room: getCurrentRoom()
      };
      await push(ref(db, 'messages'), payload);
      // show preview
      ui.recPreview.innerHTML = `<audio controls src="${dataUrl}"></audio>`;
      showSuccess("Enregistrement envoyé");
    };
    mediaRecorder.start();
    ui.recStatus.textContent = 'Enregistrement...';
    ui.startRecBtn.disabled = true;
    ui.stopRecBtn.disabled = false;
  } catch(e){ console.error(e); showError("Impossible d'accéder au micro"); }
}

function stopRecording(){
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  ui.recStatus.textContent = 'Traitement...';
  ui.startRecBtn.disabled = false;
  ui.stopRecBtn.disabled = true;
}

function blobToDataURL(blob){
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = err => rej(err);
    reader.readAsDataURL(blob); // gives "data:audio/webm;base64,AAAA..."
  });
}

// ---------- Dictation (SpeechRecognition) ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener('result', e => {
    const text = e.results[0][0].transcript;
    ui.messageInput.value = (ui.messageInput.value ? ui.messageInput.value + ' ' : '') + text;
    showSuccess("Dictée insérée");
  });
  recognition.addEventListener('error', e => showError("Erreur dictée: " + e.error));
}

function startDictation(){
  if (!recognition) return showError("Dictée non supportée");
  try { recognition.start(); showSuccess("Parle maintenant..."); } catch(e){ showError("Impossible de démarrer la dictée"); }
}

// ---------- Admin (password hashed) ----------
async function submitAdminPass(){
  const pass = ui.adminPassInput.value || '';
  closeModal('adminPassModal');
  if (!pass) return showError("Mot de passe requis");
  const hash = await sha256Hex(pass);
  const snap = await get(ref(db, 'admin/passwordHash'));
  if (snap.exists() && snap.val() === hash) {
    adminUnlocked = true;
    openModal('adminPanel');
    loadAdminUsers();
    loadAdminMessages();
    showSuccess("Accès admin accordé");
  } else showError("Mot de passe admin incorrect");
}

async function adminInitChangePassword(){
  if (!currentUser) return showError("Connecte-toi");
  const newPass = prompt("Nouveau mot de passe admin (sera hashé) :");
  if (!newPass) return;
  if (!confirm("Confirmer l'initialisation du mot de passe admin ?")) return;
  const h = await sha256Hex(newPass);
  await push(ref(db, 'admin'), { passwordHash: h }); // push to create node if not exists
  // better: set(ref(db, 'admin/passwordHash'), h);
  await setAdminPasswordHash(h);
  showSuccess("Mot de passe admin initialisé");
}
async function setAdminPasswordHash(h){
  await update(ref(db, 'admin'), { passwordHash: h });
}

// ---------- Admin utilities ----------
async function loadAdminUsers(){
  const snap = await get(ref(db,'users'));
  const users = snap.exists() ? Object.entries(snap.val()) : [];
  ui.adminUsersList.innerHTML = users.map(([uid,u]) => {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);margin-bottom:6px;">
      <div>
        <div style="font-weight:700">${escapeHtml(u.username||'')}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6)">${escapeHtml(u.email||'')}</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-secondary" onclick="adminToggleAdmin('${uid}', ${u.isAdmin? 'true' : 'false'})">${u.isAdmin? 'Retirer admin' : 'Promouvoir'}</button>
        <button class="delete-btn" onclick="adminDeleteUser('${uid}')">Supprimer</button>
      </div>
    </div>`;
  }).join('');
}

window.adminToggleAdmin = async (uid, cur) => {
  if (!adminUnlocked) return showError("Accès admin requis");
  await update(ref(db,'users/' + uid), { isAdmin: !cur });
  showSuccess("Rôle mis à jour");
  loadAdminUsers();
};

window.adminDeleteUser = async (uid) => {
  if (!adminUnlocked) return showError("Accès admin requis");
  if (!confirm("Supprimer cet utilisateur ?")) return;
  await remove(ref(db,'users/'+uid));
  showSuccess("Utilisateur supprimé");
  loadAdminUsers();
};

async function adminBroadcast(){
  if (!adminUnlocked) return showError("Accès admin requis");
  const text = prompt("Message broadcast à tous (s'affiche dans le chat):");
  if (!text) return;
  await push(ref(db,'messages'), { text, timestamp: Date.now(), username: 'ADMIN', userId: 'ADMIN', type:'broadcast', room:'general' });
  showSuccess("Broadcast envoyé");
}

async function adminCreateNotificationNode(){
  if (!adminUnlocked) return showError("Accès admin requis");
  const title = prompt("Titre de la notification:");
  const body = prompt("Message:");
  if (!title || !body) return;
  await push(ref(db, 'notifications'), { title, body, createdAt: Date.now(), by: currentUser.uid });
  showSuccess("Notification enregistrée (à envoyer via Cloud Function)");
}

async function adminExportUsersCSV(){
  if (!adminUnlocked) return showError("Accès admin requis");
  const snap = await get(ref(db,'users'));
  const users = snap.exists() ? Object.entries(snap.val()) : [];
  const header = ['uid','username','email','isAdmin','createdAt'];
  const rows = users.map(([uid,u]) => [uid, `"${(u.username||'').replace(/"/g,'""')}"`, `"${(u.email||'').replace(/"/g,'""')}"`, u.isAdmin? 'true':'false', u.createdAt || ''].join(','));
  const csv = [header.join(','), ...rows].join('\n');
  downloadBlob(csv, 'users.csv', 'text/csv;charset=utf-8;');
  showSuccess("CSV téléchargé");
}

async function adminExportTokens(){
  if (!adminUnlocked) return showError("Accès admin requis");
  const snap = await get(ref(db,'fcmTokens'));
  const tokens = snap.exists() ? Object.entries(snap.val()).map(([uid, obj]) => `${uid},${obj.token || ''}`) : [];
  const csv = ['uid,token', ...tokens].join('\n');
  downloadBlob(csv, 'fcm_tokens.csv', 'text/csv;charset=utf-8;');
  showSuccess("Tokens exportés");
}

async function adminClearMessages(){
  if (!adminUnlocked) return showError("Accès admin requis");
  if (!confirm("Vider tous les messages ?")) return;
  await remove(ref(db,'messages'));
  showSuccess("Messages supprimés");
}

function renderAdminMessagesList(arr){
  ui.adminMessagesList.innerHTML = arr.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);margin-bottom:6px;">
    <div style="flex:1"><strong>${escapeHtml(m.username)}</strong><div style="font-size:13px;color:rgba(255,255,255,0.6)">${escapeHtml(m.text||'')}</div></div>
    <div style="display:flex;gap:8px;"><button class="delete-btn" onclick="deleteMessage('${m.id}')">Supprimer</button></div>
  </div>`).join('');
}

// ---------- delete (owner or admin) ----------
window.deleteMessage = async (id) => {
  if (!currentUser) return showError("Connecte-toi");
  const snap = await get(ref(db,'messages/'+id));
  const m = snap.val();
  if (!m) return showError("Message introuvable");
  if (m.userId === currentUser.uid || adminUnlocked) {
    await remove(ref(db,'messages/'+id));
    showSuccess("Message supprimé");
  } else showError("Tu n'as pas le droit");
};

// ---------- Notifications (client) ----------
async function registerServiceWorkerAndNotifications(){
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); console.log('SW registered'); } catch(e){ console.warn('SW reg fail', e); }
  }
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (VAPID_KEY && VAPID_KEY.indexOf('<') === -1) {
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        console.log('FCM token', token);
        if (token && currentUser) {
          await update(ref(db, `fcmTokens/${currentUser.uid}`), { token, ts: Date.now() });
        }
      } else console.warn('VAPID_KEY not set');
    }
    onMessage(messaging, payload => {
      console.log('Foreground message', payload);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.showNotification(payload.notification?.title || 'PotesHub', { body: payload.notification?.body || '', icon: payload.notification?.icon || '/icon-192.png' });
        });
      }
    });
  } catch(e){ console.warn('notif err', e); }
}

// ---------- small utilities ----------
function downloadBlob(content, filename, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ---------- sha256 helper ----------
async function sha256Hex(message){
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}
window.sha256Hex = sha256Hex;

// ---------- final notes ----------
console.log('PotesHub app.js loaded — audio stored in Realtime DB as Base64 (dataURL)');

// EOF
