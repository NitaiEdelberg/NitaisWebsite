import dotenv from "dotenv";
dotenv.config();

// Movie recommendations via Groq (OpenAI-compatible, free tier, no credit card).
// Set GROQ_API_KEY in the environment. Get a key at https://console.groq.com/keys
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const getMovieRecommendation = async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.9, // a little randomness so repeat prompts vary
        messages: [
          {
            role: "system",
            content:
              "You are a concise movie recommendation assistant. Recommend exactly one film.",
          },
          {
            role: "user",
            content: `Suggest a movie based on this input: "${prompt}". Avoid recommending the same movie twice.
Include a bit of randomness in your suggestion logic.
Respond in this format:

Title: [movie name]
Year: [release year]
Why you'll love it: [1-2 short sentences]`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.choices || !data.choices.length) {
      console.error("Groq API error:", data);
      return res
        .status(response.status || 500)
        .json({ success: false, message: "AI API error", details: data });
    }

    const responseText = data.choices[0].message.content.trim();
    res.status(200).json({ success: true, recommendation: responseText });
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
