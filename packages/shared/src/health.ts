import { z } from "zod";

export const HealthResponse = z.object({
  ok: z.literal(true),
  service: z.literal("ff-api"),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
