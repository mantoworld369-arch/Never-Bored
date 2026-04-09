const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());

// --- API key rotation ---
// Add keys as OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2, etc. in Render env vars
// Falls back to OPENROUTER_API_KEY if numbered ones not set
function getApiKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env["OPENROUTER_API_KEY_" + i];
    if (k) keys.push(k);
  }
  if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
  return [...new Set(keys)]; // deduplicate
}

let keyIndex = 0;
function nextKey(keys) {
  const k = keys[keyIndex % keys.length];
  keyIndex++;
  return k;
}

const SYSTEM_PROMPT = [
  "You are a topic generator for a curiosity app called Never Bored.",
  "Generate exactly the number of topics requested.",
  "Topics can be about absolutely ANYTHING fascinating:",
  "science, history, nature, crime, sports, music, film, fashion, architecture, mythology,",
  "religion, economics, medicine, animals, geography, internet culture, unsolved mysteries,",
  "weird facts, extreme sports, subcultures, philosophy, technology, art, psychology, space,",
  "food, language, math — anything that makes someone desperate to keep exploring.",
  "Avoid any topics from the exclusion list provided.",
  "Respond ONLY with a valid JSON array. No markdown, no backticks, no extra text.",
  "Each object must have these exact fields:",
  "category: one lowercase word.",
  "title_en: punchy topic name in English (3-6 words).",
  "title_zh: Simplified Chinese title.",
  "summary_en: 5-6 sentences in English. Be thorough and genuinely fascinating — give real details,",
  "  specific names, numbers, and surprising facts. Make the reader feel they just learned something",
  "  real and want to immediately go find out more. No vague generalities.",
  "summary_zh: 5-6 sentence summary in Simplified Chinese, equally detailed.",
  "fun_en: one punchy sentence on the single most mind-blowing aspect, in English.",
  "fun_zh: one punchy sentence in Simplified Chinese.",
  "search: best YouTube search query for this topic (be specific, include key names/terms)."
].join(" ");

const MODELS = [
  "openrouter/auto",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-7b-instruct:free"
];

app.get("/api/debug", async (req, res) => {
  const keys = getApiKeys();
  const keyPreviews = keys.map(k => k.slice(0, 14) + "...");
  res.json({ keyCount: keys.length, keyPreviews });
});

// Streaming endpoint — sends topic objects one by one as they're parsed
app.post("/api/topics/stream", async (req, res) => {
  const exclude = req.body.exclude || [];
  const count = Math.min(Math.max(parseInt(req.body.count) || 2, 1), 5);

  const userPrompt = exclude.length
    ? "Generate exactly " + count + " fascinating topics. Do NOT include: " + exclude.slice(0, 40).join(", ") + "."
    : "Generate exactly " + count + " fascinating topics.";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const keys = getApiKeys();
  if (!keys.length) {
    res.write("event: error\ndata: " + JSON.stringify({ error: "No API key set" }) + "\n\n");
    return res.end();
  }

  let success = false;

  for (const model of MODELS) {
    if (success) break;
    for (let ki = 0; ki < keys.length; ki++) {
      const apiKey = nextKey(keys);
      try {
        console.log("Trying", model, "key#" + (ki + 1));

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://never-bored.onrender.com",
            "X-Title": "Never Bored"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            max_tokens: count <= 2 ? 3000 : 6000,
            temperature: 1.0,
            stream: true
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = (errData.error && errData.error.message) ? errData.error.message : response.status;
          console.warn(model, "http error:", errMsg);
          continue;
        }

        // Stream the response and parse JSON array on the fly
        let buffer = "";
        const decoder = new TextDecoder();

        for await (const chunk of response.body) {
          const text = decoder.decode(chunk, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content || "";
              buffer += delta;
              // Stream raw text to client so it can do typewriter effect
              if (delta) {
                res.write("event: token\ndata: " + JSON.stringify({ token: delta }) + "\n\n");
              }
            } catch (_) {}
          }
        }

        // Parse complete buffer into topics
        const clean = buffer.replace(/```json/g, "").replace(/```/g, "").trim();
        let topics;
        try {
          topics = JSON.parse(clean);
        } catch (e) {
          // Try to extract array if there's extra text around it
          const match = clean.match(/\[[\s\S]*\]/);
          if (match) topics = JSON.parse(match[0]);
          else throw new Error("Could not parse JSON: " + e.message);
        }

        if (!Array.isArray(topics) || topics.length === 0) throw new Error("Empty array");

        res.write("event: topics\ndata: " + JSON.stringify({ topics }) + "\n\n");
        console.log("Success:", model, "topics:", topics.length);
        success = true;
        break;
      } catch (err) {
        console.warn(model, "error:", err.message);
      }
    }
  }

  if (!success) {
    res.write("event: error\ndata: " + JSON.stringify({ error: "All models failed. Try again in a moment." }) + "\n\n");
  }

  res.end();
});

app.get("/logo.png", (req, res) => {
  res.sendFile(path.join(__dirname, "logo.png"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Never Bored on port " + PORT));
