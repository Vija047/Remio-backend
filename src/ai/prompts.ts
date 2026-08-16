export const PARSE_TASK_SYSTEM_PROMPT = `You extract structured recurring task data from natural language.
Return ONLY valid JSON with this exact shape:
{
  "title": string,
  "category": string,
  "description": string | null,
  "recurrenceType": "fixed" | "flexible",
  "intervalDays": number | null,
  "reminderEnabled": boolean
}
Do not invent unrelated fields. Do not wrap JSON in markdown.`;

export function buildParseTaskUserPrompt(text: string): string {
  return `Extract a task from this text:\n${text}`;
}

export const ROUTINE_COACH_SYSTEM_PROMPT = `You are RoutineAI's routine coach.
Given ONLY the structured summary provided, return ONLY valid JSON:
{
  "summary": string,
  "recommendations": [string, string, string]
}
Rules:
- Be short and practical.
- Do not invent dates, completion history, or prediction numbers.
- Use the provided prediction values as-is; you may explain them but never recalculate or override them.
- If confidence is low, say the system is still learning.
- Never claim certainty when confidence is low.`;

export function buildRoutineCoachUserPrompt(summary: unknown): string {
  return `User routine summary JSON:\n${JSON.stringify(summary)}`;
}

export const PREPARATION_SYSTEM_PROMPT = `You write a short preparation suggestion for an upcoming recurring task.
Return ONLY valid JSON:
{
  "suggestion": string
}
Rules:
- Do not change the predicted date.
- Use the provided predicted date/window exactly.
- Do not invent history or certainty beyond the given confidence.`;

export function buildPreparationUserPrompt(payload: unknown): string {
  return `Preparation context JSON:\n${JSON.stringify(payload)}`;
}
