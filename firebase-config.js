// Configuración de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, enableNetwork, disableNetwork, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCRQSmVpcBLacEKmFuWuq-VZ3qtcoMg8Wc",
    authDomain: "rifa-web-7f2cd.firebaseapp.com",
    projectId: "rifa-web-7f2cd",
    storageBucket: "rifa-web-7f2cd.firebasestorage.app",
    messagingSenderId: "224519874815",
    appId: "1:224519874815:web:67976045b1d1df734fc4ca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exportar para usar en otros archivos
window.db = db;
window.collection = collection;
window.addDoc = addDoc;
window.getDocs = getDocs;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.doc = doc;
window.query = query;
window.orderBy = orderBy;
window.where = where;
window.enableNetwork = enableNetwork;
window.disableNetwork = disableNetwork;
window.limit = limit; 