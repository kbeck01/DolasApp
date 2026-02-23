import React, { createContext, useContext, useState, useCallback } from 'react';
import { Job, Document, DocumentClassification } from '../types';
import { JobService } from '../services/jobService';

interface JobContextType {
  currentJob: Job | null;
  documents: Document[];
  startJob: (job: Job) => void;
  addDocument: (document: Document) => void;
  updateDocument: (documentId: string, updates: { imageUri?: string; classification?: DocumentClassification; filename?: string; timestamp?: string }) => void;
  reloadJob: (jobId: string) => Promise<void>;
  clearJob: () => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  const startJob = useCallback((job: Job) => {
    setCurrentJob(job);
    setDocuments(job.documents);
  }, []);

  const addDocument = useCallback((document: Document) => {
    setDocuments(prev => [...prev, document]);
    setCurrentJob(prev =>
      prev ? { ...prev, documents: [...prev.documents, document], updatedAt: document.timestamp } : prev
    );
  }, []);

  const updateDocument = useCallback((
    documentId: string,
    updates: { imageUri?: string; classification?: DocumentClassification; filename?: string; timestamp?: string }
  ) => {
    setDocuments(prev => prev.map(d =>
      d.id === documentId ? { ...d, ...updates } : d
    ));
    setCurrentJob(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map(d =>
          d.id === documentId ? { ...d, ...updates } : d
        ),
        updatedAt: updates.timestamp || new Date().toISOString(),
      };
    });
  }, []);

  const reloadJob = useCallback(async (jobId: string) => {
    const job = await JobService.getJobById(jobId);
    if (job) {
      setCurrentJob(job);
      setDocuments(job.documents);
    }
  }, []);

  const clearJob = useCallback(() => {
    setCurrentJob(null);
    setDocuments([]);
  }, []);

  return (
    <JobContext.Provider
      value={{
        currentJob,
        documents,
        startJob,
        addDocument,
        updateDocument,
        reloadJob,
        clearJob,
      }}
    >
      {children}
    </JobContext.Provider>
  );
};

export const useJob = () => {
  const context = useContext(JobContext);
  if (context === undefined) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
};
