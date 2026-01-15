import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function generateTranslation(targetLocale: string, languageName: string) {
  console.log(`\n🌍 Generating ${languageName} translations...`);

  // Initialize Gemini
  const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!API_KEY) {
    throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not found in environment variables');
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: { responseMimeType: "application/json" },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
  });

  // Read English source
  const englishPath = path.join(process.cwd(), 'messages', 'en.json');
  const english = JSON.parse(fs.readFileSync(englishPath, 'utf-8'));

  const prompt = `You are a professional translator specializing in UI/UX localization.

Translate this JSON file from English to ${languageName}.

CRITICAL RULES:
1. Keep all JSON keys EXACTLY the same (don't translate keys, only values)
2. Maintain formatting:
   - If English text is "UPPERCASE", translate to uppercase in target language
   - If it has punctuation like "→" or "...", keep the same punctuation
   - Keep emoji and special characters (🎉, ✓, etc.)
3. Preserve placeholders like {distance}, {duration}, {accuracy} - do not translate these
4. Keep brand name "SideQuest" unchanged
5. Keep technical terms like "GPS", "Gemini 3" unchanged
6. For UI labels, use standard ${languageName} conventions for buttons/actions
7. Output ONLY valid JSON, no explanations or markdown code blocks

English JSON:
${JSON.stringify(english, null, 2)}

Output the complete translated JSON (raw JSON only, no markdown):`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();

  // Extract JSON from response (handle markdown code blocks)
  let translatedJson;
  try {
    // Try to extract from markdown code blocks first
    const jsonMatch = text.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/) || text.match(/\`\`\`\n([\s\S]*?)\n\`\`\`/);
    if (jsonMatch) {
      text = jsonMatch[1];
    }

    translatedJson = JSON.parse(text);
  } catch (error) {
    console.error('❌ Failed to parse Gemini response as JSON');
    console.log('Raw response:', text);
    throw error;
  }

  // Save to messages/{locale}.json
  const outputPath = path.join(process.cwd(), 'messages', `${targetLocale}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(translatedJson, null, 2), 'utf-8');

  console.log(`✅ Generated ${outputPath}`);
  console.log(`📊 Translated ${Object.keys(english).length} top-level categories`);

  // Count total strings
  const countStrings = (obj: any): number => {
    return Object.values(obj).reduce((count: number, value: any) => {
      if (typeof value === 'string') return count + 1;
      if (typeof value === 'object') return count + countStrings(value);
      return count;
    }, 0);
  };

  console.log(`📝 Total strings translated: ${countStrings(english)}`);
}

async function main() {
  console.log('🚀 SideQuest Translation Generator');
  console.log('===================================');

  try {
    // Generate Vietnamese
    await generateTranslation('vi', 'Vietnamese (tiếng Việt)');

    // Easy to add more languages later:
    // await generateTranslation('es', 'Spanish (español)');
    // await generateTranslation('fr', 'French (français)');
    // await generateTranslation('zh', 'Simplified Chinese (简体中文)');

    console.log('\n✨ Translation generation complete!');
    console.log('💡 You can now review and edit the generated files if needed.');
  } catch (error) {
    console.error('\n❌ Translation generation failed:', error);
    process.exit(1);
  }
}

main();
