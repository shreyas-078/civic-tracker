import { Ollama } from "ollama";
import type { AIAnalysisResult } from "@/types";

const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
});

const MODEL = process.env.OLLAMA_MODEL ?? "llava";

/** Fetch a remote image URL and return base64 string */
async function urlToBase64(url: string): Promise<string> {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString("base64");
}

// ─── Text Similarity (Dice coefficient on bigrams) ────────────────────────────

function bigrams(s: string): Set<string> {
    const normalized = s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
    const set = new Set<string>();
    for (let i = 0; i < normalized.length - 1; i++) {
        set.add(normalized.slice(i, i + 2));
    }
    return set;
}

/** Dice coefficient: 0 = no overlap, 1 = identical */
export function textSimilarity(a: string, b: string): number {
    const biA = bigrams(a);
    const biB = bigrams(b);
    if (biA.size === 0 && biB.size === 0) return 1;
    if (biA.size === 0 || biB.size === 0) return 0;
    let intersection = 0;
    for (const bi of biA) if (biB.has(bi)) intersection++;
    return (2 * intersection) / (biA.size + biB.size);
}

// ─── Heuristic Resolution Time Estimation ─────────────────────────────────────

interface EstimationInput {
    title: string;
    description: string;
    category: string;
    imageCount: number;
}

interface ResolutionEstimate {
    estimatedDays: number;
    confidence: "low" | "medium" | "high";
    reasoning: string;
}

const SEVERITY_KEYWORDS: Record<
    string,
    { weight: number; keywords: string[] }
> = {
    critical: {
        weight: 1.8,
        keywords: [
            "collapse",
            "collapsed",
            "sinkhole",
            "flood",
            "flooded",
            "fire",
            "electrocution",
            "exposed wire",
            "live wire",
            "danger",
            "emergency",
            "accident",
            "injury",
            "injured",
            "death",
            "fatal",
            "toxic",
            "sewage overflow",
            "building crack",
            "structural damage",
            "cave-in",
            "gas leak",
        ],
    },
    high: {
        weight: 1.4,
        keywords: [
            "broken",
            "burst",
            "major",
            "large",
            "massive",
            "deep",
            "blocked",
            "overflow",
            "contaminated",
            "no water",
            "no electricity",
            "power outage",
            "blackout",
            "fallen tree",
            "road block",
            "impassable",
            "hazard",
            "unsafe",
            "dangerous",
            "clogged drain",
            "waterlogged",
        ],
    },
    medium: {
        weight: 1.0,
        keywords: [
            "pothole",
            "crack",
            "leak",
            "leaking",
            "damaged",
            "faulty",
            "dim",
            "flickering",
            "garbage",
            "trash",
            "litter",
            "dumping",
            "stray",
            "noise",
            "smell",
            "stench",
            "overflowing bin",
            "manhole",
            "open manhole",
            "uneven road",
        ],
    },
    low: {
        weight: 0.7,
        keywords: [
            "minor",
            "small",
            "cosmetic",
            "paint",
            "graffiti",
            "faded",
            "sign",
            "signage",
            "bench",
            "playground",
            "park",
            "trimming",
            "overgrown",
            "weeds",
            "streetlight",
            "bulb",
            "missing",
            "lost",
        ],
    },
};

const CATEGORY_BASE_DAYS: Record<string, number> = {
    ROAD: 14,
    WATER: 7,
    ELECTRICITY: 5,
    SANITATION: 7,
    PUBLIC_SPACE: 14,
    ENVIRONMENT: 21,
    LOST_FOUND: 3,
    OTHER: 10,
    // Handle AI-suggested casing variants
    Road: 14,
    Water: 7,
    Electricity: 5,
    Sanitation: 7,
    PublicSpace: 14,
    Environment: 21,
    LostFound: 3,
    Other: 10,
};

/**
 * Heuristic-based estimation of resolution time.
 * Analyzes category, title keywords, description severity, and image count
 * to produce a realistic estimate even without AI.
 */
export function estimateResolutionDays(
    input: EstimationInput,
): ResolutionEstimate {
    const { title, description, category, imageCount } = input;
    const text = `${title} ${description}`.toLowerCase();

    // 1. Base days from category
    let baseDays = CATEGORY_BASE_DAYS[category] ?? 10;

    // 2. Find highest severity match
    let maxSeverity = "medium";
    let severityWeight = 1.0;
    let matchedKeyword = "";

    for (const [level, { weight, keywords }] of Object.entries(
        SEVERITY_KEYWORDS,
    )) {
        for (const kw of keywords) {
            if (text.includes(kw)) {
                if (
                    weight > severityWeight ||
                    (weight === severityWeight && !matchedKeyword)
                ) {
                    severityWeight = weight;
                    maxSeverity = level;
                    matchedKeyword = kw;
                }
            }
        }
    }

    // 3. Apply severity multiplier
    let estimatedDays = Math.round(baseDays * severityWeight);

    // 4. Image count factor — more photos may indicate larger/more complex issue
    if (imageCount >= 4) {
        estimatedDays = Math.round(estimatedDays * 1.15);
    } else if (imageCount === 0) {
        // No evidence, harder to prioritize
        estimatedDays = Math.round(estimatedDays * 1.1);
    }

    // 5. Description length factor — longer descriptions often mean more complex issues
    if (description.length > 500) {
        estimatedDays = Math.round(estimatedDays * 1.1);
    }

    // 6. Clamp to realistic range
    estimatedDays = Math.max(1, Math.min(90, estimatedDays));

    // 7. Determine confidence
    let confidence: "low" | "medium" | "high" = "medium";
    if (matchedKeyword && imageCount >= 1) {
        confidence = "high";
    } else if (!matchedKeyword && imageCount === 0) {
        confidence = "low";
    }

    // 8. Build reasoning
    const reasoning = matchedKeyword
        ? `Based on ${category} category and severity indicator "${matchedKeyword}"`
        : `Based on ${category} category baseline`;

    return { estimatedDays, confidence, reasoning };
}

export interface NearbyIssueContext {
    id: string;
    title: string;
    description: string;
    distanceM: number;
    imageUrls: string[];
    titleSimilarity: number;
    descriptionSimilarity: number;
}

interface AnalyzeParams {
    title: string;
    imageUrls: string[];
    description: string;
    nearbyIssues: NearbyIssueContext[];
    /** When true, evaluate whether attached images match the described issue */
    checkImageRelevance?: boolean;
}

/** Run LLaVA multimodal analysis on a new civic issue report */
export async function analyzeIssue(
    params: AnalyzeParams,
): Promise<AIAnalysisResult> {
    const {
        title,
        imageUrls,
        description,
        nearbyIssues,
        checkImageRelevance = false,
    } = params;

    // Fetch images concurrently (skip failures gracefully)
    const images: string[] = [];
    for (const url of imageUrls.slice(0, 5)) {
        try {
            images.push(await urlToBase64(url));
        } catch (err) {
            console.warn("Skipping image due to fetch error:", err);
        }
    }

    // Also fetch first image from the closest potential duplicates for visual comparison
    const topCandidates = nearbyIssues
        .filter((i) => i.titleSimilarity >= 0.3 || i.distanceM <= 100)
        .slice(0, 3);

    for (const candidate of topCandidates) {
        if (candidate.imageUrls.length > 0 && images.length < 8) {
            try {
                images.push(await urlToBase64(candidate.imageUrls[0]));
            } catch (err) {
                console.warn("Skipping nearby issue image:", err);
            }
        }
    }

    const nearbyContext =
        nearbyIssues.length > 0
            ? `Nearby existing issues within 500m:\n${nearbyIssues
                  .map(
                      (i) =>
                          `- [ID: ${i.id}] "${i.title}": ${i.description.slice(0, 300)} (${Math.round(i.distanceM)}m away, title_similarity=${i.titleSimilarity.toFixed(2)}, desc_similarity=${i.descriptionSimilarity.toFixed(2)})`,
                  )
                  .join("\n")}`
            : "No nearby issues found within 500m.";

    // Flag high-similarity candidates explicitly
    const strongCandidates = nearbyIssues.filter(
        (i) =>
            i.titleSimilarity >= 0.5 ||
            (i.titleSimilarity >= 0.3 &&
                i.descriptionSimilarity >= 0.3 &&
                i.distanceM <= 200),
    );
    const candidateWarning =
        strongCandidates.length > 0
            ? `\n\n⚠️ HIGH SIMILARITY ALERT: The following nearby issues are strong duplicate candidates based on text similarity scoring:\n${strongCandidates.map((i) => `- [ID: ${i.id}] title_sim=${i.titleSimilarity.toFixed(2)}, desc_sim=${i.descriptionSimilarity.toFixed(2)}, distance=${Math.round(i.distanceM)}m`).join("\n")}\nCarefully compare these against the new report. If the issue is about the same real-world problem, mark isDuplicate=true.`
            : "";

    const imageComparisonNote =
        topCandidates.length > 0
            ? `\nThe attached images include: first the NEW report's photo(s), then photo(s) from the ${topCandidates.length} closest existing issue(s) for visual comparison. If the photos show the same location/problem, that strongly indicates a duplicate.`
            : "";

    // How many of the loaded images belong to the NEW report vs nearby comparisons
    const newReportImageCount = Math.min(imageUrls.length, images.length);

    const imageRelevanceFields = checkImageRelevance && newReportImageCount > 0
        ? `  "imageModerationPassed": true,
  "imageModerationReason": null`
        : null;

    const jsonTemplate = `{
  "isDuplicate": false,
  "duplicateOfId": null,
  "priorityScore": 5,
  "estimatedResolutionDays": 7,
  "suggestedCategory": "Road",
  "moderationFlags": []${imageRelevanceFields ? `,\n  ${imageRelevanceFields}` : ""}
}`;

    const imageRelevanceRule = checkImageRelevance && newReportImageCount > 0
        ? `
IMAGE RELEVANCE CHECK (applies to the first ${newReportImageCount} image(s) — the new report's photos):
Determine the specific subject of this report from the title and description.
Examples of subject matching:
  • "Pothole on MG Road" → images must show road/pavement damage (cracks, holes, damaged surface)
  • "Broken streetlight" → images must show a streetlight or electrical infrastructure
  • "Garbage dump near park" → images must show garbage, waste, or litter
  • "Water pipe burst" → images must show water leakage, flooding, or plumbing damage
  • "Stray dog menace" → images must show stray animals
Set imageModerationPassed to FALSE if ANY new report image is:
  - Clearly unrelated to the described civic issue (selfie, food photo, nature scene, unrelated building interior, meme, screenshot, solid colour, etc.)
  - A completely different type of problem than described
  - An image that could not plausibly be evidence of the described issue
Set imageModerationPassed to TRUE if every image plausibly shows evidence of the described problem.
imageModerationReason: brief explanation if false (e.g. "Image shows a selfie, not a pothole"), null if true.`
        : "";

    const userMessage = `Analyze this civic issue report and return ONLY valid JSON (no markdown).

Issue title: ${title}
Issue description: ${description}

${nearbyContext}${candidateWarning}${imageComparisonNote}

Return this exact JSON structure:
${jsonTemplate}

Rules:
- isDuplicate: true if a nearby issue likely refers to the SAME real-world problem. This means:
  • Similar (not necessarily identical) title or description, AND within 500m. Titles like "Pothole on MG Road" and "Big pothole near MG Road bus stop" ARE duplicates.
  • Issues about the same type of problem at the same location are duplicates even if worded differently.
  • If title_similarity >= 0.5 and the issue is within 200m, it is almost certainly a duplicate.
  • If the photos show the same scene/location/problem, it IS a duplicate regardless of how the text is worded.
  • When in doubt, lean toward marking as duplicate — merging reports of the same problem is better than having duplicates.
- duplicateOfId: the [ID: xxx] of the matching issue if isDuplicate is true, else null. Pick the closest match.
- priorityScore: 1 (low) to 10 (critical). Base on: safety risk, people affected, infrastructure damage visible in photos
- estimatedResolutionDays: Estimate days to resolve based on the photos, category, and severity. Consider:
  • What the photos show — visible damage extent, infrastructure type, safety risk
  • Category context — electrical issues need certified workers, road repairs need heavy machinery, sanitation may need specialized teams
  • Scale — single pothole (3-5 days) vs collapsed road section (30-60 days), broken streetlight (2-4 days) vs major power line damage (7-14 days)
  • Urgency — safety hazards (exposed wires, sewage overflow, sinkholes) should have shorter estimates (1-3 days) reflecting emergency response
  • Bureaucratic reality — even simple fixes take 2-3 days minimum for Indian municipal process
  • Range guide: trivial (2-5 days), small (5-10 days), medium (10-21 days), large (21-45 days), major infrastructure (45-90 days)
- suggestedCategory: one of Road, Water, Electricity, Sanitation, PublicSpace, Environment, LostFound, Other
- moderationFlags: array of any of: "political", "spam", "offensive", "false_report". Empty array if clean.
${imageRelevanceRule}`;

    const response = await ollama.chat({
        model: MODEL,
        messages: [
            {
                role: "system",
                content:
                    "You are a civic issue classifier. Return ONLY valid JSON, no markdown fences, no explanation.",
            },
            {
                role: "user",
                content: userMessage,
                ...(images.length > 0 ? { images } : {}),
            },
        ],
        options: {
            temperature: 0.1,
            top_p: 0.9,
        },
    });

    // Strip accidental markdown fences and parse
    const raw = response.message.content
        .replace(/```json\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

    try {
        const result = JSON.parse(raw) as AIAnalysisResult;

        // Sanitize to ensure safe defaults
        const sanitized: AIAnalysisResult = {
            isDuplicate: Boolean(result.isDuplicate),
            duplicateOfId: result.duplicateOfId ?? null,
            priorityScore: Math.min(
                10,
                Math.max(1, Number(result.priorityScore) || 5),
            ),
            estimatedResolutionDays: Math.max(
                1,
                Number(result.estimatedResolutionDays) || 7,
            ),
            suggestedCategory: result.suggestedCategory || "Other",
            moderationFlags: Array.isArray(result.moderationFlags)
                ? result.moderationFlags
                : [],
        };

        // Include image moderation result when it was requested
        if (checkImageRelevance && newReportImageCount > 0) {
            sanitized.imageModerationPassed =
                result.imageModerationPassed !== false; // default true if missing
            sanitized.imageModerationReason =
                result.imageModerationReason ?? null;
        }

        return sanitized;
    } catch {
        console.error("Failed to parse Ollama response:", raw);
        // Return safe defaults if parse fails
        const defaults: AIAnalysisResult = {
            isDuplicate: false,
            duplicateOfId: null,
            priorityScore: 5,
            estimatedResolutionDays: 7,
            suggestedCategory: "Other",
            moderationFlags: [],
        };
        if (checkImageRelevance && newReportImageCount > 0) {
            defaults.imageModerationPassed = true; // don't block on parse error
        }
        return defaults;
    }
}

/** Check if Ollama is reachable and the model is available */
export async function healthCheck(): Promise<{
    ok: boolean;
    model: string;
    error?: string;
}> {
    try {
        const models = await ollama.list();
        const modelExists = models.models.some((m: { name: string }) =>
            m.name.startsWith(MODEL.split(":")[0]),
        );
        return { ok: modelExists, model: MODEL };
    } catch (err) {
        return {
            ok: false,
            model: MODEL,
            error: err instanceof Error ? err.message : "Ollama unreachable",
        };
    }
}

// ─── Content Moderation ───────────────────────────────────────────────────────

export interface ModerationResult {
    passed: boolean;
    reason?: string;
    flags: string[];
}

/**
 * Profanity + slur patterns checked against the full text.
 * Uses word-boundary regex so "classic" doesn't match "ass", etc.
 */
const PROFANITY_PATTERNS: RegExp[] = [
    // Common swear words
    /\bf+u+c+k+(ing|er|ed|s|face|head|wit|wad|tard)?\b/i,
    /\bsh[i1]t+(ty|ting|s|face|head|hole)?\b/i,
    /\bb[i1]tch(es|ing|y|ass)?\b/i,
    /\basshole\b/i,
    /\bass\s*(hole|hat|wipe|face|head|clown|wad)?\b/i,
    /\bdick(head|face|wad|s)?\b/i,
    /\bc[o0]ck(sucker|head|s)?\b/i,
    /\bcunt\b/i,
    /\bpussy\b/i,
    /\bwh[o0]re\b/i,
    /\bsl[u0]t\b/i,
    /\bbastard\b/i,
    /\bdamn\s*it\b/i,
    /\bm[o0]th[e3]rf[u0]ck/i,
    // Slurs
    /\bn[i1]gg[ae][rh]?\b/i,
    /\bf[a4]gg[o0]t\b/i,
    /\bk[i1]ke\b/i,
    /\bsp[i1]c\b/i,
    /\bch[i1]nk\b/i,
    /\bg[o0][o0]k\b/i,
    /\bwetback\b/i,
    /\btowelhead\b/i,
    /\bk[i1]ke\b/i,
];

/**
 * Fast regex-based text moderation — runs synchronously, never times out.
 * Exported so the issues POST route can use it without a full Ollama round-trip.
 */
export function checkProfanity(text: string): ModerationResult {
    return basicTextModeration(text);
}

/** Fast regex-based text moderation — runs before Ollama, never times out */
function basicTextModeration(text: string): ModerationResult {
    for (const pattern of PROFANITY_PATTERNS) {
        if (pattern.test(text)) {
            return {
                passed: false,
                reason:
                    "Please keep your report professional. Avoid profanity and offensive language — even if you're frustrated, other community members will read this.",
                flags: ["profanity"],
            };
        }
    }
    return { passed: true, flags: [] };
}

/**
 * Run strict content moderation on issue text and images using LLaVA.
 * Checks for NSFW images, graphic violence, hate speech, explicit language, and spam.
 * Falls back to keyword-based text moderation when Ollama is unavailable.
 * Times out after 45 seconds to avoid blocking issue submission indefinitely.
 */
export async function moderateContent(params: {
    title: string;
    description: string;
    imageUrls: string[];
}): Promise<ModerationResult> {
    const { title, description, imageUrls } = params;

    // Always run basic text check first (instant)
    const textCheck = basicTextModeration(`${title} ${description}`);
    if (!textCheck.passed) return textCheck;

    // Check Ollama availability
    const health = await healthCheck();
    if (!health.ok) {
        console.warn("[moderation] Ollama unavailable — using text-only fallback");
        return { passed: true, flags: [] }; // text already passed above
    }

    // Fetch images for multimodal check (skip failures gracefully)
    const images: string[] = [];
    for (const url of imageUrls.slice(0, 5)) {
        try {
            images.push(await urlToBase64(url));
        } catch {
            console.warn("[moderation] Skipping image fetch:", url);
        }
    }

    const prompt = `You are a strict content moderation system for a civic issue reporting app. Analyze the report content below and return ONLY valid JSON.

Title: ${title}
Description: ${description}
${images.length > 0 ? "\nImages are attached — examine every image carefully." : ""}

Return this exact JSON structure:
{
  "passed": true,
  "flags": [],
  "reason": null
}

Set passed to FALSE if ANY of the following are found:

TEXT rules:
1. Any profanity or swear words (fuck, shit, ass, bitch, damn, bastard, etc.) — even mild ones, even if describing a real civic problem. Users must describe issues professionally.
2. Hate speech, slurs, or content targeting people by race, religion, gender, or sexual orientation
3. Explicit sexual language
4. Threats of violence or incitement
5. Spam or purely promotional text

IMAGE rules:
6. Nudity, sexual content, or pornographic imagery
7. Graphic gore, extreme violence, or disturbing mutilation
8. Images completely unrelated to the civic issue described (e.g. selfies, nature photos, memes, food photos, screenshots — anything that is not clearly showing a real infrastructure or public-space problem)
9. Images that appear to be test uploads or random unrelated photos

PASS the content only if:
- The text is professional and describes a real civic issue without any profanity or offensive language
- Every attached photo visibly shows infrastructure damage, public-space problems, utilities, sanitation, environment, or lost-and-found items relevant to the description

flags: include applicable: "profanity", "nsfw_image", "graphic_violence", "hate_speech", "explicit_language", "unrelated_image", "spam"
reason: short user-facing message explaining the rejection (null if passed)
Be strict — when text contains ANY profanity, set passed to false regardless of how legitimate the civic issue is.`;

    try {
        // Race against a 45-second timeout
        const chatPromise = ollama.chat({
            model: MODEL,
            messages: [
                {
                    role: "system",
                    content:
                        "You are a content moderation system. Return ONLY valid JSON, no markdown fences.",
                },
                {
                    role: "user",
                    content: prompt,
                    ...(images.length > 0 ? { images } : {}),
                },
            ],
            options: { temperature: 0.05 },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("moderation_timeout")), 45_000),
        );

        const response = await Promise.race([chatPromise, timeoutPromise]);

        const raw = response.message.content
            .replace(/```json\n?/gi, "")
            .replace(/```\n?/g, "")
            .trim();

        const result = JSON.parse(raw);
        return {
            passed: result.passed !== false, // default to true if key missing
            flags: Array.isArray(result.flags) ? result.flags : [],
            reason: result.reason ?? undefined,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "moderation_timeout") {
            console.warn("[moderation] LLaVA timed out — falling back to text-only check");
        } else {
            console.error("[moderation] Error:", err);
        }
        // On timeout or parse error: fall back to text-only (already passed above)
        return { passed: true, flags: [] };
    }
}
