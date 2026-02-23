import React, { createContext, useContext, useState, useCallback } from 'react';
import { Job, Document } from '../types';

interface JobContextType {
  currentJob: Job | null;
  documents: Document[];
  startJob: (job: Job) => void;
  addDocument: (document: Document) => void;
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
