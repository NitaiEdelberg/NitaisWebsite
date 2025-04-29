import dotenv from "dotenv";
dotenv.config();

export const getMovieRecommendation = async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Suggest a movie based on this input: "${prompt}". Avoid recommending the same movie twice.
Include a bit of randomness in your suggestion logic.
Respond in this format:

Title: [movie name]  
Year: [release year]  
Why you'll love it: [1-2 short sentences]`
,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.candidates || !data.candidates.length) {
      console.error("Gemini API error:", data);
      return res.status(500).json({ success: false, message: "Gemini API error", details: data });
    }

    const responseText = data.candidates[0].content.parts[0].text.trim();
    res.status(200).json({ success: true, recommendation: responseText });
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
