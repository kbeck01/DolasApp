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

  static generateCsvExport(job: Job): string {
    const headers = 'job_id,filename,classification,timestamp';
    const rows = job.documents.map(
      doc => `${job.id},${doc.filename},${doc.classification},${doc.timestamp}`
    );
    return [headers, ...rows].join('\n');
  }
}
