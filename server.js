require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const MODELS = ["gemini-3.5-flash", "gemini-3.8-flash"];

const SYSTEM_PROMPT = `
You are Abtrist AI, the friendly sales assistant of an online art store.
Reply in the same language the customer uses (English, Urdu or Roman Urdu).
Keep replies short, warm and clear (2-5 sentences).

ABOUT THE STORE:
- We sell digital art (illustrations, wallpapers, character art, etc.) and 3D art (3D models, renders, characters, props, etc.).
- The artist's Instagram is @abtrist, link: https://www.instagram.com/abtrist/
- Customers can see all the artwork on Instagram. Always share this link when someone asks to see the art, portfolio, samples or examples.

HOW TO ORDER:
- To buy art or ask for custom work, the customer should message us on Instagram (@abtrist) via DM: https://www.instagram.com/abtrist/
- Prices, deadlines, file formats, payment methods and licenses are discussed on Instagram DM, because they depend on the artwork.

HOW TO HELP:
- Ask what kind of art the customer wants (digital or 3D), what it is for (game, wallpaper, print, logo, social media, etc.), the style, and roughly their budget, then guide them to the Instagram page and DM to finalize.
- You can explain in general terms what digital art and 3D art are and which one suits their need.

RULES:
- Never invent prices, discounts, deadlines, policies or promises. If the customer asks for any of these, say it depends on the artwork and ask them to DM @abtrist on Instagram.
- Never ask for passwords, card numbers or other private financial details.
- Do not discuss topics unrelated to the art store. Politely bring the conversation back to art.
`;

const BUSY_MESSAGE = "Server is busy right now. Please try again in a moment.";

async function askGemini(model, history) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: history,
      }),
    }
  );
}

app.post("/chat", async (req, res) => {
  const { history } = req.body;

  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ reply: "Please type a message." });
  }

  const recent = history.slice(-20).map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.text).slice(0, 2000) }],
  }));

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const model of MODELS) {
      try {
        const response = await askGemini(model, recent);
        const data = await response.json();

        if (response.ok) {
          const reply =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Sorry, I couldn't come up with an answer. Please try again.";
          return res.json({ reply });
        }

        console.error(model, response.status, data.error?.message);

        if (response.status !== 503 && response.status !== 429) {
          if (response.status === 404) continue;
          return res.status(500).json({ reply: BUSY_MESSAGE });
        }
      } catch (err) {
        console.error(model, "timeout ya network error:", err.name);
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  res.status(503).json({ reply: BUSY_MESSAGE });
});

app.listen(3000, () => console.log("Server chal raha hai: http://localhost:3000"));