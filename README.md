# 🚀 StudyFlow AI — Guía de Instalación Completa

## Estructura de archivos

```
studyflow/
├── index.html      ← App principal (abre con Live Server)
├── style.css       ← Estilos cyberpunk / neon
├── script.js       ← Lógica frontend + Firebase
├── server.js       ← Servidor Node.js (proxy a Claude AI)
├── package.json    ← Dependencias del servidor
└── README.md       ← Esta guía
```

---

## PASO 1 — Configurar Firebase

1. Ve a https://console.firebase.google.com
2. Crea un nuevo proyecto (o usa uno existente)
3. Ve a **Authentication** → Métodos de inicio de sesión → Habilita **Email/Contraseña** y **Google**
4. Ve a **Firestore Database** → Crear base de datos (modo producción o prueba)
5. Ve a **Configuración del proyecto** (ícono ⚙️) → "Tus apps" → Agrega app web (</>)
6. Copia el objeto `firebaseConfig` y reemplázalo en `script.js`:

```js
// En script.js, línea ~8:
const firebaseConfig = {
  apiKey:            "tu-api-key",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto-id",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "tu-sender-id",
  appId:             "tu-app-id"
};
```

### Reglas de Firestore (para producción):
Ve a Firestore → Reglas y pega esto:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## PASO 2 — Instalar dependencias del servidor

Asegúrate de tener **Node.js** instalado (versión 18+).
Descárgalo en: https://nodejs.org

```bash
# En la carpeta del proyecto:
cd studyflow
npm install
```

---

## PASO 3 — Configurar la API Key de Claude AI

1. Ve a https://console.anthropic.com/settings/keys
2. Crea una nueva API Key
3. Abre `server.js` y reemplaza en la línea ~18:

```js
const ANTHROPIC_API_KEY = "sk-ant-xxxxxxxxxxxx";  // ← Tu clave aquí
```

---

## PASO 4 — Iniciar el servidor

```bash
# Opción A: producción
node server.js

# Opción B: desarrollo (se reinicia automático al editar)
npm run dev
```

Deberías ver:
```
╔═══════════════════════════════════════════╗
║         StudyFlow AI Server               ║
╠═══════════════════════════════════════════╣
║  ✅ Servidor corriendo en puerto 3000     ║
╚═══════════════════════════════════════════╝
```

Verifica que funciona: http://localhost:3000/health

---

## PASO 5 — Abrir la app

Abre `index.html` con **Live Server** en VS Code:
- Instala la extensión "Live Server" en VS Code
- Clic derecho en `index.html` → "Open with Live Server"
- Se abrirá en `http://127.0.0.1:5500`

**O simplemente abre el archivo directamente en tu navegador** (doble clic en index.html).

> ⚠️ El servidor Node.js (puerto 3000) debe estar corriendo para que el chat de IA funcione.
> El resto de la app (login, tareas) funciona solo con Firebase sin necesidad del servidor.

---

## Resumen rápido (después de la configuración inicial)

Cada vez que quieras usar la app:

```bash
# Terminal 1:
node server.js

# Luego abrir index.html con Live Server o el navegador
```

---

## Pantallas de la app

| Pantalla | Descripción |
|----------|-------------|
| 🔐 Login | Registro e inicio de sesión con Firebase |
| 🏠 Dashboard | Estadísticas, tareas recientes, reloj en vivo, frase motivacional |
| ✅ Tareas | Crear, editar, completar y eliminar tareas con Firestore |
| 🤖 IA Chat | Chat con Claude AI para ayuda académica |
| 📊 Estadísticas | Gráficas, logros y progreso semanal |

---

## Tecnologías usadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Autenticación**: Firebase Auth (Email + Google)
- **Base de datos**: Cloud Firestore
- **Backend**: Node.js + Express
- **IA**: Claude Sonnet (Anthropic API)
- **Diseño**: Cyberpunk / Neon Dark Theme

---

## Solución de problemas comunes

**Error: CORS** → Asegúrate de que el servidor esté corriendo en el puerto 3000

**Error: Firebase** → Verifica que las credenciales en `script.js` sean correctas

**Error: 401 Anthropic** → Revisa tu API key en `server.js`

**Tareas no cargan** → Crea el índice en Firestore cuando Firebase lo solicite en la consola
