import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export type AiTriageResult = {
  score: number; // 0 to 100
  recommendation: "approve" | "review" | "reject";
  reason: string;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
};

export type TriageInput = {
  name: string;
  email: string;
  selectedServices: string[];
  company?: string | null;
  useCase?: string | null;
  message?: string | null;
};

const triageSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(100)
    .describe("Score from 0 (likely spam/fraud) to 100 (high-quality, genuine request)"),
  recommendation: z
    .enum(["approve", "review", "reject"])
    .describe("Recommended action for the admin"),
  reason: z
    .string()
    .describe("A concise 1-2 sentence explanation of why this recommendation was given"),
  summary: z
    .string()
    .describe("A crisp 1-line summary of what the user wants and their intended use case"),
  riskLevel: z
    .enum(["low", "medium", "high"])
    .describe("Assessed risk of abuse, throwaway identity, or non-genuine usage"),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence percentage in this triage assessment"),
});

// Heuristic fallback if GEMINI_API_KEY is not configured
function fallbackTriage(input: TriageInput): AiTriageResult {
  const email = input.email.toLowerCase();
  const disposableDomains = [
    "tempmail.com",
    "guerrillamail.com",
    "10minutemail.com",
    "mailinator.com",
    "throwawaymail.com",
    "yopmail.com",
    "trashmail.com",
    "dispostable.com",
  ];

  const domain = email.split("@")[1] || "";
  const isDisposable = disposableDomains.includes(domain);

  const useCaseLen = (input.useCase || "").trim().length;
  const messageLen = (input.message || "").trim().length;
  const totalServices = input.selectedServices.length;

  let score = 70;
  let riskLevel: "low" | "medium" | "high" = "low";
  let recommendation: "approve" | "review" | "reject" = "approve";
  let reason = "Valid subscription request with standard details.";

  if (isDisposable) {
    score = 15;
    riskLevel = "high";
    recommendation = "reject";
    reason = "Flagged: Email appears to be from a temporary/disposable email provider.";
  } else if (totalServices > 5 && useCaseLen < 15) {
    score = 45;
    riskLevel = "medium";
    recommendation = "review";
    reason = "Requested multiple subscriptions with minimal use-case explanation.";
  } else if (useCaseLen >= 30 || input.company) {
    score = 90;
    riskLevel = "low";
    recommendation = "approve";
    reason = "Detailed use-case provided with verified context.";
  }

  const summary = `${input.name} requested ${totalServices} service(s) (${input.selectedServices.slice(0, 3).join(", ")}${totalServices > 3 ? "..." : ""}).`;

  return {
    score,
    recommendation,
    reason,
    summary,
    riskLevel,
    confidence: 85,
  };
}

export async function analyzeSubscriptionRequest(
  input: TriageInput
): Promise<AiTriageResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return fallbackTriage(input);
  }

  try {
    const google = createGoogleGenerativeAI({
      apiKey,
    });

    const model = google("gemini-1.5-flash");

    const prompt = `
You are an expert AI triage assistant for SocZen, a premium subscription grant desk.
Analyze the following subscription request for legitimacy, clear intent, and risk of abuse.

User Details:
- Name: ${input.name}
- Email: ${input.email}
- Company: ${input.company || "Not provided"}
- Requested Subscriptions: ${input.selectedServices.join(", ")}
- Intended Use Case: ${input.useCase || "Not provided"}
- Additional Message: ${input.message || "Not provided"}

Assessment Criteria:
1. Legitimacy: Does the use case make sense for the requested tools?
2. Spam/Abuse Risk: Does the email look fake/disposable, or is the request overly greedy without justification?
3. Score (0-100): 80-100 = Excellent candidate (Approve), 50-79 = Legitimate but needs manual check (Review), <50 = Likely spam/unreasonable (Reject).

Provide your structured triage analysis.
`;

    const { object } = await generateObject({
      model,
      schema: triageSchema,
      prompt,
    });

    return object;
  } catch (error) {
    console.error("AI Triage generation error (falling back to heuristic):", error);
    return fallbackTriage(input);
  }
}

