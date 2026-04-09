const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());

const SYSTEM_PROMPT = [
  "You are a topic generator for a curiosity app.",
  "Generate exactly the number of topics requested. Topics can be about absolutely anything fascinating in the world:",
  "science, history, nature, culture, philosophy, food, math, technology, art, language, psychology, space, crime, sports, music, film, fashion, architecture, mythology, religion, economics, medicine, animals, geography, internet culture, unsolved mysteries, weird facts, extreme sports, subcultures — anything that makes someone want to keep exploring.",
  "Avoid any topics from the exclusion list provided.",
  "Respond ONLY with a valid JSON array. No markdown, no backticks, no explanation.",
  "Each object must have: category, title_en, title_zh, summary_en, summary_zh, fun_en, fun_zh, search.",
  "category: one lowercase word.",
  "title_en: topic name in English (3-6 words).",
  "title_zh: Simplified Chinese title.",
  "summary_en: 2-3 sentence summary in English.",
  "summary_zh: 2-3 sentence summary in Simplified Chinese.",
  "fun_en: one sentence on why this is fascinating, in English.",
  "fun_zh: one sentence in Simplified Chinese on why this is fascinating.",
  "search: best YouTube search query for this topic."
].join(" ");

app.get("/api/debug", async (req, res) => {
  const keySet = !!process.env.OPENROUTER_API_KEY;
  const keyPreview = keySet ? process.env.OPENROUTER_API_KEY.slice(0, 14) + "..." : "NOT SET";
  let openrouterOk = false;
  let openrouterErr = null;
  try {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY }
    });
    openrouterOk = r.ok;
    if (!r.ok) openrouterErr = await r.text();
  } catch (e) { openrouterErr = e.message; }
  res.json({ keySet, keyPreview, openrouterOk, openrouterErr });
});

app.post("/api/topics", async (req, res) => {
  const exclude = req.body.exclude || [];
  const count = Math.min(Math.max(parseInt(req.body.count) || 20, 1), 20);

  const userPrompt = exclude.length
    ? "Generate exactly " + count + " fascinating topics. Do NOT include any of these: " + exclude.join(", ") + "."
    : "Generate exactly " + count + " fascinating topics from across all domains of human knowledge.";

  try {
    console.log("Calling OpenRouter for " + count + " topics");

    // openrouter/free auto-picks any available free model
    // specific models are fallbacks in case the router itself fails
    const MODELS = [
      "openrouter/auto",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "google/gemma-3-12b-it:free",
      "mistralai/mistral-7b-instruct:free",
      "nvidia/llama-3.1-nemotron-70b-instruct:free"
    ];

    let topics = null;
    let lastError = "All models failed";

    for (const model of MODELS) {
      try {
        console.log("Trying model:", model);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
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
            max_tokens: count <= 5 ? 2500 : 8000,
            temperature: 1.0
          })
        });

        const data = await response.json();
        console.log(model, "status:", response.status);

        if (!response.ok) {
          const errMsg = (data.error && data.error.message) ? data.error.message : JSON.stringify(data);
          console.warn(model, "failed:", errMsg);
          lastError = errMsg;
          continue; // try next model
        }

        const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content : "";
        if (!raw) { lastError = model + " returned empty content"; continue; }

        const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(clean);
        if (!Array.isArray(parsed) || parsed.length === 0) { lastError = "Invalid array from " + model; continue; }

        topics = parsed;
        console.log("Success with", model, "- topics:", topics.length);
        break;
      } catch (modelErr) {
        console.warn(model, "threw:", modelErr.message);
        lastError = modelErr.message;
      }
    }

    if (!topics) throw new Error(lastError);
    res.json({ topics });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Never Bored on port " + PORT));
