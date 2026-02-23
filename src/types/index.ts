export type DocumentClassification = 'bill_of_lading' | 'proof_of_delivery' | 'receipt' | 'inventory';

export interface Document {
  id: string;
  jobId: string;
  imageUri: string;
  classification: DocumentClassification;
  timestamp: string;
  filename: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  documents: Document[];
  createdAt: string;
  updatedAt: string;
}
