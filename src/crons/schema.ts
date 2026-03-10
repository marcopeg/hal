import { z } from "zod";

export const CronTargetSchema = z.object({
  projectId: z.string().min(1),
  userId: z.number().int().optional(),
  flowResult: z.boolean().optional(),
});

export const MdFrontmatterSchema = z
  .object({
    enabled: z.boolean().default(false),
    schedule: z.string().optional(),
    runAt: z.string().optional(),
    targets: z.array(CronTargetSchema).min(1),
  })
  .refine((data) => !!(data.schedule || data.runAt), {
    message: "Exactly one of schedule or runAt is required",
  })
  .refine((data) => !(data.schedule && data.runAt), {
    message: "Only one of schedule or runAt may be set",
  });

export type MdFrontmatter = z.infer<typeof MdFrontmatterSchema>;
