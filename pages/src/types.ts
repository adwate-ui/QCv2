export interface User {
  id?: string;
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
  imageUrls?: string[]; // <-- ADDING THIS LINE
}

export interface QCSection {
  sectionName: string;
  score: number; // 0-100
  grade: 'PASS' | 'FAIL' | 'CAUTION';
  weight: number; // 0-100
  observations: string[];
  // Optional image references related to this section's observations (references into report.qcImageIds)
  imageIds?: string[];
  // Optional reference/authentic image IDs assigned to this section (references into product.referenceImageIds or profile.imageUrls)
  authImageIds?: string[];
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
  authImageIds: string[]; // Authentic/reference image IDs used in this report
  modelTier: ModelTier; // Track which model generated this report
  expertMode: ExpertMode; // Track which persona generated this report
  // Optional mapping of sectionName -> comparison results (auth image + diff)
  // comparisonType: 'side-by-side' (has both auth and QC images) or 'highlight-only' (only QC images)
  sectionComparisons?: Record<string, { authImageId?: string; diffImageId?: string; diffScore?: number; comparisonType?: 'side-by-side' | 'highlight-only' }>;
  requestForMoreInfo?: string[];
  userComments?: string;
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
export type TaskStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'AWAITING_FEEDBACK';

export interface BackgroundTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: number;
  estimatedCompletionTime?: number; // seconds
  result?: any;
  error?: string;
  meta: {
    title: string;
    subtitle?: string;
    targetId?: string; // Product ID for QC
    images?: string[]; // For ID task hydration
    url?: string;      // For ID task hydration
    settings?: AppSettings; // For ID task hydration
    allQCImageIds?: string[];
    allQCRawImages?: string[];
    imageCount?: number; // Count of images for storage optimization
    allQCRawImageCount?: number; // Count of raw QC images for storage optimization
  };
  preliminaryReport?: QCReport;
}

export interface BoundingBox {
  ymin: number; // 0-1000 scale
  xmin: number; // 0-1000 scale
  ymax: number; // 0-1000 scale
  xmax: number; // 0-1000 scale
}

export interface Discrepancy {
  description: string;
  boundingBox: BoundingBox;
}

export interface QCAnalysisResult {
  discrepancies: Discrepancy[];
  summary: string;
  qualityScore: number; // 0-100
}