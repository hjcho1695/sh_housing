export interface CautionItem {
  tag: string;
  text: string;
}

export interface DetailBoxItem {
  label: string;
  value: string;
}

export interface NoticeItem {
  id: number;
  name: string;
  type: string;
  noticeDate: string;
  internetStart: string;
  internetEnd: string;
  visit: string;
  docResultDate: string;
  docSubmitStart: string;
  docSubmitEnd: string;
  winnerDate: string;
  supply: string;
  eligibility: string;
  eligibilityItems?: DetailBoxItem[];
  points: string;
  pointsItems?: DetailBoxItem[];
  documents: string;
  documentItems?: DetailBoxItem[];
  caution: string;
  cautionItems?: CautionItem[];
  houseNo: string;
  noticeUrl: string;
  applyUrl: string;
}

export type NoticeStatus = 'upcoming' | 'open' | 'closed';

export type ConfidenceLevel = '높음' | '보통' | '낮음' | '못 찾음';

export type ExtractableFieldKey =
  | 'name'
  | 'type'
  | 'noticeDate'
  | 'internetStart'
  | 'internetEnd'
  | 'visit'
  | 'docResultDate'
  | 'docSubmitStart'
  | 'docSubmitEnd'
  | 'winnerDate'
  | 'supply'
  | 'eligibility'
  | 'points'
  | 'documents'
  | 'caution'
  | 'houseNo';

export interface FieldMeta {
  evidence: string;
  confidence: ConfidenceLevel;
  aiFilled: boolean;
}

export interface AdminNoticeRecord extends NoticeItem {
  reviewed: boolean;
  updatedAt: string;
  meta: Partial<Record<ExtractableFieldKey, FieldMeta>>;
}

export interface ExtractedFieldResult {
  value: string;
  evidence: string;
  confidence: ConfidenceLevel;
}

export type ExtractedNoticeResponse = Record<ExtractableFieldKey, ExtractedFieldResult>;
