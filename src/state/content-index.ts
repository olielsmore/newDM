import { ContentRecord, RARITY_RANK } from "../content/types.js";
import { crToNumber } from "../rules/encounter.js";

export interface ContentIndexRow {
  kind: string;
  id: string;
  data: string;
  name: string;
  cr: number | null;
  type: string | null;
  environments: string | null;
  size: string | null;
  rarity: string | null;
  rarityRank: number | null;
  category: string | null;
  attunement: number | null;
  spellLevel: number | null;
  school: string | null;
  classes: string | null;
  keywords: string;
}

export function indexRecord(record: ContentRecord): ContentIndexRow {
  const data = JSON.stringify(record);
  if (record.kind === "monster") {
    return {
      kind: "monster",
      id: record.id,
      data,
      name: record.name,
      cr: crToNumber(record.cr),
      type: record.type,
      environments: JSON.stringify(record.environments),
      size: record.size,
      rarity: null,
      rarityRank: null,
      category: null,
      attunement: null,
      spellLevel: null,
      school: null,
      classes: null,
      keywords: [record.name, record.type, record.description, record.tactics, ...record.environments].join(" ").toLowerCase(),
    };
  }
  if (record.kind === "spell") {
    return {
      kind: "spell",
      id: record.id,
      data,
      name: record.name,
      cr: null,
      type: null,
      environments: null,
      size: null,
      rarity: null,
      rarityRank: null,
      category: null,
      attunement: null,
      spellLevel: record.level,
      school: record.school,
      classes: JSON.stringify(record.classes),
      keywords: [record.name, record.school, record.definition.castingTime, ...(record.classes ?? [])].join(" ").toLowerCase(),
    };
  }
  return {
    kind: "item",
    id: record.id,
    data,
    name: record.name,
    cr: null,
    type: null,
    environments: null,
    size: null,
    rarity: record.rarity,
    rarityRank: RARITY_RANK[record.rarity.toLowerCase()] ?? 0,
    category: record.category,
    attunement: record.attunement ? 1 : 0,
    spellLevel: null,
    school: null,
    classes: null,
    keywords: [record.name, record.rarity, record.category, record.mechanics].join(" ").toLowerCase(),
  };
}
