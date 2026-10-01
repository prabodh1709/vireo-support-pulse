import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey,
});

export async function generateComplaintDigest(
  tickets: Array<{
    customerMessage: string;
    agentNotes: string;
  }>
) {
  const text = tickets
    .filter((ticket) => ticket.customerMessage || ticket.agentNotes)
    .slice(0, 100)
    .map(
      (ticket, index) =>
        `Ticket ${index + 1}:
Customer: ${ticket.customerMessage}
Agent notes: ${ticket.agentNotes}`
    )
    .join("\n\n");

  if (!text) {
    return "No complaint text is available for this period.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: `You are analyzing Vireo Audio support tickets.

Identify the 3 most important complaint themes from the ticket text below.

Return exactly 3 complaint themes.

For each theme use exactly this format:

THEME: <short theme name>
CUSTOMERS: <one concise sentence describing what customers are experiencing>
IMPACT: <one concise sentence explaining why it matters operationally>

Do not use Markdown.
Do not use bullets.
Do not add headings, introductions, conclusions, or extra text.
Do not invent numbers or facts.

Ticket data:

${text}`,
  });

  const result = response.text ?? "";

  return result
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}