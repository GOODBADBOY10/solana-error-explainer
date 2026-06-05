import '../config.js';

import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from './logger.js';

const RPC_URL = process.env.HELIUS_RPC_URL;

if (!RPC_URL) {
  throw new Error('HELIUS_RPC_URL is not set in environment variables');
}

const connection = new Connection(RPC_URL, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

export function isValidSignature(signature) {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}

export async function fetchTransaction(signature) {
  try {
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!transaction) {
      const failedTx = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized',
      });
      if (!failedTx) return null;
      return failedTx;
    }

    return transaction;
  } catch (error) {
    logger.error(`Failed to fetch transaction ${signature}: ${error.message}`);
    throw new Error(`Failed to fetch transaction: ${error.message}`);
  }
}

export function extractTransactionData(transaction) {
  const meta = transaction.meta;
  const message = transaction.transaction?.message;

  const data = {
    success: meta?.err === null,
    error: meta?.err || null,
    logs: meta?.logMessages || [],
    fee: meta?.fee || 0,
    computeUnitsConsumed: meta?.computeUnitsConsumed || 0,
    preBalances: meta?.preBalances || [],
    postBalances: meta?.postBalances || [],
    innerInstructions: meta?.innerInstructions || [],
    accountKeys: [],
    instructions: [],
    slot: transaction.slot,
    blockTime: transaction.blockTime,
  };

  try {
    if (message?.staticAccountKeys) {
      data.accountKeys = message.staticAccountKeys.map(k => k.toBase58());
    } else if (message?.accountKeys) {
      data.accountKeys = message.accountKeys.map(k =>
        k instanceof PublicKey ? k.toBase58() : k.toString()
      );
    }
  } catch (e) {
    logger.warn('Could not extract account keys');
  }

  data.balanceChanges = data.preBalances.map((pre, i) => ({
    account: data.accountKeys[i] || `Account ${i}`,
    change: (data.postBalances[i] - pre) / 1e9,
  })).filter(b => b.change !== 0);

  return data;
}

export function mapErrorCode(error) {
  if (!error) return null;

  const errorStr = JSON.stringify(error);

  const errorMap = {
    'InsufficientFundsForFee': 'Insufficient SOL to pay transaction fee',
    'AccountNotFound': 'One of the accounts in this transaction does not exist',
    'InvalidAccountData': 'Account data is invalid or corrupted',
    'InvalidArgument': 'Invalid argument passed to program',
    'InvalidInstructionData': 'Instruction data is malformed',
    'InvalidProgramId': 'Program ID is invalid',
    'MissingRequiredSignature': 'Transaction is missing a required signature',
    'AccountAlreadyInitialized': 'Account has already been initialized',
    'UninitializedAccount': 'Account has not been initialized yet',
    'NotEnoughAccountKeys': 'Transaction is missing required account keys',
    'AccountNotRentExempt': 'Account does not have enough SOL to be rent-exempt',
    'IllegalOwner': 'Account is owned by wrong program',
    'custom: 1': 'Slippage tolerance exceeded — price moved too much during swap',
    'custom: 6000': 'Slippage tolerance exceeded',
    'custom: 6001': 'Invalid token account',
    'custom: 6002': 'Insufficient liquidity in pool',
    'custom: 6003': 'Pool is disabled or paused',
    'custom: 0x1': 'Insufficient token balance for this operation',
    'custom: 0x11': 'Arithmetic overflow — amount too large',
    'custom: 0x12': 'Invalid pool state',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (errorStr.includes(key)) return value;
  }

  return null;
}