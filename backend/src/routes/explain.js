import { Router } from 'express';
import { validateExplainRequest } from '../middleware/validate.js';
import {
  fetchTransaction,
  extractTransactionData,
  isValidSignature,
  mapErrorCode,
} from '../services/solana.js';
import { analyzeTransaction } from '../services/gemini.js';
import { logger } from '../services/logger.js';

export const explainRouter = Router();

explainRouter.post('/', validateExplainRequest, async (req, res, next) => {
  const { signature } = req.body;

  try {
    if (!isValidSignature(signature)) {
      return res.status(400).json({
        error: 'Invalid transaction signature format',
      });
    }

    logger.info(`Explaining transaction: ${signature.slice(0, 16)}...`);

    const transaction = await fetchTransaction(signature);

    if (!transaction) {
      return res.status(404).json({
        error: 'Transaction not found. It may be too old or the signature is incorrect.',
        suggestion: 'Solana only stores recent transactions. Try checking a block explorer like Solscan for older transactions.',
      });
    }

    const transactionData = extractTransactionData(transaction);
    const errorCode = mapErrorCode(transactionData.error);
    const explanation = await analyzeTransaction(transactionData, errorCode);

    const response = {
      signature,
      status: transactionData.success ? 'success' : 'failed',
      slot: transactionData.slot,
      timestamp: transactionData.blockTime
        ? new Date(transactionData.blockTime * 1000).toISOString()
        : null,
      fee: (transactionData.fee / 1e9).toFixed(6),
      computeUnitsConsumed: transactionData.computeUnitsConsumed,
      balanceChanges: transactionData.balanceChanges,
      explanation,
      rawError: transactionData.error,
      knownError: errorCode,
    };

    logger.info(`Successfully explained transaction: ${signature.slice(0, 16)}...`);

    return res.json(response);
  } catch (error) {
    logger.error(`Error explaining transaction ${signature.slice(0, 16)}...: ${error.message}`);
    next(error);
  }
});

explainRouter.get('/status/:signature', async (req, res, next) => {
  const { signature } = req.params;

  try {
    if (!isValidSignature(signature)) {
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    const transaction = await fetchTransaction(signature);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.json({
      signature,
      status: transaction.meta?.err === null ? 'success' : 'failed',
      slot: transaction.slot,
      timestamp: transaction.blockTime
        ? new Date(transaction.blockTime * 1000).toISOString()
        : null,
    });
  } catch (error) {
    next(error);
  }
});