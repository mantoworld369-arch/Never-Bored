const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `You are a topic generator for a curiosity app. Generate exactly 20 unique, fascinating topics spanning all human knowledge — science, history, nature, culture, philosophy, food, mathematics, technology, art, language, psychology, space, and more.

Avoid repeating any topics from the provided exclusion list.

Respond ONLY with a valid JSON array of 20 objects. No markdown, no backticks, no explanation. Each object must have exactly these fields:
{
  "category": "one lowercase word",
  "title_en": "Topic Name (3–6 words)",
  "title_zh": "Traditional Chinese title",
  "summary_en": "2–3 sentence summary in English",
  "summary_zh": "2–3 sentence summary in Traditional Chinese",
  "fun_en": "One sentence on why this is fascinating, in English",
  "fun_zh": "One sentence in Traditional Chinese on why this is fascinating",
  "search": "best YouTube search query for this topic"
}`;

app.post("/api/topics", async (req, res) => {
  const { exclude = [] } = req.body;

  const userPrompt = exclude.length
    ? `Generate 20 fascinating topics. Do NOT include any of these topics: ${exclude.join(", ")}.`
    : "Generate 20 fascinating topics from across all domains of human knowledge.";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.RAILWAY_STATIC_URL || "https://never-bored.app",
        "X-Title": "Never Bored"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 8000,
        temperature: 1.0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter error:", data);
      return res.status(500).json({ error: data.error?.message || "OpenRouter error" });
    }

    const raw = data.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const topics = JSON.parse(clean);

    if (!Array.isArray(topics) || topics.length === 0) {
      throw new Error("Invalid topics format");
    }

    res.json({ topics });
  } catch (err) {
    console.error("Topic generation error:", err.message);
    res.status(500).json({ error: "Failed to generate topics" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Never Bored running on http://localhost:${PORT}`);
});
