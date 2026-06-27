export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type MemberRole = "admin" | "chair" | "secretary" | "treasurer" | "member" | "strata_manager";
export type MemberStatus = "active" | "invited" | "suspended";
export type VisibilityLevel = "all" | "admins" | "custom";
export type CardStatusDb = "open" | "pending_vote" | "resolved" | "urgent" | "confidential";
export type CardTypeDb =
  | "maintenance"
  | "quote"
  | "invoice"
  | "compliance"
  | "budget"
  | "project"
  | "variation"
  | "incident"
  | "dispute"
  | "meeting"
  | "general";
export type VoteValue = "yes" | "no" | "abstain";
export type DocumentStatusDb = "uploaded" | "needs_extraction" | "markdown_ready" | "indexed" | "review_required";
export type ProjectStatusDb = "on_track" | "at_risk" | "needs_decision" | "resolved";

export interface Database {
  public: {
    Tables: {
      committees: Table<{
        id: string;
        name: string;
        strata_plan: string | null;
        jurisdiction: string;
        address: string | null;
        created_at: string;
      }>;
      profiles: Table<
        {
          id: string;
          full_name: string;
          email: string;
          created_at: string;
        },
        {
          id: string;
          full_name: string;
          email: string;
          created_at?: string;
        }
      >;
      members: Table<
        {
          id: string;
          committee_id: string;
          user_id: string | null;
          email: string;
          full_name: string;
          role: MemberRole;
          status: MemberStatus;
          access_level: string;
          invited_by: string | null;
          invited_at: string | null;
          invited_by_member_id: string | null;
          accepted_at: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          user_id?: string | null;
          email: string;
          full_name: string;
          role?: MemberRole;
          status?: MemberStatus;
          access_level?: string;
          invited_by?: string | null;
          invited_at?: string | null;
          invited_by_member_id?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        }
      >;
      cards: Table<
        {
          id: string;
          committee_id: string;
          title: string;
          description: string;
          type: CardTypeDb;
          status: CardStatusDb;
          visibility: VisibilityLevel;
          creator_member_id: string | null;
          linked_project_id: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          committee_id: string;
          title: string;
          description?: string;
          type?: CardTypeDb;
          status?: CardStatusDb;
          visibility?: VisibilityLevel;
          creator_member_id?: string | null;
          linked_project_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      messages: Table<
        {
          id: string;
          committee_id: string;
          card_id: string;
          author_member_id: string | null;
          body: string;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          card_id: string;
          author_member_id?: string | null;
          body: string;
          created_at?: string;
        }
      >;
      documents: Table<
        {
          id: string;
          committee_id: string;
          title: string;
          document_type: string;
          source: string;
          source_date: string | null;
          version_label: string | null;
          visibility: VisibilityLevel;
          storage_path: string | null;
          extracted_text_path: string | null;
          markdown_path: string | null;
          indexed_status: DocumentStatusDb;
          summary: string | null;
          metadata: Json;
          created_by_member_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          title: string;
          document_type: string;
          source?: string;
          source_date?: string | null;
          version_label?: string | null;
          visibility?: VisibilityLevel;
          storage_path?: string | null;
          extracted_text_path?: string | null;
          markdown_path?: string | null;
          indexed_status?: DocumentStatusDb;
          summary?: string | null;
          metadata?: Json;
          created_by_member_id?: string | null;
          created_at?: string;
        }
      >;
      attachments: Table<
        {
          id: string;
          committee_id: string;
          card_id: string | null;
          document_id: string | null;
          uploader_member_id: string | null;
          file_name: string;
          file_path: string;
          file_size: number | null;
          file_type: string | null;
          extracted_text: string | null;
          markdown: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          card_id?: string | null;
          document_id?: string | null;
          uploader_member_id?: string | null;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          file_type?: string | null;
          extracted_text?: string | null;
          markdown?: string | null;
          created_at?: string;
        }
      >;
      projects: Table<{
        id: string;
        committee_id: string;
        name: string;
        status: ProjectStatusDb;
        planned_scope: string;
        progress_percent: number;
        budget_allowance_id: string | null;
        created_at: string;
      }>;
      proposals: Table<
        {
          id: string;
          committee_id: string;
          card_id: string;
          title: string;
          rationale: string | null;
          status: string;
          deadline: string | null;
          created_by_member_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          card_id: string;
          title: string;
          rationale?: string | null;
          status?: string;
          deadline?: string | null;
          created_by_member_id?: string | null;
          created_at?: string;
        }
      >;
      votes: Table<
        {
          id: string;
          committee_id: string;
          proposal_id: string;
          member_id: string;
          vote: VoteValue;
          note: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          proposal_id: string;
          member_id: string;
          vote: VoteValue;
          note?: string | null;
          created_at?: string;
        }
      >;
      approval_conditions: Table<
        {
          id: string;
          committee_id: string;
          proposal_id: string | null;
          vote_id: string | null;
          condition_text: string;
          status: string;
          created_by_member_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          proposal_id?: string | null;
          vote_id?: string | null;
          condition_text: string;
          status?: string;
          created_by_member_id?: string | null;
          created_at?: string;
        }
      >;
      accounts: Table<
        {
          id: string;
          committee_id: string;
          name: string;
          account_type: string;
          opening_balance: number;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          name: string;
          account_type: string;
          opening_balance?: number;
          created_at?: string;
        }
      >;
      budget_periods: Table<
        {
          id: string;
          committee_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          name: string;
          starts_on: string;
          ends_on: string;
          created_at?: string;
        }
      >;
      budget_lines: Table<
        {
          id: string;
          committee_id: string;
          budget_period_id: string | null;
          account_id: string | null;
          category: string;
          approved_amount: number;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          budget_period_id?: string | null;
          account_id?: string | null;
          category: string;
          approved_amount?: number;
          created_at?: string;
        }
      >;
      budget_allowances: Table<
        {
          id: string;
          committee_id: string;
          budget_line_id: string | null;
          name: string;
          approved_amount: number;
          committed_amount: number;
          invoiced_amount: number;
          notes: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          budget_line_id?: string | null;
          name: string;
          approved_amount?: number;
          committed_amount?: number;
          invoiced_amount?: number;
          notes?: string | null;
          created_at?: string;
        }
      >;
      project_milestones: Table<{
        id: string;
        committee_id: string;
        project_id: string;
        label: string;
        planned_on: string | null;
        actual_on: string | null;
        status: string;
        created_at: string;
      }>;
      vendors: Table<
        {
          id: string;
          committee_id: string;
          name: string;
          contact_email: string | null;
          phone: string | null;
          license_number: string | null;
          insurance_status: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          name: string;
          contact_email?: string | null;
          phone?: string | null;
          license_number?: string | null;
          insurance_status?: string | null;
          created_at?: string;
        },
        {
          name?: string;
          contact_email?: string | null;
          phone?: string | null;
          license_number?: string | null;
          insurance_status?: string | null;
        }
      >;
      variations: Table<{
        id: string;
        committee_id: string;
        project_id: string | null;
        card_id: string | null;
        vendor_id: string | null;
        title: string;
        amount: number;
        status: string;
        scope_change: string | null;
        created_at: string;
      }>;
      invoices: Table<
        {
          id: string;
          committee_id: string;
          project_id: string | null;
          card_id: string | null;
          vendor_id: string | null;
          document_id: string | null;
          invoice_number: string | null;
          amount: number;
          approval_status: string;
          due_on: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          project_id?: string | null;
          card_id?: string | null;
          vendor_id?: string | null;
          document_id?: string | null;
          invoice_number?: string | null;
          amount?: number;
          approval_status?: string;
          due_on?: string | null;
          created_at?: string;
        },
        {
          amount?: number;
          approval_status?: string;
          due_on?: string | null;
        }
      >;
      quote_reviews: Table<
        {
          id: string;
          committee_id: string;
          card_id: string | null;
          document_id: string | null;
          overall_risk: "low" | "medium" | "high";
          missing_inclusions: string[];
          risky_exclusions: string[];
          clarification_questions: string[];
          approval_conditions: string[];
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          card_id?: string | null;
          document_id?: string | null;
          overall_risk?: "low" | "medium" | "high";
          missing_inclusions?: string[];
          risky_exclusions?: string[];
          clarification_questions?: string[];
          approval_conditions?: string[];
          created_at?: string;
        }
      >;
      expenses: Table<{
        id: string;
        committee_id: string;
        account_id: string | null;
        budget_line_id: string | null;
        project_id: string | null;
        invoice_id: string | null;
        description: string;
        amount: number;
        spent_on: string;
        created_at: string;
      }>;
      audit_log: Table<
        {
          id: string;
          committee_id: string;
          card_id: string | null;
          user_id: string | null;
          action: string;
          target: string;
          metadata: Json;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          card_id?: string | null;
          user_id?: string | null;
          action: string;
          target: string;
          metadata?: Json;
          created_at?: string;
        }
      >;
      legislation_sources: Table<{
        id: string;
        source: string;
        title: string;
        url: string;
        version_label: string | null;
        indexed_at: string | null;
        created_at: string;
      }>;
      legislation_chunks: Table<{
        id: string;
        legislation_source_id: string | null;
        source: string;
        section: string;
        topic_tags: string[];
        body: string;
        metadata: Json;
        embedding: string | null;
        created_at: string;
      }>;
      ai_outputs: Table<
        {
          id: string;
          committee_id: string;
          card_id: string | null;
          document_id: string | null;
          project_id: string | null;
          incident_id: string | null;
          output_type: string;
          prompt_hash: string | null;
          output: Json;
          citations: Json;
          model: string | null;
          status: string;
          duration_ms: number | null;
          input_record_count: number;
          citation_count: number;
          error_message: string | null;
          provider_metadata: Json;
          created_mode: string;
          created_by_member_id: string | null;
          created_at: string;
        },
        {
          id?: string;
          committee_id: string;
          card_id?: string | null;
          document_id?: string | null;
          project_id?: string | null;
          incident_id?: string | null;
          output_type: string;
          prompt_hash?: string | null;
          output: Json;
          citations?: Json;
          model?: string | null;
          status?: string;
          duration_ms?: number | null;
          input_record_count?: number;
          citation_count?: number;
          error_message?: string | null;
          provider_metadata?: Json;
          created_mode?: string;
          created_by_member_id?: string | null;
          created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      member_role: MemberRole;
      member_status: MemberStatus;
      visibility_level: VisibilityLevel;
      card_status: CardStatusDb;
      card_type: CardTypeDb;
      vote_value: VoteValue;
      document_status: DocumentStatusDb;
      project_status: ProjectStatusDb;
    };
    CompositeTypes: Record<string, never>;
  };
}
