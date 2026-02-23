import { colors } from '../theme/colors';
import type { DocumentClassification } from '../types';

/**
 * Single source of truth for document classification data.
 *
 * CLASSIFICATIONS: full descriptor array — label, value, color — used by
 *   classify.tsx and edit-document.tsx to render the classification buttons.
 *
 * CLASSIFICATION_LABELS: value → display label lookup used wherever a
 *   document's classification needs to be shown as human-readable text.
 *
 * CLASSIFICATION_COLORS: value → theme color lookup used to color-code
 *   document entries in lists and detail views.
 *
 * Previously, these were copy-pasted across classify.tsx, edit-document.tsx,
 * confirmation.tsx, and export.tsx. Any label or color change must now be
 * made only here.
 */

export const CLASSIFICATIONS: { label: string; value: DocumentClassification; color: string }[] = [
  { label: 'Bill of Lading',    value: 'bill_of_lading',     color: colors.info },
  { label: 'Proof of Delivery', value: 'proof_of_delivery',  color: colors.success },
  { label: 'Receipt',           value: 'receipt',            color: colors.warning },
  { label: 'Inventory',         value: 'inventory',          color: colors.primary },
];

export const CLASSIFICATION_LABELS: Record<DocumentClassification, string> = {
  bill_of_lading:    'Bill of Lading',
  proof_of_delivery: 'Proof of Delivery',
  receipt:           'Receipt',
  inventory:         'Inventory',
};

export const CLASSIFICATION_COLORS: Record<DocumentClassification, string> = {
  bill_of_lading:    colors.info,
  proof_of_delivery: colors.success,
  receipt:           colors.warning,
  inventory:         colors.primary,
};
