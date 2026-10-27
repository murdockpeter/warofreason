import { z } from 'zod';
import { idSchema } from './legacy-campaign';

export const historicalIdentitySchema = z
  .object({
    catalogueId: z.literal('fontenoy-tournai-1745'),
    catalogueVersion: z.literal('0.1.0'),
    organizationId: z.string().min(1).max(120),
  })
  .strict();
const ratingSchema = z
  .object({ unitId: idSchema, quality: z.enum(['elite', 'trained']) })
  .strict();
export const historicalReviewSchema = z
  .object({
    ratings: z.array(ratingSchema).max(1000),
    acknowledgedScale: z
      .boolean()
      .refine((value) => value, 'Review the regimental record scale.'),
    acknowledgedDeployment: z
      .boolean()
      .refine((value) => value, 'Review the provisional deployment.'),
    acknowledgedSourceGaps: z
      .boolean()
      .refine((value) => value, 'Review source coverage and gaps.'),
    notes: z.string().trim().min(1).max(4000),
  })
  .strict();
export const historicalProfileSchema = z
  .object({
    groupingVersion: z
      .enum(['service_arm_v0.1', 'reported_subunits_v0.2'])
      .optional(),
    id: z.literal('fontenoy_regimental_records_v0.1'),
    catalogueVersion: z.literal('0.1.0'),
    reviewedAt: z.iso.datetime().nullable(),
    reviewNotes: z.string().max(4000),
    openingRatings: z.array(ratingSchema).max(1000),
  })
  .strict();
export type HistoricalReview = z.infer<typeof historicalReviewSchema>;
export const historicalRegroupSchema = z
  .object({
    corpsIds: z.array(idSchema).min(1).max(100),
    notes: z.string().trim().min(1).max(500),
  })
  .strict();
