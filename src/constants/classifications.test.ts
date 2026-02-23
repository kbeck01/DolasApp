/**
 * Tests for src/constants/classifications.ts
 *
 * Level 1 (Unit): Validates the shape and values of the three exported
 *                 constants — CLASSIFICATIONS, CLASSIFICATION_LABELS,
 *                 CLASSIFICATION_COLORS. These are pure data; there is no
 *                 integration or acceptance boundary to test at higher levels.
 *
 * The four classification values are the contract between this app and the
 * CSV export format, the filename generation in JobService, and every screen
 * that renders classification UI. Any accidental rename here would silently
 * break stored jobs, so the exact string values are pinned by these tests.
 */

import {
  CLASSIFICATIONS,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_COLORS,
} from './classifications';

const EXPECTED_VALUES = [
  'bill_of_lading',
  'proof_of_delivery',
  'receipt',
  'inventory',
] as const;

// ─── CLASSIFICATIONS array ────────────────────────────────────────────────────

describe('Unit | CLASSIFICATIONS', () => {
  it('contains exactly four entries', () => {
    // Four classification types are the product contract — adding or removing
    // one here affects CSV headers, filename templates, and all UI screens.
    expect(CLASSIFICATIONS).toHaveLength(4);
  });

  it('contains all four expected classification values', () => {
    // Pins the exact value strings so a typo cannot silently break stored jobs.
    const values = CLASSIFICATIONS.map(c => c.value);
    for (const expected of EXPECTED_VALUES) {
      expect(values).toContain(expected);
    }
  });

  it('every entry has a non-empty label', () => {
    // Labels are shown on buttons — a blank label would render as empty text.
    for (const c of CLASSIFICATIONS) {
      expect(typeof c.label).toBe('string');
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty color string', () => {
    // Colors come from the theme; an undefined token would render transparent.
    for (const c of CLASSIFICATIONS) {
      expect(typeof c.color).toBe('string');
      expect(c.color.length).toBeGreaterThan(0);
    }
  });

  it('values match the canonical DocumentClassification strings exactly', () => {
    expect(CLASSIFICATIONS[0].value).toBe('bill_of_lading');
    expect(CLASSIFICATIONS[1].value).toBe('proof_of_delivery');
    expect(CLASSIFICATIONS[2].value).toBe('receipt');
    expect(CLASSIFICATIONS[3].value).toBe('inventory');
  });
});

// ─── CLASSIFICATION_LABELS ────────────────────────────────────────────────────

describe('Unit | CLASSIFICATION_LABELS', () => {
  it('has an entry for every classification value', () => {
    // Ensures no screen that does CLASSIFICATION_LABELS[doc.classification]
    // can ever fall through to the || fallback.
    for (const value of EXPECTED_VALUES) {
      expect(CLASSIFICATION_LABELS[value]).toBeDefined();
    }
  });

  it('labels are non-empty strings', () => {
    for (const value of EXPECTED_VALUES) {
      expect(typeof CLASSIFICATION_LABELS[value]).toBe('string');
      expect(CLASSIFICATION_LABELS[value].length).toBeGreaterThan(0);
    }
  });

  it('labels match the corresponding CLASSIFICATIONS entries', () => {
    // CLASSIFICATION_LABELS must be consistent with CLASSIFICATIONS so that
    // screens using either constant show the same text for the same type.
    for (const c of CLASSIFICATIONS) {
      expect(CLASSIFICATION_LABELS[c.value]).toBe(c.label);
    }
  });
});

// ─── CLASSIFICATION_COLORS ────────────────────────────────────────────────────

describe('Unit | CLASSIFICATION_COLORS', () => {
  it('has an entry for every classification value', () => {
    for (const value of EXPECTED_VALUES) {
      expect(CLASSIFICATION_COLORS[value]).toBeDefined();
    }
  });

  it('colors are non-empty strings', () => {
    for (const value of EXPECTED_VALUES) {
      expect(typeof CLASSIFICATION_COLORS[value]).toBe('string');
      expect(CLASSIFICATION_COLORS[value].length).toBeGreaterThan(0);
    }
  });

  it('colors match the corresponding CLASSIFICATIONS entries', () => {
    // CLASSIFICATION_COLORS must be consistent with CLASSIFICATIONS so that
    // both the classify screen (uses CLASSIFICATIONS) and the export screen
    // (uses CLASSIFICATION_COLORS) render the same color for the same type.
    for (const c of CLASSIFICATIONS) {
      expect(CLASSIFICATION_COLORS[c.value]).toBe(c.color);
    }
  });
});
