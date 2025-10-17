// app.js - PotesHub v2 (mobile-first, messages, rooms, audio, polls, admin tools)
// IMPORTANT: replace VAPID_KEY with your Firebase Cloud Messaging Web Push public key

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence,
  browserLocalPersistence, browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
  getDatabase, ref, set, push, onChildAdded, onValue, get, remove, update, query, orderByChild, equalTo
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
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

const VAPID_KEY = "BB17qG7_5I5vQUX8Dltmk0_GTbBB9avg-pUR7PMBHPpghVE6yybsle-FDapwWEdd3_xRp-3zMMlWl6ssqH792R0";

// ---------- INIT ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
let messaging;
try { messaging = getMessaging(app); } catch (e) { console.warn('messaging init failed', e); }

let currentUser = null;
let currentUserData = null;
let adminUnlocked = false;

// DOM
const ui = {
  authPage: document.getElementById('authPage'),
  mainApp: document.getElementById('mainApp'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  registerEmail: document.getElementById('registerEmail'),
  registerPassword: document.getElementById('registerPassword'),
  registerUsername: document.getElementById('registerUsername'),

  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),

  userName: document.getElementById('userName'),
  userAvatar: document.getElementById('userAvatar'),
  userMood: document.getElementById('userMood'),
  logoutBtn: document.getElementById('logoutBtn'),

  roomSelect: document.getElementById('roomSelect'),
  messagesList: document.getElementById('messagesList'),
  messagesTitle: document.getElementById('messagesTitle'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),

  btnQuickPlay: document.getElementById('btnQuickPlay'),
  btnHelp: document.getElementById('btnHelp'),
  btnPoll: document.getElementById('btnPoll'),
  btnChallenge: document.getElementById('btnChallenge'),
  openRecorderBtn: document.getElementById('openRecorderBtn'),
  openDictBtn: document.getElementById('openDictBtn'),
  btnMood: document.getElementById('btnMood'),
  openProfileBtn: document.getElementById('openProfileBtn'),
  openAdminBtn: document.getElementById('openAdminBtn'),
  navAdmin: document.getElementById('navAdmin'),

  // modals
  recModal: document.getElementById('recModal'),
  startRecBtn: document.getElementById('startRecBtn'),
  stopRecBtn: document.getElementById('stopRecBtn'),
  closeRecBtn: document.getElementById('closeRecBtn'),
  recStatus: document.getElementById('recStatus'),
  recPreview: document.getElementById('recPreview'),

  pollModal: document.getElementById('pollModal'),
  pollQuestion: document.getElementById('pollQuestion'),
  pollOpt1: document.getElementById('pollOpt1'),
  pollOpt2: document.getElementById('pollOpt2'),
  createPollBtn: document.getElementById('createPollBtn'),
  closePollBtn: document.getElementById('closePollBtn'),

  challengeModal: document.getElementById('challengeModal'),
  challengeText: document.getElementById('challengeText'),
  createChallengeBtn: document.getElementById('createChallengeBtn'),
  closeChallengeBtn: document.getElementById('closeChallengeBtn'),

  profileModal: document.getElementById('profileModal'),
  profileName: document.getElementById('profileName'),
  profileBio: document.getElementById('profileBio'),
  profileEmoji: document.getElementById('profileEmoji'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  closeProfileBtn: document.getElementById('closeProfileBtn'),

  adminPassModal: document.getElementById('adminPassModal'),
  adminPassInput: document.getElementById('adminPassInput'),
  adminPassSubmitBtn: document.getElementById('adminPassSubmitBtn'),
  adminPassCancelBtn: document.getElementById('adminPassCancelBtn'),

  adminPanel: document.getElementById('adminPanel'),
  admBroadcastBtn: document.getElementById('admBroadcastBtn'),
  admPushBtn: document.getElementById('admPushBtn'),
  admExportUsersBtn: document.getElementById('admExportUsersBtn'),
  admExportTokensBtn: document.getElementById('admExportTokensBtn'),
  admClearMessagesBtn: document.getElementById('admClearMessagesBtn'),
  admSetPassBtn: document.getElementById('admSetPassBtn'),
  adminUsersList: document.getElementById('adminUsersList'),
  adminMessagesList: document.getElementById('adminMessagesList'),
  closeAdminBtn: document.getElementById('closeAdminBtn'),

  errorMsg: document.getElementById('errorMsg'),
  successMsg: document.getElementById('successMsg')
};

// ---------- Event wiring ----------
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('showRegisterBtn').addEventListener('click', ()=>{ ui.loginForm.classList.add('hidden'); ui.registerForm.classList.remove('hidden'); });
document.getElementById('showLoginBtn').addEventListener('click', ()=>{ ui.registerForm.classList.add('hidden'); ui.loginForm.classList.remove('hidden'); });
document.getElementById('registerBtn').addEventListener('click', register);
ui.logoutBtn.addEventListener('click', logout);

ui.sendBtn.addEventListener('click', sendMessage);
ui.messageInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') sendMessage(); });

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

// admin lists (delegated)

// ---------- Helpers: UI ----------
function showError(msg){ ui.errorMsg.textContent = msg; ui.errorMsg.style.display = 'block'; setTimeout(()=> ui.errorMsg.style.display='none',5000); }
function showSuccess(msg){ ui.successMsg.textContent = msg; ui.successMsg.style.display = 'block'; setTimeout(()=> ui.successMsg.style.display='none',3000); }
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }

// ---------- Auth ----------
async function register(){
  const username = ui.registerUsername.value.trim();
  const email = ui.registerEmail.value.trim();
  const password = ui.registerPassword.value;
  if (!username || !email || !password) return showError("Remplis tous les champs");
  if (password.length < 6) return showError("Mot de passe >= 6");
  try {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    await set(ref(db, 'users/' + res.user.uid), { username, email, isAdmin:false, createdAt: Date.now() });
    showSuccess("Compte créé, connecte-toi !");
    ui.registerForm.classList.add('hidden'); ui.loginForm.classList.remove('hidden');
  } catch (e) { showError(e.message); }
}

async function login(){
  const email = ui.loginEmail.value.trim();
  const password = ui.loginPassword.value;
  if (!email || !password) return showError("Email & mot de passe requis");
  try {
    const persistence = document.getElementById('rememberMe').checked ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) { showError(e.message); }
}

async function logout(){
  try { await signOut(auth); } catch(e){ console.warn(e); }
}

// ---------- Auth state listener ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser = null; currentUserData = null;
    ui.authPage.classList.remove('hidden'); ui.mainApp.classList.add('hidden');
    return;
  }
  currentUser = user;
  // load user data
  const snap = await get(ref(db, 'users/' + user.uid));
  currentUserData = snap.val() || { username: 'Utilisateur', isAdmin:false };
  ui.userName.textContent = currentUserData.username || 'Utilisateur';
  ui.userAvatar.textContent = (currentUserData.username||'U')[0].toUpperCase();
  ui.userMood.textContent = currentUserData.mood || '—';
  ui.authPage.classList.add('hidden'); ui.mainApp.classList.remove('hidden');

  // admin button
  if (currentUserData.isAdmin) {
    document.getElementById('openAdminBtn').style.display = 'inline-block';
    ui.navAdmin.style.display = 'block';
  } else {
    document.getElementById('openAdminBtn').style.display = 'none';
    ui.navAdmin.style.display = 'none';
  }

  // load rooms & messages
  await loadRooms();
  attachMessagesListener();
  registerServiceWorkerAndNotifications();
});

// ---------- Rooms ----------
async function loadRooms(){
  // default rooms
  const defaultRooms = [{ id:'general', name:'Général' }, { id:'gaming', name:'Gaming' }];
  // dynamic rooms may be stored under /rooms
  const snap = await get(ref(db, 'rooms'));
  const rooms = snap.exists() ? Object.keys(snap.val()).map(k=>({ id:k, name: snap.val()[k].name || k })) : defaultRooms;
  // ensure defaults
  if (!rooms.find(r=>r.id==='general')) rooms.unshift({id:'general',name:'Général'});
  if (!rooms.find(r=>r.id==='gaming')) rooms.push({id:'gaming',name:'Gaming'});
  ui.roomSelect.innerHTML = rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  ui.roomSelect.addEventListener('change', () => { attachMessagesListener(); });
}

// ---------- Messages send / receive ----------
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

function attachMessagesListener(){
  // detach previous? simple: clear and rebind
  ui.messagesList.innerHTML = '<div style="color:rgba(255,255,255,0.5)">Chargement...</div>';
  const room = getCurrentRoom();
  // we listen to /messages and filter client-side to keep simple
  const messagesRef = ref(db, 'messages');
  // remove existing listeners by cloning node? We'll just set onValue
  onValue(messagesRef, snapshot => {
    const arr = [];
    snapshot.forEach(ch => {
      const v = ch.val(); v.id = ch.key;
      if (!v.room) v.room = 'general';
      if (v.room === room) arr.push(v);
    });
    arr.sort((a,b)=>a.timestamp - b.timestamp);
    ui.messagesList.innerHTML = arr.map(m => renderMessage(m)).join('');
    // attach delegated listeners for reply/listen/delete via global functions defined below
    ui.messagesList.scrollTop = ui.messagesList.scrollHeight;
    // also populate admin panel messages
    renderAdminMessages(arr);
  });
}

function renderMessage(m){
  const t = new Date(m.timestamp).toLocaleString('fr-FR', {hour:'2-digit', minute:'2-digit'});
  const isMine = currentUser && m.userId === currentUser.uid;
  const audioHtml = m.audioUrl ? `<div style="margin-top:8px;"><audio controls src="${m.audioUrl}"></audio></div>` : '';
  const pollHtml = m.poll ? renderPollInline(m.poll, m.id) : '';
  const challengeHtml = m.challenge ? `<div style="margin-top:8px;border-left:3px solid rgba(255,192,203,0.06);padding-left:8px;">Défi: ${escapeHtml(m.challenge.text)} ${m.challenge.accepted ? '(accepté)':''}</div>` : '';
  return `<div class="message-item" id="msg-${m.id}">
    <div class="message-header">
      <span class="message-author">${escapeHtml(m.username)}${isMine? ' (moi)':''}</span>
      <span class="message-time">${t}</span>
    </div>
    <div class="message-text">${escapeHtml(m.text||'')}</div>
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

// ---------- Quick messages (prebuilt) ----------
async function quickMessage(kind){
  if (!currentUser) return showError("Connecte-toi");
  const messages = {
    jouer: "Qui est dispo pour jouer ?",
    aide: "J'ai besoin d'aide !"
  };
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
  const poll = { question:q, options:[o1,o2], votes: {} , creator: currentUser.uid, createdAt: Date.now() };
  const pollRef = push(ref(db, 'polls'), poll);
  // also push as a message so it appears in chat
  await push(ref(db,'messages'), { text: `Sondage: ${q}`, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, pollId: pollRef.key, poll, room:getCurrentRoom() });
  closeModal('pollModal'); showSuccess("Sondage créé");
}

function renderPollInline(poll, messageId){
  // render options & counts; user can vote
  const counts = poll.options.map((opt, idx) => {
    const votes = poll.votes ? Object.values(poll.votes).filter(v=>v===idx).length : 0;
    return { opt, votes };
  });
  const optionsHtml = counts.map((c, idx) => `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
      <button class="btn btn-secondary" onclick="votePoll('${messageId}','${poll.pollId||''}', ${idx})">${c.opt}</button>
      <div style="font-size:13px;color:rgba(255,255,255,0.7)">${c.votes} vote(s)</div>
    </div>`).join('');
  return `<div style="margin-top:10px;border-left:3px solid rgba(99,102,241,0.6);padding-left:8px;">${escapeHtml(poll.question)}${optionsHtml}</div>`;
}

window.votePoll = async (messageId, pollId, optionIdx) => {
  // pollId may be stored at poll.pollId or in message: we attempt to find poll
  // If pollId not passed, search message for pollId
  let realPollId = pollId;
  if (!realPollId) {
    // attempt to get message and its pollId
    const snap = await get(ref(db, 'messages/' + messageId));
    const m = snap.val();
    if (m && m.pollId) realPollId = m.pollId;
  }
  if (!realPollId) return showError("Poll introuvable");
  await update(ref(db, `polls/${realPollId}/votes/${currentUser.uid}`), optionIdx);
  showSuccess("Vote enregistré");
};

// ---------- Challenges ----------
async function createChallenge(){
  const text = ui.challengeText.value.trim();
  if (!text) return showError("Écris un défi");
  const payload = { text, creator: currentUser.uid, createdAt: Date.now(), acceptedBy:null };
  const chRef = push(ref(db, 'challenges'), payload);
  // push message
  await push(ref(db, 'messages'), { text: `Défi: ${text}`, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, challenge: payload, room:getCurrentRoom(), challengeId: chRef.key });
  closeModal('challengeModal'); showSuccess("Défi lancé");
}

// ---------- Mood & Profile ----------
async function setMood(text){
  if (!currentUser) return showError("Connecte-toi");
  await set(ref(db, `moods/${currentUser.uid}`), { text, ts: Date.now(), username: currentUserData.username });
  ui.userMood.textContent = text;
  showSuccess("Mood partagé");
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
  closeModal('profileModal');
  showSuccess("Profil mis à jour");
}

// ---------- Audio recording & upload ----------
let mediaRecorder = null;
let audioChunks = [];
async function startRecording(){
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const filePath = `audio/${currentUser.uid}/${Date.now()}.webm`;
      const storageRef = sRef(storage, filePath);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      // push message with audioUrl
      await push(ref(db, 'messages'), { text: `(Message vocal)`, audioUrl: url, timestamp: Date.now(), username: currentUserData.username, userId: currentUser.uid, room:getCurrentRoom() });
      showSuccess("Enregistrement envoyé");
      ui.recPreview.innerHTML = `<audio controls src="${url}"></audio>`;
    };
    mediaRecorder.start();
    ui.recStatus.textContent = 'Enregistrement...';
    ui.startRecBtn.disabled = true;
    ui.stopRecBtn.disabled = false;
  } catch (e) { showError("Impossible d'accéder au micro"); console.error(e); }
}

function stopRecording(){
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  ui.recStatus.textContent = 'Téléversement en cours...';
  ui.startRecBtn.disabled = false;
  ui.stopRecBtn.disabled = true;
}
window.startRecording = startRecording;
window.stopRecording = stopRecording;

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
  recognition.addEventListener('error', (e)=> showError("Erreur dictée: "+e.error));
}

function startDictation(){
  if (!recognition) return showError("Dictée non supportée");
  try { recognition.start(); showSuccess("Parle maintenant..."); } catch(e) { showError("Impossible de démarrer la dictée"); }
}

// ---------- Admin ----------

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
  await set(ref(db,'admin/passwordHash'), h);
  showSuccess("Mot de passe admin initialisé");
}

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
  // create a node under /notifications that server/cloudfunction can read and send FCM
  await push(ref(db, 'notifications'), { title, body, createdAt: Date.now(), by: currentUser.uid });
  showSuccess("Notification enregistrée (à envoyer via Cloud Function ou serveur)");
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

// admin messages list
async function loadAdminMessages(){
  const snap = await get(ref(db,'messages'));
  const arr = [];
  if (snap.exists()) {
    snap.forEach(ch => arr.push({ id: ch.key, ...ch.val() }));
  }
  ui.adminMessagesList.innerHTML = arr.map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);margin-bottom:6px;">
    <div style="flex:1"><strong>${escapeHtml(m.username)}</strong><div style="font-size:13px;color:rgba(255,255,255,0.6)">${escapeHtml(m.text||'')}</div></div>
    <div style="display:flex;gap:8px;"><button class="delete-btn" onclick="deleteMessage('${m.id}')">Supprimer</button></div>
  </div>`).join('');
}

// ---------- deletion (admin or owner) ----------
window.deleteMessage = async (id) => {
  // allow owner or adminUnlocked
  if (!currentUser) return showError("Connecte-toi");
  const snap = await get(ref(db,'messages/'+id));
  const m = snap.val();
  if (!m) return showError("Message introuvable");
  if (m.userId === currentUser.uid || adminUnlocked) {
    await remove(ref(db,'messages/'+id));
    showSuccess("Message supprimé");
  } else showError("Tu n'as pas le droit");
};

// ---------- utility & helpers ----------
function downloadBlob(content, filename, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function escapeHtml(s){ if (s === undefined || s === null) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function escapeJs(s){ if (!s) return ''; return String(s).replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,' '); }

// ---------- Messages -> admin view render ----------
function renderAdminMessages(arr){ /* populate admin messages in panel for quick moderation */ loadAdminMessages(); }

// ---------- Notifications: register token (client) ----------
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
          await set(ref(db, `fcmTokens/${currentUser.uid}`), { token, ts: Date.now() });
        }
      } else console.warn('VAPID_KEY not set');
    }
    onMessage(messaging, payload => {
      console.log('Foreground message', payload);
      // show notification via service worker if available
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.showNotification(payload.notification?.title || 'PotesHub', { body: payload.notification?.body || '', icon: payload.notification?.icon || '/icon-192.png' });
        });
      }
    });
  } catch (e) { console.warn('notif err', e); }
}

// ---------- sha256 helper ----------
async function sha256Hex(message){
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

// ---------- admin helper: init password (exposed) ----------
window.adminInitChangePassword = adminInitChangePassword;

// ---------- load admin lists periodically if open ----------
function whenAdminOpenUpdate(){
  if (document.getElementById('adminPanel').classList.contains('active')) {
    loadAdminUsers(); loadAdminMessages();
  }
}
setInterval(whenAdminOpenUpdate, 5000);

// ---------- small helpers: polls listener for update (optional) ----------
onValue(ref(db, 'polls'), snap => {
  // nothing extra: votes updates are in DB and are displayed in message rendering via poll stored in message snapshot at creation.
  // optionally we could update messages to show latest counts by merging poll data into messages, but to keep simple we rely on clients to show polls when created.
});

// ---------- end of file ----------
console.log('app.js loaded — PotesHub v2');
