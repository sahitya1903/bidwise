// Input schemas (zod). Used by the validate middleware for HTTP requests AND by the
// services, so a rule is enforced even when a service is called directly (tests, jobs).
const { z } = require('zod');
const AppError = require('./AppError');
const { formatINR } = require('./money');
const { CATEGORIES } = require('../models/Auction');

const MIN_DURATION_MS = 60 * 1000; // BR-02: 1 minute (for demos)
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // BR-02: 30 days
const MIN_PRICE = 100; // BR-01: ₹1 in paise

const paise = (label) =>
  z.number({ error: `${label} must be a number` }).int(`${label} must be a whole number of paise`);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name is too long'),
  email: z.email('Enter a valid email address').trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const auctionFields = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120, 'Title is too long'),
  description: z.string().trim().max(2000, 'Description is too long').default(''),
  category: z.enum(CATEGORIES, 'Choose a valid category').default('Other'),
  imageUrl: z.union([z.url('Image URL must be a valid URL'), z.literal('')]).default(''),
  startingPrice: paise('Starting price').min(MIN_PRICE, 'Starting price must be at least ₹1'),
  reservePrice: paise('Reserve price').min(0, 'Reserve price cannot be negative').default(0),
  minIncrement: paise('Minimum increment').min(MIN_PRICE, 'Minimum increment must be at least ₹1'),
  startTime: z.coerce.date({ error: 'Start time is not a valid date' }).optional(),
  endTime: z.coerce.date({ error: 'End time is not a valid date' }),
});

// BR-01 and BR-02: rules that compare two fields.
function auctionRules(data, ctx) {
  if (data.reservePrice !== 0 && data.reservePrice < data.startingPrice) {
    ctx.addIssue({
      code: 'custom',
      path: ['reservePrice'],
      message: `Reserve price must be 0 (no reserve) or at least the starting price (${formatINR(data.startingPrice)})`,
    });
  }
  if (data.startTime && data.endTime) {
    const duration = data.endTime - data.startTime;
    if (duration <= 0) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after the start time' });
    } else if (duration < MIN_DURATION_MS) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'An auction must run for at least 1 minute',
      });
    } else if (duration > MAX_DURATION_MS) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'An auction can run for at most 30 days' });
    }
  }
}

const createAuctionSchema = auctionFields.superRefine(auctionRules);
const updateAuctionSchema = auctionFields.partial().strict('Unknown field');

const bidSchema = z.object({
  amount: paise('Bid amount').positive('Bid amount must be more than 0'),
});

function parseOrThrow(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw new AppError(400, 'VALIDATION_ERROR', { fields }, result.error.issues[0].message);
}

module.exports = {
  registerSchema,
  loginSchema,
  createAuctionSchema,
  updateAuctionSchema,
  bidSchema,
  parseOrThrow,
  MIN_DURATION_MS,
  MAX_DURATION_MS,
};
