import JSZip from 'jszip';
import { File, Paths } from 'expo-file-system';

import { JobService } from '../services/jobService';
import { logger } from './logger';

import type { Job } from '../types';

/**
 * Generates a zip archive for a job containing:
 *   - <jobNumber>.csv  (the full CSV export, at the zip root)
 *   - images/<filename> (one entry per document, using document.filename)
 *
 * Image read failures are non-fatal: the offending document is skipped and
 * a warning is logged, but the rest of the export continues. This handles
 * the case where a stored imageUri has been invalidated or the file moved.
 *
 * The zip is written to Paths.cache as <jobNumber>_export.zip and its URI
 * is returned. The caller is responsible for sharing or displaying the file.
 *
 * Uses the expo-file-system v19 class-based API exclusively.
 */
export async function generateJobZip(job: Job): Promise<string> {
  const zip = new JSZip();

  // Add CSV to zip root
  const csv = JobService.generateCsvExport(job);
  zip.file(`${job.jobNumber}.csv`, csv);

  // Add each document image under images/
  for (const doc of job.documents) {
    try {
      const imageFile = new File(doc.imageUri);
      const imageBytes = await imageFile.bytes();
      zip.file(`images/${doc.filename}`, imageBytes);
    } catch (error) {
      logger.warn(
        `Skipping unreadable image for document ${doc.id} (${doc.filename})`,
        error
      );
    }
  }

  // Generate zip bytes and write to cache
  const data = await zip.generateAsync({ type: 'uint8array' });
  const zipFilename = `${job.jobNumber}_export.zip`;
  const outFile = new File(Paths.cache, zipFilename);
  outFile.write(data);

  return outFile.uri;
}
