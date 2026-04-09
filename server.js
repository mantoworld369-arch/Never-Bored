const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());

function getApiKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env["OPENROUTER_API_KEY_" + i];
    if (k) keys.push(k);
  }
  if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
  return [...new Set(keys)];
}

let keyIndex = 0;
function nextKey(keys) {
  const k = keys[keyIndex % keys.length];
  keyIndex++;
  return k;
}

// FREE-ONLY models — never use openrouter/auto (it can route to paid models like Claude Opus)
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen3-8b:free"
].filter(m => !/claude|anthropic/i.test(m));

const TOPIC_SYSTEM = [
  "You are a topic generator for a curiosity app called Never Bored.",
  "Generate exactly the number of topics requested.",
  "Topics can be about absolutely ANYTHING fascinating:",
  "science, history, nature, crime, sports, music, film, fashion, architecture, mythology,",
  "religion, economics, medicine, animals, geography, internet culture, unsolved mysteries,",
  "weird facts, extreme sports, subcultures, philosophy, technology, art, psychology, space,",
  "food, language, math — anything that makes someone desperate to keep exploring.",
  "Avoid any topics from the exclusion list provided.",
  "When a category is specified, ALL topics must belong to that category.",
  "Respond ONLY with a valid JSON array. No markdown, no backticks, no extra text.",
  "Each object must have these exact fields:",
  "category: one lowercase word matching the requested category (or a fitting one if 'all').",
  "title_en: punchy topic name in English (3-6 words).",
  "title_zh: Simplified Chinese title.",
  "summary_en: 5-6 sentences. Be thorough and genuinely fascinating — give real details,",
  "  specific names, numbers, and surprising facts. Make the reader want to immediately find out more.",
  "summary_zh: 5-6 sentences in Simplified Chinese, equally detailed.",
  "fun_en: one punchy sentence on the single most mind-blowing aspect, in English.",
  "fun_zh: one punchy sentence in Simplified Chinese.",
  "search: best YouTube search query for this topic (specific, include key names/terms)."
].join(" ");

async function callOpenRouter(messages, maxTokens, stream, res) {
  const keys = getApiKeys();
  if (!keys.length) {
    if (stream) {
      res.write("event: error\ndata: " + JSON.stringify({ error: "No API key set" }) + "\n\n");
      res.end();
    }
    return null;
  }

  for (const model of MODELS) {
    if (/claude|anthropic/i.test(model)) { console.warn("Skipping paid model:", model); continue; }
    for (let ki = 0; ki < keys.length; ki++) {
      const apiKey = nextKey(keys);
      try {
        console.log("Trying", model);
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://never-bored.onrender.com",
            "X-Title": "Never Bored"
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 1.0,
            stream
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn(model, "http error:", errData.error && errData.error.message);
          continue;
        }

        if (!stream) {
          const data = await response.json();
          const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (!content) continue;
          return content;
        }

        // Streaming: pipe tokens to client and collect buffer
        let buffer = "";
        const decoder = new TextDecoder();
        for await (const chunk of response.body) {
          const text = decoder.decode(chunk, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content || "";
              if (delta) {
                buffer += delta;
                res.write("event: token\ndata: " + JSON.stringify({ token: delta }) + "\n\n");
              }
            } catch (_) {}
          }
        }
        return buffer;
      } catch (err) {
        console.warn(model, "error:", err.message);
      }
    }
  }
  return null;
}

function parseJSON(raw) {
  const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
  // 1. Try direct parse
  try { return JSON.parse(clean); } catch (_) {}
  // 2. Extract outermost [...] or {...} block
  const match = clean.match(/[\[{][\s\S]*[\]}]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
    // 3. If it's a truncated array, salvage complete objects from it
    if (match[0].startsWith("[")) {
      try {
        // Find all complete {...} objects inside the array
        const objects = [];
        let depth = 0, start = -1;
        for (let i = 0; i < match[0].length; i++) {
          const ch = match[0][i];
          if (ch === "{") { if (depth === 0) start = i; depth++; }
          else if (ch === "}") {
            depth--;
            if (depth === 0 && start !== -1) {
              try { objects.push(JSON.parse(match[0].slice(start, i + 1))); } catch (_) {}
              start = -1;
            }
          }
        }
        if (objects.length > 0) return objects;
      } catch (_) {}
    }
  }
  throw new Error("Could not parse JSON");
}

app.get("/api/debug", (req, res) => {
  const keys = getApiKeys();
  res.json({ keyCount: keys.length, previews: keys.map(k => k.slice(0, 14) + "...") });
});

app.post("/api/topics/stream", async (req, res) => {
  const exclude = req.body.exclude || [];
  const count = Math.min(Math.max(parseInt(req.body.count) || 2, 1), 5);
  const category = req.body.category || "all";

  const categoryHint = category !== "all"
    ? "ALL topics MUST be about the category: " + category + ". "
    : "";

  const userPrompt = categoryHint +
    (exclude.length
      ? "Generate exactly " + count + " topics. Do NOT include: " + exclude.slice(0, 60).join(", ") + "."
      : "Generate exactly " + count + " fascinating topics.");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const messages = [
    { role: "system", content: TOPIC_SYSTEM },
    { role: "user", content: userPrompt }
  ];

  const buffer = await callOpenRouter(messages, count <= 2 ? 3000 : 6000, true, res);

  if (!buffer) {
    res.write("event: error\ndata: " + JSON.stringify({ error: "All models failed. Try again." }) + "\n\n");
    return res.end();
  }

  try {
    const topics = parseJSON(buffer);
    if (!Array.isArray(topics) || topics.length === 0) throw new Error("Empty array");
    res.write("event: topics\ndata: " + JSON.stringify({ topics }) + "\n\n");
    console.log("Topics ok:", topics.length);
  } catch (err) {
    res.write("event: error\ndata: " + JSON.stringify({ error: "Parse error: " + err.message }) + "\n\n");
  }
  res.end();
});

app.get("/logo.png", (req, res) => res.sendFile(path.join(__dirname, "logo.png")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Never Bored on port " + PORT));
