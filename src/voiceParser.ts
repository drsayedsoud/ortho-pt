import { GoogleGenerativeAI } from '@google/generative-ai';

export const parseVoiceInput = async (transcript: string, apiKey: string) => {
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
Extract the patient's first name and phone number from the following Arabic text. 
Return ONLY a JSON object with two keys: "name" and "phone". 
If you cannot find a valid name or phone, do your best to guess from the text.
The phone number should be cleaned of spaces and non-numeric characters (except maybe +).

Text: "${transcript}"
`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      
      // Clean up markdown block if present
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const data = JSON.parse(text);
      if (data.name && data.phone) {
        return { name: data.name, phone: data.phone };
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
    }
  }

  // Fallback simple parser
  // Split by spaces, assume longest numeric sequence is phone, rest is name
  const words = transcript.split(' ');
  let phone = '';
  let nameWords = [];

  for (const word of words) {
    const cleaned = word.replace(/[^0-9+]/g, '');
    if (cleaned.length >= 8) {
      phone = cleaned;
    } else {
      nameWords.push(word);
    }
  }

  return {
    name: nameWords.join(' ') || 'غير معروف',
    phone: phone || 'غير معروف'
  };
};
