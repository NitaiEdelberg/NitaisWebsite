import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getMovieRecommendation = async (req, res) => {
  const { prompt } = req.body;

  try {
    const model = genAI.getGenerativeModel({ model: "models/gemini-pro" });

    const result = await model.generateContent(`Suggest a movie based on this prompt: ${prompt}. Respond with just the movie title and year.`);
    const response = await result.response;
    const text = response.text().trim();

    res.status(200).json({ success: true, suggestion: text });

  } catch (error) {
    console.error("Gemini AI error:", error.message);
    res.status(500).json({ success: false, message: "Gemini API error", error: error.message });
  }
};
