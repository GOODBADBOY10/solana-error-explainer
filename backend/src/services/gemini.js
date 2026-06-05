import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger.js';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.3,
    topP: 0.8,
    maxOutputTokens: 1024,
  },
});

function buildPrompt(transactionData, errorCode) {
  return `You are a Solana blockchain expert helping users understand their transaction results.

Analyze this Solana transaction and provide a clear, helpful explanation.

## Transaction Data:
- Status: ${transactionData.success ? 'SUCCESS' : 'FAILED'}
- Error: ${JSON.stringify(transactionData.error) || 'None'}
- Known Error Description: ${errorCode || 'Unknown'}
- Fee Paid: ${(transactionData.fee / 1e9).toFixed(6)} SOL
- Compute Units Used: ${transactionData.computeUnitsConsumed}
- Slot: ${transactionData.slot}
- Time: ${transactionData.blockTime ? new Date(transactionData.blockTime * 1000).toISOString() : 'Unknown'}

## Transaction Logs:
${transactionData.logs.slice(0, 50).join('\n') || 'No logs available'}

## Balance Changes:
${transactionData.balanceChanges.map(b => `${b.account.slice(0, 8)}...: ${b.change > 0 ? '+' : ''}${b.change.toFixed(6)} SOL`).join('\n') || 'No balance changes'}

## Your Response Must Include:

1. **What Happened** (1-2 sentences, plain English, no jargon)
2. **Why It ${transactionData.success ? 'Succeeded' : 'Failed'}** (specific reason based on logs/error)
3. **How To Fix It** (if failed — specific actionable steps; if succeeded — confirm what was done)
4. **Risk Level**: ${transactionData.success ? 'N/A - Transaction succeeded' : 'Rate as LOW/MEDIUM/HIGH and explain why'}

Rules:
- Use simple language a non-developer can understand
- Be specific, not generic
- If it's a swap failure, mention slippage
- If it's insufficient funds, mention exactly what's needed
- Keep total response under 300 words
- Format with clear headings using **bold**
- Do NOT include raw transaction data or signatures in your response`;
}

export async function analyzeTransaction(transactionData, errorCode) {
  try {
    const prompt = buildPrompt(transactionData, errorCode);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) throw new Error('Empty response from Gemini');

    return text;
  } catch (error) {
    logger.error(`Gemini analysis failed: ${error.message}`);

    if (errorCode) {
      return `**What Happened**\nYour transaction ${transactionData.success ? 'succeeded' : 'failed'}.\n\n**Why**\n${errorCode}\n\n**How To Fix It**\nPlease check your wallet balance and try again.`;
    }

    throw new Error(`AI analysis failed: ${error.message}`);
  }
}