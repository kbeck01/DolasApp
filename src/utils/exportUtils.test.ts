/**
 * Tests for src/utils/exportUtils.ts
 *
 * Level 1 (Unit):       generateJobZip logic in isolation — asserts which files
 *                        are added to the zip and that missing images are skipped.
 *
 * Level 2 (Integration): Verifies expo-file-system interactions — File.bytes()
 *                        called per document, File.write() called with zip data,
 *                        zip written to Paths.cache with the correct filename.
 *
 * Level 3 (Acceptance):  Two-document job → generateJobZip → assert returned URI
 *                        is a .zip in cache, both image filenames were added to the
 *                        zip, and the CSV contains correct job data.
 *
 * jszip is mocked globally (jest.setup.js). The mock returns a fresh zip instance
 * per new JSZip() call. Access the instance via:
 *   const zipInstance = (JSZip as jest.Mock).mock.results[0].value
 *
 * expo-file-system File is mocked globally. bytes() returns a mock Uint8Array.
 * Spy on File.prototype.bytes to simulate read failures.
 */

import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system';

import { generateJobZip } from './exportUtils';
import { JobService } from '../services/jobService';
import { logger } from './logger';

import type { Job, Document } from '../types';

// ─── Test data helpers ────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-001',
    jobNumber: 'JOB001',
    documents: [],
    createdAt: '2026-02-23T12:00:00.000Z',
    updatedAt: '2026-02-23T12:00:00.000Z',
    ...overrides,
  };
}

function makeDocument(n: number, overrides: Partial<Document> = {}): Document {
  return {
    id: `doc-${n}`,
    jobId: 'job-001',
    imageUri: `file:///mock-document//pegasus_images/img${n}.jpg`,
    classification: 'proof_of_delivery',
    timestamp: '2026-02-23T12:00:00.000Z',
    filename: `JOB001_proof_of_delivery_${n}.jpg`,
    ...overrides,
  };
}

/** Returns the zip instance created by the most recent new JSZip() call. */
function getZipInstance(): { file: jest.Mock; generateAsync: jest.Mock } {
  const MockJSZip = JSZip as unknown as jest.Mock;
  return MockJSZip.mock.results[0].value as { file: jest.Mock; generateAsync: jest.Mock };
}

// ─── Level 1: Unit Tests ──────────────────────────────────────────────────────

describe('Unit | generateJobZip', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds a CSV file named <jobNumber>.csv to the zip root', async () => {
    // The CSV filename is the contract with the recipient — they should be able
    // to open <jobNumber>.csv without any additional instructions.
    const job = makeJob();
    await generateJobZip(job);

    const zip = getZipInstance();
    expect(zip.file).toHaveBeenCalledWith('JOB001.csv', expect.any(String));
  });

  it('adds the full generateCsvExport output as the CSV content', async () => {
    // Validates that the CSV in the zip is identical to what generateCsvExport
    // produces — not a truncated or re-formatted version.
    const job = makeJob({ documents: [makeDocument(1)] });
    const expectedCsv = JobService.generateCsvExport(job);

    await generateJobZip(job);

    const zip = getZipInstance();
    expect(zip.file).toHaveBeenCalledWith('JOB001.csv', expectedCsv);
  });

  it('adds each document image to the zip under images/<filename>', async () => {
    // Validates that image entries use the document's filename field (not the
    // raw imageUri), which matches what the CSV log references.
    const job = makeJob({ documents: [makeDocument(1), makeDocument(2)] });
    await generateJobZip(job);

    const zip = getZipInstance();
    expect(zip.file).toHaveBeenCalledWith(
      'images/JOB001_proof_of_delivery_1.jpg',
      expect.any(Uint8Array)
    );
    expect(zip.file).toHaveBeenCalledWith(
      'images/JOB001_proof_of_delivery_2.jpg',
      expect.any(Uint8Array)
    );
  });

  it('does not throw when a single image bytes() call rejects', async () => {
    // A missing image must not abort the entire export. The driver should
    // still get a zip with all other documents and the CSV.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any — spy on mock prototype
    jest.spyOn(FileSystem.File.prototype as any, 'bytes').mockRejectedValueOnce(
      new Error('File not found')
    );
    const job = makeJob({ documents: [makeDocument(1)] });

    await expect(generateJobZip(job)).resolves.not.toThrow();
  });

  it('skips the failing image and still adds the CSV when bytes() rejects', async () => {
    // After a read failure the zip still contains the CSV — the partial export
    // is more useful than no export at all.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(FileSystem.File.prototype as any, 'bytes').mockRejectedValueOnce(
      new Error('File not found')
    );
    const job = makeJob({ documents: [makeDocument(1)] });
    await generateJobZip(job);

    const zip = getZipInstance();
    // CSV was added
    expect(zip.file).toHaveBeenCalledWith('JOB001.csv', expect.any(String));
    // Image was NOT added
    expect(zip.file).not.toHaveBeenCalledWith(
      'images/JOB001_proof_of_delivery_1.jpg',
      expect.anything()
    );
  });

  it('logs a warning for each skipped image', async () => {
    // Warns so developers can detect storage issues in production logs
    // without requiring a crash report.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(FileSystem.File.prototype as any, 'bytes').mockRejectedValueOnce(
      new Error('File not found')
    );
    const job = makeJob({ documents: [makeDocument(1)] });
    await generateJobZip(job);

    expect((logger.warn as jest.Mock)).toHaveBeenCalledWith(
      expect.stringContaining('doc-1'),
      expect.any(Error)
    );
  });

  it('still succeeds and returns a URI if all images fail to read', async () => {
    // Edge case: a job where every imageUri is invalid (e.g. after a device
    // restore). The zip should contain only the CSV and return a URI.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(FileSystem.File.prototype as any, 'bytes').mockRejectedValue(
      new Error('All files gone')
    );
    const job = makeJob({ documents: [makeDocument(1), makeDocument(2)] });
    const uri = await generateJobZip(job);

    expect(typeof uri).toBe('string');
    expect(uri.length).toBeGreaterThan(0);
  });
});

// ─── Level 2: Integration Tests ──────────────────────────────────────────────

describe('Integration | generateJobZip', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls File.bytes() once per document', async () => {
    // Validates that image reads happen exactly once per document — no
    // duplicate reads, no missed reads.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bytesSpy = jest.spyOn(FileSystem.File.prototype as any, 'bytes');
    const job = makeJob({ documents: [makeDocument(1), makeDocument(2), makeDocument(3)] });

    await generateJobZip(job);

    expect(bytesSpy).toHaveBeenCalledTimes(3);
  });

  it('calls File.write() with a Uint8Array (the zip data)', async () => {
    // Validates that the zip output from generateAsync is actually written to
    // the filesystem, not discarded.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writeSpy = jest.spyOn(FileSystem.File.prototype as any, 'write');
    const job = makeJob({ documents: [makeDocument(1)] });

    await generateJobZip(job);

    expect(writeSpy).toHaveBeenCalledWith(expect.any(Uint8Array));
  });

  it('writes the zip to Paths.cache', async () => {
    // Zip files are ephemeral (generated on demand for sharing), so they must
    // land in cache — not documentDirectory (which is for persistent data).
    const job = makeJob();

    const uri = await generateJobZip(job);

    expect(uri.startsWith(FileSystem.Paths.cache.uri)).toBe(true);
  });

  it('names the zip file <jobNumber>_export.zip', async () => {
    // The filename is visible to the recipient in their Files app or email
    // attachment. It must identify the job unambiguously.
    const job = makeJob({ jobNumber: 'DELIVERY-42' });

    const uri = await generateJobZip(job);

    expect(uri).toContain('DELIVERY-42_export.zip');
  });

  it('calls generateAsync with type uint8array', async () => {
    // uint8array is the cross-platform binary format. base64 would require
    // decoding before writing; nodebuffer is Node.js-only.
    const job = makeJob();
    await generateJobZip(job);

    const zip = getZipInstance();
    expect(zip.generateAsync).toHaveBeenCalledWith({ type: 'uint8array' });
  });
});

// ─── Level 3: Acceptance Tests ───────────────────────────────────────────────

describe('Acceptance | generateJobZip with two-document job', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const doc1 = makeDocument(1, { classification: 'bill_of_lading', filename: 'JOB002_bill_of_lading_1.jpg' });
  const doc2 = makeDocument(2, { classification: 'receipt', filename: 'JOB002_receipt_1.jpg' });
  const job = makeJob({
    id: 'acc-job-002',
    jobNumber: 'JOB002',
    documents: [
      { ...doc1, jobId: 'acc-job-002' },
      { ...doc2, jobId: 'acc-job-002' },
    ],
  });

  it('returned URI points to a .zip file in Paths.cache', async () => {
    // End-to-end check: the URI the caller receives is valid for passing to
    // expo-sharing. It must be in cache (not documentDirectory) and name a
    // zip file so the OS treats it correctly.
    const uri = await generateJobZip(job);

    expect(uri.startsWith(FileSystem.Paths.cache.uri)).toBe(true);
    expect(uri.endsWith('.zip')).toBe(true);
  });

  it('zip contains an image entry for each document filename', async () => {
    // Both document filenames must appear in the zip under images/ so the
    // recipient gets the complete set of photos alongside the CSV manifest.
    await generateJobZip(job);

    const zip = getZipInstance();
    expect(zip.file).toHaveBeenCalledWith(
      'images/JOB002_bill_of_lading_1.jpg',
      expect.any(Uint8Array)
    );
    expect(zip.file).toHaveBeenCalledWith(
      'images/JOB002_receipt_1.jpg',
      expect.any(Uint8Array)
    );
  });

  it('zip contains a CSV file with the job number as filename', async () => {
    // The CSV must be present and named after the job so it can be opened
    // directly without renaming.
    await generateJobZip(job);

    const zip = getZipInstance();
    expect(zip.file).toHaveBeenCalledWith('JOB002.csv', expect.any(String));
  });

  it('CSV in the zip contains correct job data', async () => {
    // Validates the CSV content matches what generateCsvExport produces for
    // this job — not a stale or empty string.
    const expectedCsv = JobService.generateCsvExport(job);
    await generateJobZip(job);

    const zip = getZipInstance();
    const csvCall = (zip.file as jest.Mock).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).endsWith('.csv')
    );
    expect(csvCall).toBeDefined();
    expect(csvCall![1]).toBe(expectedCsv);
    // The CSV must reference both document filenames
    expect(expectedCsv).toContain('JOB002_bill_of_lading_1.jpg');
    expect(expectedCsv).toContain('JOB002_receipt_1.jpg');
  });
});
