/**
 * Internal content records. Every source adapter (SRD JSON now, the
 * user's Postgres later) maps into this shape. The engine never reads
 * source-specific fields.
 */
import { z } from "zod";
import { SheetSchema } from "../rules/sheet.js";
import { SpellDefinitionSchema } from "../rules/spells.js";

export const ContentKind = z.enum(["monster", "spell", "item"]);
export type ContentKind = z.infer<typeof ContentKind>;

export const MonsterRecordSchema = z.object({
  kind: z.literal("monster"),
  id: z.string(),
  name: z.string(),
  cr: z.string(),
  type: z.string(),
  size: z.string().default("medium"),
  environments: z.array(z.string()).default([]),
  description: z.string().default(""),
  tactics: z.string().default(""),
  sheet: SheetSchema,
});
export type MonsterRecord = z.infer<typeof MonsterRecordSchema>;

export const SpellRecordSchema = z.object({
  kind: z.literal("spell"),
  id: z.string(),
  name: z.string(),
  level: z.number().int(),
  school: z.string(),
  classes: z.array(z.string()).default([]),
  definition: SpellDefinitionSchema,
  /** prose fallback when a spell has no structured definition yet */
  mechanics: z.string().optional(),
});
export type SpellRecord = z.infer<typeof SpellRecordSchema>;

export const ItemRecordSchema = z.object({
  kind: z.literal("item"),
  id: z.string(),
  name: z.string(),
  rarity: z.string().default("mundane"),
  category: z.string().default("gear"),
  attunement: z.boolean().default(false),
  costGp: z.number().optional(),
  mechanics: z.string().default(""),
});
export type ItemRecord = z.infer<typeof ItemRecordSchema>;

export type ContentRecord = MonsterRecord | SpellRecord | ItemRecord;

export interface ContentSource {
  readonly name: string;
  load(): Promise<ContentRecord[]>;
}

export function contentId(name: string): string {
  return name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const RARITY_RANK: Record<string, number> = {
  mundane: 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  "very rare": 4,
  legendary: 5,
  artifact: 6,
};
