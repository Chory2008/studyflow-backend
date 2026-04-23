/* =============================================
   STUDYFLOW AI — script.js
   ============================================= */

// ══════════════════════════════════════════════
// 🔥 FIREBASE CONFIG — reemplaza con los tuyos
// ══════════════════════════════════════════════
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBMEhRj-GIXLkV6DhPpz-oIfaVhNwQaGfw",
  authDomain: "studyflow-web-40381.firebaseapp.com",
  projectId: "studyflow-web-40381",
  storageBucket: "studyflow-web-40381.firebasestorage.app",
  messagingSenderId: "198093361501",
  appId: "1:198093361501:web:2352e3e0dc51574a5118b4",
  measurementId: "G-SRBJH7BTE1"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ══════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════
let currentUser = null;
let allTasks    = [];
let chatHistory = [];
let currentFilter = "all";
let currentView   = "dashboard";
let unsubscribeTasks = null;

// ══════════════════════════════════════════════
// PARTÍCULAS (canvas)
// ══════════════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById("particles");
  const ctx    = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function makeParticle() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r:  Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.5 ? "#00f5ff" : "#bf5fff"
    };
  }

  for (let i = 0; i < 80; i++) particles.push(makeParticle());

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    });
    // Connect nearby particles
    ctx.globalAlpha = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.strokeStyle = "#00f5ff";
          ctx.globalAlpha = (1 - dist/100) * 0.08;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ══════════════════════════════════════════════
// AUTH STATE OBSERVER
// ══════════════════════════════════════════════
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    initApp(user);
  } else {
    currentUser = null;
    showScreen("login");
    if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  }
});

// ══════════════════════════════════════════════
// AUTH FUNCTIONS
// ══════════════════════════════════════════════
async function loginUser() {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) return showAuthMsg("Completa todos los campos", "error");

  setLoading("btn-login", true);
  try {
    await auth.signInWithEmailAndPassword(email, password);
    showAuthMsg("¡Bienvenido de vuelta! 🎉", "success");
  } catch (e) {
    showAuthMsg(firebaseError(e.code), "error");
  }
  setLoading("btn-login", false);
}

async function registerUser() {
  const name     = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!name || !email || !password) return showAuthMsg("Completa todos los campos", "error");
  if (password.length < 6) return showAuthMsg("La contraseña debe tener mínimo 6 caracteres", "error");

  setLoading("btn-register", true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await db.collection("users").doc(cred.user.uid).set({
      name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp(), streak: 0
    });
    showAuthMsg("¡Cuenta creada! Entrando...", "success");
  } catch (e) {
    showAuthMsg(firebaseError(e.code), "error");
  }
  setLoading("btn-register", false);
}

async function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    showAuthMsg(firebaseError(e.code), "error");
  }
}

async function logoutUser() {
  if (unsubscribeTasks) { unsubscribeTasks(); unsubscribeTasks = null; }
  await auth.signOut();
  allTasks = [];
  chatHistory = [];
  showToast("Sesión cerrada", "info");
}

// ══════════════════════════════════════════════
// APP INIT
// ══════════════════════════════════════════════
function initApp(user) {
  showScreen("app");

  // User info
  const name = user.displayName || user.email.split("@")[0];
  document.getElementById("user-display-name").textContent = name;
  document.getElementById("user-avatar").textContent = name.charAt(0).toUpperCase();
  updateGreeting(name);

  // Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Quotes
  newQuote();

  // Load tasks from Firestore (realtime)
  listenTasks(user.uid);

  // Render week chart & achievements
  renderWeekChart();
  renderAchievements();

  // Nav listeners
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      switchView(view);
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      closeSidebarMobile();
    });
  });

  // Filter buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // Tab switcher
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("panel-login").classList.toggle("hidden", tab !== "login");
      document.getElementById("panel-register").classList.toggle("hidden", tab !== "register");
      document.getElementById("auth-msg").textContent = "";
    });
  });
}

// ══════════════════════════════════════════════
// FIRESTORE — TASKS
// ══════════════════════════════════════════════
function listenTasks(uid) {
  unsubscribeTasks = db.collection("tasks")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      allTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderTasks();
      renderRecentTasks();
      updateStats();
    }, err => {
      // If index needed, fallback without orderBy
      unsubscribeTasks = db.collection("tasks")
        .where("uid", "==", uid)
        .onSnapshot(snap => {
          allTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          allTasks.sort((a,b)=> (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
          renderTasks();
          renderRecentTasks();
          updateStats();
        });
    });
}

async function saveTask() {
  const id       = document.getElementById("edit-task-id").value;
  const title    = document.getElementById("task-title").value.trim();
  const desc     = document.getElementById("task-desc").value.trim();
  const priority = document.getElementById("task-priority").value;
  const due      = document.getElementById("task-due").value;
  const subject  = document.getElementById("task-subject").value.trim();

  if (!title) return showToast("Escribe un título para la tarea", "error");

  const data = {
    title, desc, priority, due, subject,
    uid: currentUser.uid,
    done: false,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (id) {
      await db.collection("tasks").doc(id).update(data);
      showToast("Tarea actualizada ✓", "success");
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("tasks").add(data);
      showToast("Tarea creada 🚀", "success");
    }
    closeTaskModal();
  } catch (e) {
    showToast("Error al guardar: " + e.message, "error");
  }
}

async function toggleDone(id, current) {
  try {
    await db.collection("tasks").doc(id).update({ done: !current });
    showToast(!current ? "Tarea completada 🎉" : "Tarea reabierta", !current ? "success" : "info");
  } catch (e) {
    showToast("Error al actualizar", "error");
  }
}

async function deleteTask(id) {
  if (!confirm("¿Eliminar esta tarea?")) return;
  try {
    await db.collection("tasks").doc(id).delete();
    showToast("Tarea eliminada", "info");
  } catch (e) {
    showToast("Error al eliminar", "error");
  }
}

function editTask(task) {
  document.getElementById("modal-title").innerHTML = '<i class="fas fa-pen"></i> Editar Tarea';
  document.getElementById("edit-task-id").value   = task.id;
  document.getElementById("task-title").value     = task.title;
  document.getElementById("task-desc").value      = task.desc || "";
  document.getElementById("task-priority").value  = task.priority || "medium";
  document.getElementById("task-due").value       = task.due || "";
  document.getElementById("task-subject").value   = task.subject || "";
  document.getElementById("task-modal").classList.remove("hidden");
}

// ══════════════════════════════════════════════
// RENDER TASKS
// ══════════════════════════════════════════════
function renderTasks() {
  const container = document.getElementById("tasks-container");
  let filtered = [...allTasks];

  if (currentFilter === "pending") filtered = filtered.filter(t => !t.done);
  else if (currentFilter === "done") filtered = filtered.filter(t => t.done);
  else if (currentFilter === "high") filtered = filtered.filter(t => t.priority === "high");

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state full">
        <i class="fas fa-clipboard-list"></i>
        <p>Sin tareas en esta categoría</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(t => `
    <div class="task-card priority-${t.priority} ${t.done ? "done-card" : ""}">
      <div class="task-card-header">
        <span class="task-card-title ${t.done ? "done" : ""}">${escHtml(t.title)}</span>
        <div class="task-actions">
          <button class="task-action-btn check" title="${t.done ? "Reabrir" : "Completar"}"
            onclick='toggleDone("${t.id}", ${t.done})'>
            <i class="fas ${t.done ? "fa-rotate-left" : "fa-check"}"></i>
          </button>
          <button class="task-action-btn edit" title="Editar"
            onclick='editTask(${JSON.stringify(t).split("'").join("&#39;")})'>
            <i class="fas fa-pen"></i>
          </button>
          <button class="task-action-btn del" title="Eliminar"
            onclick='deleteTask("${t.id}")'>
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      ${t.desc ? `<p class="task-card-desc">${escHtml(t.desc)}</p>` : ""}
      <div class="task-card-meta">
        <span class="task-tag tag-priority-${t.priority}">
          ${{high:"🔴 Alta",medium:"🟡 Media",low:"🟢 Baja"}[t.priority]}
        </span>
        ${t.subject ? `<span class="task-tag tag-subject"><i class="fas fa-book-open"></i> ${escHtml(t.subject)}</span>` : ""}
        ${t.due    ? `<span class="task-tag tag-due"><i class="fas fa-calendar"></i> ${t.due}</span>` : ""}
        ${t.done   ? `<span class="task-tag tag-done">✓ Completada</span>` : ""}
      </div>
    </div>`).join("");
}

function renderRecentTasks() {
  const el = document.getElementById("recent-tasks-list");
  const recent = allTasks.slice(0, 5);
  if (!recent.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Sin tareas aún</p></div>`;
    return;
  }
  el.innerHTML = recent.map(t => `
    <div class="recent-task-item">
      <span class="task-status-dot ${t.done ? "done" : "pending"}"></span>
      <span class="recent-task-title ${t.done ? "done" : ""}">${escHtml(t.title)}</span>
      <span class="task-tag tag-priority-${t.priority}" style="font-size:10px">
        ${{high:"Alta",medium:"Media",low:"Baja"}[t.priority]}
      </span>
    </div>`).join("");
}

// ══════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════
function updateStats() {
  const total   = allTasks.length;
  const done    = allTasks.filter(t => t.done).length;
  const pending = total - done;
  const pct     = total ? Math.round((done/total)*100) : 0;

  document.getElementById("stat-total").textContent   = total;
  document.getElementById("stat-done").textContent    = done;
  document.getElementById("stat-pending").textContent = pending;
  document.getElementById("stat-streak").textContent  = calcStreak();

  document.getElementById("progress-pct").textContent = pct + "%";
  document.getElementById("progress-bar").style.width = pct + "%";

  // Donut
  const circ = 2 * Math.PI * 50;
  document.getElementById("donut-pct").textContent = pct + "%";
  const doneArc    = (done/Math.max(total,1)) * circ;
  const pendingArc = (pending/Math.max(total,1)) * circ;
  document.getElementById("donut-done").setAttribute("stroke-dasharray", `${doneArc} ${circ - doneArc}`);
  const doneOffset = -(done/Math.max(total,1)) * circ;
  document.getElementById("donut-pending").setAttribute("stroke-dasharray", `${pendingArc} ${circ - pendingArc}`);
  document.getElementById("donut-pending").setAttribute("transform", `rotate(${(done/Math.max(total,1))*360 - 90} 60 60)`);
}

function calcStreak() {
  // Simple streak: days with at least one completed task in last N days
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const hasActivity = allTasks.some(t => {
      if (!t.updatedAt) return false;
      const td = new Date(t.updatedAt.seconds * 1000).toISOString().slice(0,10);
      return td === ds && t.done;
    });
    if (hasActivity) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ══════════════════════════════════════════════
// WEEK CHART
// ══════════════════════════════════════════════
function renderWeekChart() {
  const days = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const today = new Date().getDay();
  const vals = days.map((_, i) => {
    const dayTasks = allTasks.filter(t => {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt.seconds * 1000);
      return d.getDay() === i;
    });
    return dayTasks.length;
  });
  const max = Math.max(...vals, 1);

  document.getElementById("week-chart").innerHTML = days.map((d,i) => `
    <div class="bar-wrap">
      <div class="bar" data-val="${vals[i]}"
        style="height:${Math.max((vals[i]/max)*90,4)}%;${i===today?"background:linear-gradient(180deg,var(--neon-purple),rgba(191,95,255,0.3))":""}">
      </div>
      <span class="bar-label">${d}</span>
    </div>`).join("");
}

// ══════════════════════════════════════════════
// ACHIEVEMENTS
// ══════════════════════════════════════════════
function renderAchievements() {
  const achievements = [
    { icon:"🚀", name:"Primer Vuelo", desc:"Crea tu primera tarea", check:() => allTasks.length >= 1 },
    { icon:"⚡", name:"Productivo", desc:"Completa 5 tareas", check:() => allTasks.filter(t=>t.done).length >= 5 },
    { icon:"🔥", name:"En Racha", desc:"3 días consecutivos", check:() => calcStreak() >= 3 },
    { icon:"🧠", name:"Estudioso", desc:"Usa el Chat de IA", check:() => chatHistory.length > 0 },
    { icon:"🏆", name:"Maestro", desc:"Completa 20 tareas", check:() => allTasks.filter(t=>t.done).length >= 20 },
    { icon:"💎", name:"Perfecto", desc:"100% de tareas completas", check:() => allTasks.length > 0 && allTasks.every(t=>t.done) },
  ];

  document.getElementById("achievements-grid").innerHTML = achievements.map(a => `
    <div class="achievement ${a.check() ? "" : "locked"}">
      <span class="achievement-icon">${a.icon}</span>
      <div class="achievement-info">
        <span class="achievement-name">${a.name}</span>
        <span class="achievement-desc">${a.desc}</span>
      </div>
    </div>`).join("");
}

// ══════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════
async function sendMessage() {
  const input = document.getElementById("chat-input");
  const msg   = input.value.trim();
  if (!msg) return;

  // Hide suggested prompts after first message
  document.getElementById("suggested-prompts").style.display = "none";

  appendMsg(msg, "user");
  input.value = "";
  input.style.height = "auto";

  const typingId = appendTyping();
  document.getElementById("btn-send").disabled = true;

  chatHistory.push({ role:"user", content:msg });

  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ messages: chatHistory })
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    const reply = data.reply || data.content || "Sin respuesta";

    removeTyping(typingId);
    appendMsg(reply, "ai");
    chatHistory.push({ role:"assistant", content:reply });

    // Unlock achievement
    renderAchievements();
  } catch (e) {
    removeTyping(typingId);
    appendMsg("⚠️ No puedo conectar al servidor. Asegúrate de que `server.js` esté corriendo en el puerto 3000. Ejecuta: `node server.js`", "ai");
  }

  document.getElementById("btn-send").disabled = false;
  scrollChat();
}

function appendMsg(text, who) {
  const msgs = document.getElementById("chat-messages");
  const avatarContent = who === "ai"
    ? '<i class="fas fa-robot"></i>'
    : (currentUser?.displayName || "U").charAt(0).toUpperCase();

  const div = document.createElement("div");
  div.className = `msg ${who}-msg`;
  div.innerHTML = `
    <div class="msg-avatar">${avatarContent}</div>
    <div class="msg-bubble">${formatMsgText(text)}</div>`;
  msgs.appendChild(div);
  scrollChat();
  return div;
}

function appendTyping() {
  const msgs = document.getElementById("chat-messages");
  const id   = "typing-" + Date.now();
  const div  = document.createElement("div");
  div.id = id;
  div.className = "msg ai-msg";
  div.innerHTML = `
    <div class="msg-avatar"><i class="fas fa-robot"></i></div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  msgs.appendChild(div);
  scrollChat();
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollChat() {
  const msgs = document.getElementById("chat-messages");
  msgs.scrollTop = msgs.scrollHeight;
}

function formatMsgText(text) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.*?)\*/g,"<em>$1</em>")
    .replace(/`(.*?)`/g,"<code>$1</code>")
    .replace(/\n/g,"<br>");
}

function sendPromptChip(btn) {
  document.getElementById("chat-input").value = btn.textContent;
  sendMessage();
}

function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function clearChat() {
  chatHistory = [];
  document.getElementById("chat-messages").innerHTML = `
    <div class="msg ai-msg intro-msg">
      <div class="msg-avatar"><i class="fas fa-robot"></i></div>
      <div class="msg-bubble">
        <p>Chat limpiado. ¿En qué puedo ayudarte? 🧠</p>
      </div>
    </div>`;
  document.getElementById("suggested-prompts").style.display = "flex";
}

// ══════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════
function openTaskModal() {
  document.getElementById("modal-title").innerHTML = '<i class="fas fa-plus-circle"></i> Nueva Tarea';
  document.getElementById("edit-task-id").value = "";
  document.getElementById("task-title").value = "";
  document.getElementById("task-desc").value = "";
  document.getElementById("task-priority").value = "medium";
  document.getElementById("task-due").value = "";
  document.getElementById("task-subject").value = "";
  document.getElementById("task-modal").classList.remove("hidden");
}

function closeTaskModal() {
  document.getElementById("task-modal").classList.add("hidden");
}

function closeModalOut(e) {
  if (e.target === document.getElementById("task-modal")) closeTaskModal();
}

// ══════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════
function switchView(view) {
  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
    v.classList.add("hidden");
    v.style.display = "none";
  });
  const el = document.getElementById("view-" + view);
  if (el) {
    el.style.display = "block";
    el.classList.add("active");
    el.classList.remove("hidden");
  }
  currentView = view;

  // Update nav
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  // Side effects
  if (view === "stats") { renderWeekChart(); renderAchievements(); updateStats(); }
  if (view === "dashboard") updateStats();
}

// ══════════════════════════════════════════════
// SIDEBAR MOBILE
// ══════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}
function closeSidebarMobile() {
  if (window.innerWidth <= 900)
    document.getElementById("sidebar").classList.remove("open");
}

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════
function showScreen(which) {
  document.getElementById("screen-login").classList.toggle("active", which === "login");
  document.getElementById("screen-login").classList.toggle("hidden", which !== "login");
  document.getElementById("screen-app").classList.toggle("active", which === "app");
  document.getElementById("screen-app").classList.toggle("hidden", which !== "app");
}

// ══════════════════════════════════════════════
// CLOCK & GREETING
// ══════════════════════════════════════════════
function updateClock() {
  const now = new Date();
  document.getElementById("live-clock").textContent =
    now.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function updateGreeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches";
  document.getElementById("greeting-text").textContent = `${g}, ${name} 👋`;
}

// ══════════════════════════════════════════════
// QUOTES
// ══════════════════════════════════════════════
const QUOTES = [
  "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
  "La educación es el arma más poderosa que puedes usar para cambiar el mundo.",
  "No importa lo lento que vayas, siempre y cuando no te detengas.",
  "El aprendizaje nunca agota la mente.",
  "Estudia no para saber más, sino para ignorar menos.",
  "El conocimiento es poder, pero el entusiasmo es el motor.",
  "Cada experto fue alguna vez un principiante.",
  "La disciplina es el puente entre las metas y los logros.",
  "Invierte en tu mente: es el único activo que nadie te puede quitar.",
  "El progreso, no la perfección, es la clave del éxito."
];

function newQuote() {
  const el = document.getElementById("quote-text");
  el.style.opacity = 0;
  setTimeout(() => {
    el.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    el.style.transition = "opacity 0.5s";
    el.style.opacity = 1;
  }, 200);
}

// ══════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════
let toastTimer = null;
function showToast(msg, type = "info") {
  const icons = { success:"fa-circle-check", error:"fa-circle-xmark", info:"fa-circle-info" };
  const toast = document.getElementById("toast");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${msg}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function showAuthMsg(msg, type) {
  const el = document.getElementById("auth-msg");
  el.textContent = msg;
  el.className = "auth-msg " + type;
}

function setLoading(id, on) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = on;
  btn.querySelector("span").textContent = on ? "Cargando..." : (id === "btn-login" ? "Entrar" : "Crear Cuenta");
}

function togglePass(id) {
  const inp = document.getElementById(id);
  inp.type = inp.type === "password" ? "text" : "password";
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function firebaseError(code) {
  const map = {
    "auth/user-not-found":       "Usuario no encontrado",
    "auth/wrong-password":       "Contraseña incorrecta",
    "auth/email-already-in-use": "Este correo ya está registrado",
    "auth/invalid-email":        "Correo inválido",
    "auth/weak-password":        "Contraseña muy débil",
    "auth/network-request-failed":"Error de red",
    "auth/popup-closed-by-user": "Ventana cerrada por el usuario",
    "auth/invalid-credential":   "Credenciales incorrectas"
  };
  return map[code] || "Error: " + code;
}
