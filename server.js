const express = require("express");
const cors    = require("cors");
const fetch   = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(__dirname));

const OPENAI_API_KEY = "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"; // ← TU CLAVE AQUÍ

const SYSTEM_PROMPT = `Eres StudyFlow AI, un asistente de estudio inteligente. 
Responde siempre en español. Usa emojis moderadamente.`;

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  const openaiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role && m.content)
  ];
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model:       "gpt-3.5-turbo",
        max_tokens:  1024,
        temperature: 0.7,
        messages:    openaiMessages
      })
    });
    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sin respuesta";
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: "gpt-3.5-turbo" });
});

app.listen(PORT, () => {
 console.log(`Servidor corriendo en puerto ${PORT}`);
});