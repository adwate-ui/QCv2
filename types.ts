export interface User {
  email: string;
  passwordHash: string; // Simplified for demo
  apiKey?: string;
}

export enum ModelTier {
  FAST = 'FAST',
  DETAILED = 'DETAILED'
}

export enum ExpertMode {
  NORMAL = 'NORMAL',
  EXPERT = 'EXPERT'
}

export interface AppSettings {
  modelTier: ModelTier;
  expertMode: ExpertMode;
}

export interface ProductProfile {
  name: string;
  brand: string;
  category: string;
  priceEstimate: string;
  material: string;
  features: string[];
  description: string;
  url?: string;
}

export interface QCSection {
  sectionName: string;
  score: number; // 0-100
  grade: 'PASS' | 'FAIL' | 'CAUTION';
  observations: string[];
  // Optional image references related to this section's observations (references into report.qcImageIds)
  imageIds?: string[];
}

export interface QCReport {
  id: string;
  generatedAt: number;
  overallScore: number;
  overallGrade: 'PASS' | 'FAIL' | 'CAUTION';
  summary: string;
  sections: QCSection[];
  basedOnBatchIds: string[];
  qcImageIds: string[]; // <-- ADD THIS LINE
  modelTier: ModelTier; // Track which model generated this report
  expertMode: ExpertMode; // Track which persona generated this report
  // Optional mapping of sectionName -> comparison results (auth image + diff)
  sectionComparisons?: Record<string, { authImageId?: string; diffImageId?: string; diffScore?: number }>;
}

export interface QCBatch {
  id: string;
  timestamp: number;
  imageIds: string[]; // References to stored images
}

export interface Product {
  id: string;
  profile: ProductProfile;
  referenceImageIds: string[];
  qcBatches: QCBatch[];
  reports: QCReport[]; // Changed from latestReport to array for history
  createdAt: number;
  creationSettings?: AppSettings; // Added to track which model/mode was used
}

export type TaskType = 'IDENTIFY' | 'QC';
export type TaskStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BackgroundTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: number;
  result?: any;
  error?: string;
  meta: {
    title: string;
    subtitle?: string;
    targetId?: string; // Product ID for QC
    images?: string[]; // For ID task hydration
    url?: string;      // For ID task hydration
    settings?: AppSettings; // For ID task hydration
  };
}