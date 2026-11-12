export type InstrumentType = 
  | 'Trompete' 
  | 'Trombone' 
  | 'Tuba' 
  | 'Bombardino' 
  | 'Apenas Notas' 
  | 'Apenas Formatação';

export interface ScoreItem {
  id: string;
  fileName: string;
  originalFileType: 'pdf' | 'xml' | 'mxl' | 'image';
  instrument: InstrumentType;
  xmlContent: string;
  detectedKey?: string;
  title?: string;
  status: 'ready' | 'processing' | 'error';
  errorMessage?: string;
  zipBase64?: string;
  zipFileName?: string;
}

export interface ProcessingOptions {
  addFingerings: boolean;
  addNoteNames: boolean;
  addKeyHeader: boolean;
  transposeSolToFa: boolean;
}