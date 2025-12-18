export type ReceiptStatus = 'inbox' | 'approved' | 'rejected';

export interface ReceiptRow {
  id: string;
  user_id: string;
  created_at: string;
  status: ReceiptStatus;
  file_path: string;
  ocr_text?: string | null;
  date?: string | null;
  vendor?: string | null;
  amount?: number | null;
  tax?: number | null;
  currency?: string | null;
  category?: string | null;
  payment_method?: string | null;
  memo?: string | null;
  policy_flags?: string[] | null;
  duplicate_of?: string | null;
}

export interface PolicyRow {
  user_id: string;
  per_diem: number;
  receipt_required_over: number;
  restricted_categories: string[];
}

export interface PolicyFlags {
  over_per_diem?: boolean;
  receipt_required?: boolean;
  restricted_category?: boolean;
  duplicate_detected?: boolean;
}

export interface VendorCategoryRule {
  pattern: string;
  category: string;
}
