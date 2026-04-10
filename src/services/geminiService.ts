import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Paper, Section, Question, Passage } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function parsePaperWithGemini(paperText: string, answerKeyText: string): Promise<Partial<Paper>> {
  const prompt = `
    You are an expert at parsing CAT (Common Admission Test) exam papers.
    I will provide you with the text extracted from a CAT paper and an answer key.
    Your task is to organize this into a structured JSON format.

    The CAT exam has 3 sections:
    1. VARC (Verbal Ability and Reading Comprehension) - Usually has passages followed by questions.
    2. DILR (Data Interpretation and Logical Reasoning) - Usually has sets of data/logic followed by questions.
    3. QA (Quantitative Ability) - Usually standalone questions.

    Each section is 40 minutes.

    Rules:
    - If a question is TITA (Type In The Answer), the options should be empty and type should be "TITA".
    - Ensure every question has a correctAnswer from the answer key.
    - Group questions under the correct passage if applicable.
    - If the paper text is messy, use your intelligence to clean it up and extract the core questions.

    Paper Text:
    ${paperText}

    Answer Key Text:
    ${answerKeyText}
  `;

  const response = await genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                duration: { type: Type.NUMBER },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctAnswer: { type: Type.STRING },
                      passageId: { type: Type.STRING },
                      type: { type: Type.STRING }
                    },
                    required: ["id", "text", "correctAnswer", "type"]
                  }
                },
                passages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      content: { type: Type.STRING }
                    },
                    required: ["id", "content"]
                  }
                }
              },
              required: ["name", "duration", "questions"]
            }
          }
        },
        required: ["title", "sections"]
      }
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:", text);
    // Fallback to regex if somehow it's still wrapped
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Failed to parse paper structure from Gemini response");
  }
}
