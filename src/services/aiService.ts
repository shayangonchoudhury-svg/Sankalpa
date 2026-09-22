import { getGenerativeModel } from 'firebase/ai';
import { ai, auth } from '../lib/firebase.ts';
import type { Checkin, AiFlag } from '../types/index.ts';

// Cached models to avoid recreating generative model instances repeatedly
let cachedPromptModel: any = null;
let cachedEvidenceModel: any = null;

// Allow test runners or offline mocks if configured for deterministic verification
type MockAiHandler = {
  generatePrompt?: (title: string, cadence: string) => Promise<string | null>;
  analyzeEvidence?: (
    checkin: Checkin,
    previousCheckins: Checkin[],
    commitmentTitle?: string
  ) => Promise<AiFlag>;
};

let customMockHandler: MockAiHandler | null = null;

export function setMockAiHandler(handler: MockAiHandler | null) {
  customMockHandler = handler;
}

function getPromptModel() {
  if (cachedPromptModel) return cachedPromptModel;
  if (!ai) return null;
  try {
    cachedPromptModel = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 60,
        temperature: 0.7,
      },
      systemInstruction:
        'You are a warm, thoughtful practice guide in SANKALPA, a personal accountability app. You generate a single short reflective question for a practitioner checking in on their daily commitment vow. Keep it concise, warm, and non-judgmental. Return only the question without quotes, prefixes, or markdown.',
    });
    return cachedPromptModel;
  } catch (err) {
    console.warn('Failed to initialize prompt model:', err);
    return null;
  }
}

function getEvidenceModel() {
  if (cachedEvidenceModel) return cachedEvidenceModel;
  if (!ai) return null;
  try {
    cachedEvidenceModel = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
      systemInstruction:
        'You are an advisory assistant for a human witness in SANKALPA reviewing check-in photo evidence. Assess whether the image is unusable (blank, completely black, solid color) or an exact duplicate/reused photo of the provided previous submissions for this commitment. DO NOT judge intent, honesty, or personality. DO NOT use facial recognition. Return structured JSON with "flagged" (boolean) and "reason" (neutral factual string or null).',
    });
    return cachedEvidenceModel;
  } catch (err) {
    console.warn('Failed to initialize evidence model:', err);
    return null;
  }
}

/**
 * FEATURE 1: Reflective Check-in Prompt
 * Requests ONE short, warm, reflective question relevant to the commitment.
 * Must NEVER block check-in submission and fails gracefully.
 */
export async function getReflectivePrompt(
  commitmentTitle: string,
  cadence: string = 'daily'
): Promise<string | null> {
  // 1. Security Check: User must be signed in
  if (!auth.currentUser) {
    return null;
  }

  try {
    // Check test mock handler if registered
    if (customMockHandler?.generatePrompt) {
      return await customMockHandler.generatePrompt(commitmentTitle, cadence);
    }

    const model = getPromptModel();
    if (!model) {
      return null;
    }

    // Only send minimum context: title and cadence.
    // Strictly NO personal email, userId, history, notes, or evidence.
    const cleanTitle = (commitmentTitle || 'practice').slice(0, 100);
    const cleanCadence = (cadence || 'daily').slice(0, 30);

    const userPrompt = `A practitioner is checking in on their commitment: "${cleanTitle}" (cadence: ${cleanCadence}).
Generate exactly ONE short, warm reflective question (under 15 words) to help them reflect on their practice today.
Examples:
- "What almost stopped you today?"
- "What made this easier than yesterday?"
- "What did you notice while doing it?"
- "What helped you follow through today?"
Return ONLY the question.`;

    // 8-second timeout promise race so AI never hangs or delays the user
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('AI prompt timeout')), 8000)
    );

    const generatePromise = model.generateContent(userPrompt);
    const result: any = await Promise.race([generatePromise, timeoutPromise]);

    if (!result?.response) return null;

    let text = result.response.text();
    if (!text || typeof text !== 'string') return null;

    // Clean up quotes and formatting
    text = text.trim().replace(/^["'`]|["'`]$/g, '').trim();

    // Sanity check: must look like a question or short prompt
    if (text.length < 5 || text.length > 200) {
      return null;
    }

    return text;
  } catch (err) {
    // Graceful failure: log silently at debug level and return null.
    // NEVER throw or display an error to the user.
    console.debug('Reflective prompt generation skipped/failed gracefully:', err);
    return null;
  }
}

/**
 * Helper to convert an image URL or data URI into an inlineData part for Gemini.
 */
export async function fetchImageAsInlinePart(
  url: string
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  if (!url) return null;

  // 1. Data URI handling (instant base64 extraction)
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return {
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      };
    }
  }

  // 2. Remote URL handling (Supabase Storage / CDN)
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    // In browser environment
    if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const commaIdx = resultStr.indexOf(',');
          resolve(commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return {
        inlineData: {
          mimeType: blob.type || 'image/jpeg',
          data: base64,
        },
      };
    }

    // In Node / CLI test environment
    if (typeof Buffer !== 'undefined') {
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      return {
        inlineData: {
          mimeType: contentType,
          data: base64,
        },
      };
    }

    return null;
  } catch (err) {
    console.warn('Failed to fetch image for evidence analysis:', err);
    return null;
  }
}

export interface AnalyzeEvidenceParams {
  checkin: Checkin;
  previousCheckins?: Checkin[];
  commitmentTitle?: string;
}

/**
 * FEATURE 2: On-Demand Witness-Side Evidence Flagging
 * Analyzes submitted photo evidence advisory for an authorized witness.
 * - NEVER automatically rejects, deletes, or modifies check-in status.
 * - NEVER alters streak, trust score, or witness decision.
 * - Compares against at most TWO previous photo check-ins for the same commitment.
 * - Fails safely if Gemini or images are unavailable.
 */
export async function analyzeCheckinEvidence(
  params: AnalyzeEvidenceParams
): Promise<AiFlag> {
  const defaultSafeResult: AiFlag = { flagged: false, reason: null };

  // 1. Security Check: User must be signed in
  if (!auth.currentUser) {
    return defaultSafeResult;
  }

  const { checkin, previousCheckins = [], commitmentTitle } = params;

  // 2. Primary supported AI evidence type is photo. Skip none or video.
  if (checkin.evidenceType !== 'photo' || !checkin.evidenceUrl) {
    return defaultSafeResult;
  }

  try {
    // Check test mock handler if registered
    if (customMockHandler?.analyzeEvidence) {
      return await customMockHandler.analyzeEvidence(
        params.checkin,
        params.previousCheckins || [],
        params.commitmentTitle
      );
    }

    const model = getEvidenceModel();
    if (!model) {
      return defaultSafeResult;
    }

    // 3. Inspect only the most recent TWO previous photo check-ins for the SAME commitment
    const candidates = previousCheckins
      .filter(
        (c) =>
          c.id !== checkin.id &&
          c.commitmentId === checkin.commitmentId &&
          c.evidenceType === 'photo' &&
          Boolean(c.evidenceUrl)
      )
      .slice(0, 2);

    // Fetch current image
    const currentPart = await fetchImageAsInlinePart(checkin.evidenceUrl);
    if (!currentPart) {
      // If current image cannot be retrieved, fail gracefully without blocking witness
      return defaultSafeResult;
    }

    // Fetch previous images if available
    const previousParts: any[] = [];
    for (const prev of candidates) {
      if (prev.evidenceUrl) {
        const part = await fetchImageAsInlinePart(prev.evidenceUrl);
        if (part) previousParts.push(part);
      }
    }

    // 4. Assemble multimodal prompt parts
    const promptParts: any[] = [];
    promptParts.push(
      `You are an advisory assistant for a human accountability witness in SANKALPA.
The user submitted this CURRENT photo evidence for the commitment: "${(commitmentTitle || 'Commitment').slice(0, 100)}".

Analyze the CURRENT image.
${
  previousParts.length > 0
    ? `Compare it against the ${previousParts.length} PREVIOUS photo submission(s) provided below for the same commitment.`
    : 'No previous photo submissions exist for comparison; assess only whether the current image is unusable.'
}

Assess ONLY:
1. Reused / Duplicate Evidence: Does the current image appear identical or substantially the same photo as one of the previous submissions?
2. Obviously Unusable Evidence: Is the image completely blank, completely black, a solid color, or completely unusable?

STRICT CONSTRAINTS:
- DO NOT judge user intent, honesty, or personality.
- DO NOT assess health status or mental state.
- DO NOT use facial recognition or identify individuals.
- AI is an advisory signal only. The human witness makes the final decision.

Return STRICT JSON format:
{
  "flagged": true | false,
  "reason": "Short, objective, neutral reason if flagged (max 20 words), or null if not flagged"
}`
    );

    promptParts.push(currentPart);

    if (previousParts.length > 0) {
      promptParts.push('--- PREVIOUS SUBMISSION(S) FOR COMPARISON ---');
      for (const prevPart of previousParts) {
        promptParts.push(prevPart);
      }
    }

    // 12-second timeout promise race
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('AI evidence analysis timeout')), 12000)
    );

    const generatePromise = model.generateContent(promptParts);
    const result: any = await Promise.race([generatePromise, timeoutPromise]);

    if (!result?.response) return defaultSafeResult;

    const rawText = result.response.text();
    if (!rawText || typeof rawText !== 'string') return defaultSafeResult;

    // Parse JSON safely
    let parsed: any = null;
    try {
      // Clean possible markdown code fences if returned
      const cleanJson = rawText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.warn('Failed to parse AI evidence response JSON:', rawText);
      return defaultSafeResult;
    }

    // Validate structured response
    if (typeof parsed?.flagged !== 'boolean') {
      return defaultSafeResult;
    }

    const flagged = parsed.flagged;
    let reason = parsed.reason;

    if (flagged && (!reason || typeof reason !== 'string')) {
      reason = 'The photo evidence appears similar to a previous submission or unusable.';
    }

    if (!flagged) {
      reason = null;
    }

    return {
      flagged,
      reason: reason ? reason.trim().slice(0, 200) : null,
    };
  } catch (err) {
    console.debug('AI evidence review failed gracefully:', err);
    return defaultSafeResult;
  }
}
