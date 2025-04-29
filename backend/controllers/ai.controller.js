import fetch from 'node-fetch';

export const getMovieRecommendation = async (req, res) => {
  const { prompt } = req.body;

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

  const data = await response.json();
  const suggestion = data.generations[0].text.trim();

  res.status(200).json({ success: true, suggestion });
};
