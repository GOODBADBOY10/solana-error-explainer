import Joi from 'joi';

const explainSchema = Joi.object({
  signature: Joi.string()
    .pattern(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid Solana transaction signature format',
      'any.required': 'Transaction signature is required',
      'string.empty': 'Transaction signature cannot be empty',
    }),
});

export function validateExplainRequest(req, res, next) {
  const { error, value } = explainSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(d => d.message),
    });
  }

  req.body = value;
  next();
}