import { describe, it, expect } from "vitest";
import { Rng, roll, d20, parseDice } from "../src/rules/dice.js";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.int(1, 20)).toBe(b.int(1, 20));
  });

  it("resumes from saved state", () => {
    const a = new Rng(7);
    a.int(1, 20);
    const state = a.getState();
    const b = new Rng(0);
    b.setState(state);
    expect(a.int(1, 20)).toBe(b.int(1, 20));
  });

  it("stays in range", () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

describe("parseDice", () => {
  it("parses NdM+K", () => {
    expect(parseDice("2d6+3")).toEqual({ count: 2, sides: 6, modifier: 3 });
    expect(parseDice("d20")).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(parseDice("4d8-2")).toEqual({ count: 4, sides: 8, modifier: -2 });
  });

  it("rejects garbage", () => {
    expect(() => parseDice("banana")).toThrow();
    expect(() => parseDice("2d7")).toThrow();
    expect(() => parseDice("999d6")).toThrow();
  });
});

describe("roll", () => {
  it("sums rolls plus modifier", () => {
    const rng = new Rng(123);
    const r = roll(rng, "3d6+2");
    expect(r.rolls).toHaveLength(3);
    expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0) + 2);
  });
});

describe("d20", () => {
  it("advantage keeps the higher roll", () => {
    const rng = new Rng(5);
    const r = d20(rng, { advantage: true });
    expect(r.rolls).toHaveLength(2);
    expect(r.kept).toBe(Math.max(...r.rolls));
  });

  it("disadvantage keeps the lower roll", () => {
    const rng = new Rng(5);
    const r = d20(rng, { disadvantage: true });
    expect(r.kept).toBe(Math.min(...r.rolls));
  });

  it("advantage and disadvantage cancel", () => {
    const rng = new Rng(5);
    const r = d20(rng, { advantage: true, disadvantage: true });
    expect(r.rolls).toHaveLength(1);
  });

  it("flags naturals", () => {
    // Find a seed producing a natural 20 to prove the flag works.
    for (let seed = 0; seed < 200; seed++) {
      const r = d20(new Rng(seed));
      if (r.kept === 20) {
        expect(r.natural20).toBe(true);
        return;
      }
    }
    throw new Error("no natural 20 in 200 seeds — RNG is suspicious");
  });
});
