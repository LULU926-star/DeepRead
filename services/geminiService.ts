import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// Schema definition for structured output
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    isValidResearchContent: {
      type: Type.BOOLEAN,
      description: "Set to TRUE if this is a strict Academic Paper or Research Report. Set to FALSE for news, novels, manuals, slides, resumes, etc."
    },
    rejectionReason: {
      type: Type.STRING,
      description: "If isValidResearchContent is false, provide a short, friendly reason why DeepRead cannot analyze this (e.g. 'DeepRead only supports academic papers, but this looks like a news article').",
      nullable: true
    },
    stats: {
      type: Type.ARRAY,
      description: "3-4 key statistics from the paper (e.g., 'N=500', 'P<0.05', 'Year: 2024')",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          value: { type: Type.STRING }
        }
      }
    },
    overview: {
      type: Type.STRING,
      description: "A concise summary paragraph. Use citations like [1], [2] at the end of sentences that reference specific claims."
    },
    coreLogic: {
      type: Type.ARRAY,
      description: "Analyze the Core Logic using the BPMRC model: Background, Problem, Method, Result, Conclusion.",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Must be one of: 'Background', 'Problem', 'Method', 'Result', 'Conclusion'" },
          content: { type: Type.STRING },
          citationId: { type: Type.INTEGER, nullable: true }
        }
      }
    },
    glossary: {
      type: Type.ARRAY,
      description: "5-7 key technical terms or acronyms defined simply for a novice.",
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          definition: { type: Type.STRING }
        }
      }
    },
    eli5: {
      type: Type.STRING,
      description: "A simplified explanation of the paper's core concept as if explaining to a 5-year-old (or high school student)."
    },
    deepDive: {
      type: Type.OBJECT,
      properties: {
        methodologyCritique: { type: Type.STRING, description: "Critical analysis of the methodology used." },
        limitations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of limitations mentioned in the paper or observed." },
        futureResearch: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggested future research directions." },
        qAndA: {
          type: Type.ARRAY,
          description: "5 profound methodological questions predicted by AI and their detailed answers.",
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            }
          }
        }
      }
    },
    citations: {
      type: Type.ARRAY,
      description: "List of citations used in the overview and coreLogic for grounding.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          snippet: { type: Type.STRING, description: "The exact quote from the text to be highlighted." }
        }
      }
    }
  },
  required: ["isValidResearchContent", "stats", "overview", "coreLogic", "citations", "glossary", "eli5", "deepDive"]
};

/**
 * Converts a File object to a Base64 string.
 */
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzePdf = async (file: File): Promise<AnalysisResult> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing. Please check your environment configuration.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = "gemini-2.5-flash"; // Using 2.5 Flash for speed and multimodal capabilities

    const base64Data = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: `You are DeepRead, an advanced academic reading assistant. 
            
            STEP 1: GATEKEEPER CHECK (STRICT)
            Determine if the uploaded document is a legitimate **Academic Paper**, **Scientific Article**, or **Professional Research Report**.
            - REJECT: News articles, magazines, novels, textbooks, slide decks, resumes, invoices, code snippets, technical manuals, or marketing whitepapers.
            - IF REJECTED: Set 'isValidResearchContent' to false, provide a 'rejectionReason', and fill other fields with empty/dummy data.
            - IF ACCEPTED: Set 'isValidResearchContent' to true and proceed to Step 2.

            STEP 2: ANALYSIS
            Analyze the research paper comprehensively.
            
            1. For 'Skim' mode: 
               - Extract key stats.
               - Write an overview with citations [x].
               - Extract the **Core Logic (BPMRC)**: Background, Problem, Method, Result, Conclusion.
            2. For 'Learn' mode: Create a glossary of difficult terms and an ELI5 (Explain Like I'm 5) summary.
            3. For 'Deep Dive' mode: Critically analyze the methodology, list limitations, suggest future research, and predict 5 profound methodological questions and answer them.
            
            IMPORTANT: For every citation marker [x] used in the overview or Core Logic, you MUST provide the exact text snippet from the PDF in the citations array so we can highlight it.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const translateAnalysisResult = async (data: AnalysisResult): Promise<AnalysisResult> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    const modelId = "gemini-2.5-flash";

    // We send the existing JSON and ask Gemini to translate the values
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            text: `You are a professional academic translator. Translate the content of the following JSON object into Simplified Chinese (zh-CN).
            
            Rules:
            1. Translate 'overview', 'coreLogic.content', 'glossary', 'eli5', 'deepDive.methodologyCritique', 'deepDive.limitations', 'deepDive.futureResearch', 'deepDive.qAndA', 'stats.label', and 'rejectionReason'.
            2. Translate the 'coreLogic.label' values to: 
               - Background -> 背景
               - Problem -> 问题
               - Method -> 方法
               - Result -> 结果
               - Conclusion -> 结论
            3. DO NOT translate 'citations' array content (these must remain exact original text matches).
            4. DO NOT translate technical variable names like "p-value" if standard in Chinese, but generally prefer Chinese terms.
            5. Keep all citation markers [x] exactly where they are in the sentences.
            6. Return the result in the exact same JSON schema.

            JSON to translate:
            ${JSON.stringify(data)}
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema
      }
    });

    const text = response.text;
    if (!text) throw new Error("Translation failed");
    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
};