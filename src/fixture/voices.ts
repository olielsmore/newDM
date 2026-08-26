import { NpcVoice } from "../state/db.js";

export const NPC_VOICES: NpcVoice[] = [
  {
    id: "marla",
    diction: "Dry, local, never quite finishes a joke the same way twice.",
    tics: "Drums the counter with the three fingers she has left.",
    agenda: "Keep the miners' table sacred and the town from tearing itself apart.",
    neverSay: "Would never admit she believes Tam's pale-folk story out loud.",
  },
  {
    id: "greely",
    diction: "Too many words, all of them hedging. Promises first, details never.",
    tics: "Sweats at the temples; fiddles with cufflinks.",
    agenda: "Protect his debt and his name. Delay the truth until he can bury it.",
    neverSay: "Would never volunteer that he ordered the east gallery reopened.",
  },
  {
    id: "oswin",
    diction: "Soft, precise, old-chapel. Calls people by their childhood names.",
    tics: "Hands shake when he pours oil; memory does not.",
    agenda: "Get Sera home and keep the living from joining the dead.",
    neverSay: "Would never pretend the Dawnfather guarantees safety.",
  },
  {
    id: "tam",
    diction: "Short sentences. Voice cracks when he says 'pale'.",
    tics: "Will not sit with his back to a dark doorway. Needs a lit candle.",
    agenda: "Be believed. Not go back down.",
    neverSay: "Would never joke about what he saw.",
  },
  {
    id: "derva",
    diction: "Dwarven, practical, no poetry. Measures people by whether they brought a lamp.",
    tics: "Trims a lantern wick while she talks.",
    agenda: "Keep the remaining miners alive behind the arch until someone competent arrives.",
    neverSay: "Would never say 'I told you so' until everyone is out.",
  },
  {
    id: "corvin",
    diction: "Traveling-salesman warmth that never quite reaches the eyes.",
    tics: "Touches the salt-charm at his throat when the mine is mentioned.",
    agenda: "Trade rumors for coin. Stay one day ahead of trouble.",
    neverSay: "Would never admit why he wears a miner's charm.",
  },
];
