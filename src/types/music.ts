export type InstrumentType = 'Trompete' | 'Trombone' | 'Tuba' | 'Bombardino' | 'Apenas Notas';

export type OutputFormat = 'caderninho_a5' | 'kindle_10' | 'normal_a4';

export interface ScoreItem {
  id: string;
  fileName: string;
  originalFileType: 'pdf' | 'image' | 'xml' | 'mxl';
  instrument: InstrumentType;
  fileData?: string; // base64 or text
  xmlContent: string;
  pdfPages?: string[]; // rendered page images for direct PDF/image layout
  detectedKey?: string;
  title?: string;
  pageCount?: number;
  previewUrls?: string[];
  status: 'idle' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
}

export interface ProcessingOptions {
  // Annotations
  addFingerings: boolean;
  addNoteNames: boolean;
  addKeyHeader: boolean;
  transposeSolToFa: boolean;
  
  // Cleanups
  removeBlankPages: boolean;
  
  // Output formats
  outputFormats: OutputFormat[];
  
  // Unified print
  unifiedPrint: boolean;
}
