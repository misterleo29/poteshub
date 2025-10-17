// firebase-messaging-sw.js - pour FCM notifications background
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDmsgNKyXAckhoHpdRSuZxYgR3DmzXWmd0",
  authDomain: "poteshub-8d37b.firebaseapp.com",
  databaseURL: "https://poteshub-8d37b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "poteshub-8d37b",
  storageBucket: "poteshub-8d37b.firebasestorage.app",
  messagingSenderId: "457001877075",
  appId: "1:457001877075:web:1e0d09aec0c02349db10a6"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || 'PotesHub';
  const options = { body: payload.notification?.body || '', icon: payload.notification?.icon || '/icon-192.png' };
  self.registration.showNotification(title, options);
});
