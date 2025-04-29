import fetch from 'node-fetch';

export const getMovieRecommendation = async (req, res) => {
  const { prompt } = req.body;
  
  console.log("Prompt:", prompt);
  console.log("COHERE_API_KEY:", process.env.COHERE_API_KEY ? 'Loaded ✅' : '❌ Not Loaded');

  try {
    const response = await fetch('https://api.cohere.ai/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "command",
          prompt: `Suggest a movie based on this: ${prompt}`,
          max_tokens: 50
        })
      });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Cohere API error:", errText);
      return res.status(500).json({ success: false, message: "Cohere API error" });
    }

    const data = await response.json();
    const suggestion = data.generations[0].text.trim();
    res.status(200).json({ success: true, suggestion });

  } catch (error) {
    console.error("AI recommendation error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
