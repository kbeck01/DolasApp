import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Document, DocumentClassification } from '../types';
import { logger } from '../utils/logger';

const JOBS_STORAGE_KEY = '@pegasus_jobs';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export class JobService {
  static async getJobs(): Promise<Job[]> {
    try {
      const stored = await AsyncStorage.getItem(JOBS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      logger.error('Error loading jobs', error);
      return [];
    }
  }

  static async getJobById(jobId: string): Promise<Job | null> {
    const jobs = await this.getJobs();
    return jobs.find(j => j.id === jobId) || null;
  }

  static async createJob(jobNumber: string): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = {
      id: generateId(),
      jobNumber,
      documents: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      const jobs = await this.getJobs();
      jobs.push(job);
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
      logger.logJobCreate(job.id, jobNumber);
    } catch (error) {
      logger.error('Error creating job', error);
    }

    return job;
  }

  static async addDocument(
    jobId: string,
    imageUri: string,
    classification: DocumentClassification,
    jobNumber: string,
    existingDocuments: Document[]
  ): Promise<Document> {
    const now = new Date().toISOString();
    const classCount = existingDocuments.filter(d => d.classification === classification).length + 1;
    const filename = `${jobNumber}_${classification}_${classCount}.jpg`;

    const doc: Document = {
      id: generateId(),
      jobId,
      imageUri,
      classification,
      timestamp: now,
      filename,
    };

    try {
      const jobs = await this.getJobs();
      const jobIndex = jobs.findIndex(j => j.id === jobId);
      if (jobIndex !== -1) {
        jobs[jobIndex].documents.push(doc);
        jobs[jobIndex].updatedAt = now;
        await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
        logger.logDocumentCapture(jobId, imageUri);
        logger.logDocumentClassify(doc.id, classification);
      }
    } catch (error) {
      logger.error('Error adding document', error);
    }

    return doc;
  }

  static async updateDocument(
    jobId: string,
    documentId: string,
    updates: { imageUri?: string; classification?: DocumentClassification },
    jobNumber: string,
    existingDocuments: Document[]
  ): Promise<Document | null> {
    try {
      const jobs = await this.getJobs();
      const jobIndex = jobs.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return null;

      const docIndex = jobs[jobIndex].documents.findIndex(d => d.id === documentId);
      if (docIndex === -1) return null;

      const doc = { ...jobs[jobIndex].documents[docIndex] };
      const now = new Date().toISOString();

      if (updates.imageUri !== undefined) {
        doc.imageUri = updates.imageUri;
      }
      if (updates.classification !== undefined) {
        doc.classification = updates.classification;
        const classCount = existingDocuments.filter(
          d => d.classification === updates.classification! && d.id !== documentId
        ).length + 1;
        doc.filename = `${jobNumber}_${updates.classification}_${classCount}.jpg`;
      }
      doc.timestamp = now;

      jobs[jobIndex].documents[docIndex] = doc;
      jobs[jobIndex].updatedAt = now;
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
      logger.logDocumentClassify(documentId, doc.classification);
      return doc;
    } catch (error) {
      logger.error('Error updating document', error);
      return null;
    }
  }

  static async deleteDocument(jobId: string, documentId: string): Promise<boolean> {
    try {
      const jobs = await this.getJobs();
      const jobIndex = jobs.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return false;
      const docIndex = jobs[jobIndex].documents.findIndex(d => d.id === documentId);
      if (docIndex === -1) return false;
      jobs[jobIndex].documents.splice(docIndex, 1);
      jobs[jobIndex].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
      return true;
    } catch (error) {
      logger.error('Error deleting document', error);
      return false;
    }
  }

  static async renameJob(jobId: string, jobNumber: string): Promise<boolean> {
    try {
      const jobs = await this.getJobs();
      const jobIndex = jobs.findIndex(j => j.id === jobId);
      if (jobIndex === -1) return false;
      jobs[jobIndex].jobNumber = jobNumber;
      jobs[jobIndex].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
      return true;
    } catch (error) {
      logger.error('Error renaming job', error);
      return false;
    }
  }

  static async deleteJob(jobId: string): Promise<boolean> {
    try {
      const jobs = await this.getJobs();
      const filtered = jobs.filter(j => j.id !== jobId);
      if (filtered.length === jobs.length) return false;
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      logger.error('Error deleting job', error);
      return false;
    }
  }

  static async deleteJobs(jobIds: string[]): Promise<boolean> {
    try {
      const jobs = await this.getJobs();
      const idSet = new Set(jobIds);
      const filtered = jobs.filter(j => !idSet.has(j.id));
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      logger.error('Error deleting jobs', error);
      return false;
    }
  }

  static formatTimestampLocal(iso: string): string {
    const date = new Date(iso);
    const formatted = date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return formatted;
  }

  static generateCsvExport(job: Job): string {
    const headers = 'job_id,filename,classification,timestamp';
    const rows = job.documents.map(
      doc => `${job.jobNumber},${doc.filename},${doc.classification},${this.formatTimestampLocal(doc.timestamp)}`
    );
    return [headers, ...rows].join('\n');
  }
}
