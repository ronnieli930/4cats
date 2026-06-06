export type FormStatus = "published" | "draft" | "archived";

export interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "email" | "select" | "checkbox" | "radio" | "date";
  label: string;
  required: boolean;
  options?: string[];
}

export interface Form {
  id: string;
  name: string;
  description: string;
  status: FormStatus;
  category: string;
  createdAt: string;
  updatedAt: string;
  submissions: number;
  fields: FormField[];
  tags: string[];
  createdBy: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, unknown>;
  submittedAt: string;
  submittedBy: string;
}
