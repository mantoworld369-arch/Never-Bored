const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    const message = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = message.content
      .map((b) => b.text || "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    const topics = JSON.parse(raw);

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
