export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_notifications: {
        Row: {
          body: string | null
          created_at: string
          estimate_id: string | null
          id: string
          is_reviewed: boolean
          link_path: string
          notification_type: string
          reviewed_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          estimate_id?: string | null
          id?: string
          is_reviewed?: boolean
          link_path: string
          notification_type: string
          reviewed_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          estimate_id?: string | null
          id?: string
          is_reviewed?: boolean
          link_path?: string
          notification_type?: string
          reviewed_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      brief_settings: {
        Row: {
          created_at: string
          daily_brief_enabled: boolean
          daily_brief_time: string
          id: string
          include_equipment: boolean
          include_estimates: boolean
          include_overdue: boolean
          include_unpaid: boolean
          updated_at: string
          user_id: string
          weekly_brief_day: string
          weekly_brief_enabled: boolean
          weekly_brief_time: string
        }
        Insert: {
          created_at?: string
          daily_brief_enabled?: boolean
          daily_brief_time?: string
          id?: string
          include_equipment?: boolean
          include_estimates?: boolean
          include_overdue?: boolean
          include_unpaid?: boolean
          updated_at?: string
          user_id: string
          weekly_brief_day?: string
          weekly_brief_enabled?: boolean
          weekly_brief_time?: string
        }
        Update: {
          created_at?: string
          daily_brief_enabled?: boolean
          daily_brief_time?: string
          id?: string
          include_equipment?: boolean
          include_estimates?: boolean
          include_overdue?: boolean
          include_unpaid?: boolean
          updated_at?: string
          user_id?: string
          weekly_brief_day?: string
          weekly_brief_enabled?: boolean
          weekly_brief_time?: string
        }
        Relationships: []
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          phone: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          phone?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          phone?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_alert_snoozes: {
        Row: {
          alert_type: string
          business_id: string
          created_at: string
          created_by: string
          customer_id: string
          id: string
          snoozed_until: string
        }
        Insert: {
          alert_type: string
          business_id: string
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          snoozed_until: string
        }
        Update: {
          alert_type?: string
          business_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          snoozed_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_alert_snoozes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_alert_snoozes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_tokens: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          customer_id: string
          id: string
          token: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          token?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_tokens_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          email: string | null
          first_name: string
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          email?: string | null
          first_name: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          business_id: string
          created_at: string
          current_hours: number
          equipment_type: string | null
          id: string
          make: string | null
          model: string | null
          name: string
          notes: string | null
          product_number: string | null
          serial_number: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          current_hours?: number
          equipment_type?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          product_number?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          current_hours?: number
          equipment_type?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          product_number?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          description: string | null
          estimate_id: string
          id: string
          line_total: number | null
          quantity: number
          service_name: string
          sort_order: number
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          description?: string | null
          estimate_id: string
          id?: string
          line_total?: number | null
          quantity?: number
          service_name: string
          sort_order?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          estimate_id?: string
          id?: string
          line_total?: number | null
          quantity?: number
          service_name?: string
          sort_order?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          approval_note: string | null
          approved_by_source: string | null
          business_id: string
          created_at: string
          created_by: string
          customer_id: string
          estimate_inputs: Json | null
          estimate_number: string | null
          estimated_minutes: number | null
          frequency: string | null
          id: string
          last_revised_at: string | null
          last_sent_at: string | null
          manually_approved_at: string | null
          notes: string | null
          property_id: string
          public_token: string
          revision_number: number
          satisfies_follow_up: boolean
          sets_property_defaults: boolean
          source_job_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
          visit_scheduled_date: string | null
          visit_scheduled_time: string | null
        }
        Insert: {
          accepted_at?: string | null
          approval_note?: string | null
          approved_by_source?: string | null
          business_id: string
          created_at?: string
          created_by: string
          customer_id: string
          estimate_inputs?: Json | null
          estimate_number?: string | null
          estimated_minutes?: number | null
          frequency?: string | null
          id?: string
          last_revised_at?: string | null
          last_sent_at?: string | null
          manually_approved_at?: string | null
          notes?: string | null
          property_id: string
          public_token?: string
          revision_number?: number
          satisfies_follow_up?: boolean
          sets_property_defaults?: boolean
          source_job_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          visit_scheduled_date?: string | null
          visit_scheduled_time?: string | null
        }
        Update: {
          accepted_at?: string | null
          approval_note?: string | null
          approved_by_source?: string | null
          business_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          estimate_inputs?: Json | null
          estimate_number?: string | null
          estimated_minutes?: number | null
          frequency?: string | null
          id?: string
          last_revised_at?: string | null
          last_sent_at?: string | null
          manually_approved_at?: string | null
          notes?: string | null
          property_id?: string
          public_token?: string
          revision_number?: number
          satisfies_follow_up?: boolean
          sets_property_defaults?: boolean
          source_job_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          visit_scheduled_date?: string | null
          visit_scheduled_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string
          description: string | null
          id: string
          job_id: string | null
          notes: string | null
          purchased_at: string
          receipt_url: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          purchased_at: string
          receipt_url?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          purchased_at?: string
          receipt_url?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          business_id: string
          caption: string | null
          created_at: string
          id: string
          job_id: string
          kind: string
          signed_url: string
          storage_path: string
          user_id: string
        }
        Insert: {
          business_id: string
          caption?: string | null
          created_at?: string
          id?: string
          job_id: string
          kind?: string
          signed_url: string
          storage_path: string
          user_id: string
        }
        Update: {
          business_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string
          kind?: string
          signed_url?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_visits: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          business_id: string
          created_at: string
          created_by: string
          id: string
          job_id: string
          notes: string | null
          scheduled_end: string | null
          scheduled_start: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          business_id: string
          created_at?: string
          created_by: string
          id?: string
          job_id: string
          notes?: string | null
          scheduled_end?: string | null
          scheduled_start: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          business_id?: string
          created_at?: string
          created_by?: string
          id?: string
          job_id?: string
          notes?: string | null
          scheduled_end?: string | null
          scheduled_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_visits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_visits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_minutes: number | null
          actual_total: number | null
          amount_paid: number
          business_id: string
          cancelled_reason: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string
          customer_id: string
          customer_notes: string | null
          day_before_reminder_sent: boolean
          day_before_reminder_sent_at: string | null
          estimate_id: string | null
          id: string
          internal_notes: string | null
          job_inputs: Json | null
          job_type: string
          next_job_created_id: string | null
          payment_method: string | null
          payment_status: string
          price: number | null
          property_id: string
          quoted_total: number | null
          recurrence_source: string | null
          reschedule_count: number
          reschedule_log: string | null
          rescheduled_from: string | null
          scheduled_date: string | null
          scheduled_time_window: string | null
          service_package: string | null
          skipped_reason: string | null
          started_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_minutes?: number | null
          actual_total?: number | null
          amount_paid?: number
          business_id: string
          cancelled_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          customer_notes?: string | null
          day_before_reminder_sent?: boolean
          day_before_reminder_sent_at?: string | null
          estimate_id?: string | null
          id?: string
          internal_notes?: string | null
          job_inputs?: Json | null
          job_type?: string
          next_job_created_id?: string | null
          payment_method?: string | null
          payment_status?: string
          price?: number | null
          property_id: string
          quoted_total?: number | null
          recurrence_source?: string | null
          reschedule_count?: number
          reschedule_log?: string | null
          rescheduled_from?: string | null
          scheduled_date?: string | null
          scheduled_time_window?: string | null
          service_package?: string | null
          skipped_reason?: string | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_minutes?: number | null
          actual_total?: number | null
          amount_paid?: number
          business_id?: string
          cancelled_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          customer_notes?: string | null
          day_before_reminder_sent?: boolean
          day_before_reminder_sent_at?: string | null
          estimate_id?: string | null
          id?: string
          internal_notes?: string | null
          job_inputs?: Json | null
          job_type?: string
          next_job_created_id?: string | null
          payment_method?: string | null
          payment_status?: string
          price?: number | null
          property_id?: string
          quoted_total?: number | null
          recurrence_source?: string | null
          reschedule_count?: number
          reschedule_log?: string | null
          rescheduled_from?: string | null
          scheduled_date?: string | null
          scheduled_time_window?: string | null
          service_package?: string | null
          skipped_reason?: string | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_next_job_created_id_fkey"
            columns: ["next_job_created_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string
          business_id: string
          created_at: string
          created_by: string | null
          email: string | null
          frequency: string
          id: number
          name: string
          notes: string | null
          phone: string
          status: string
        }
        Insert: {
          address: string
          business_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          frequency: string
          id?: never
          name: string
          notes?: string | null
          phone: string
          status?: string
        }
        Update: {
          address?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          frequency?: string
          id?: never
          name?: string
          notes?: string | null
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          business_id: string
          created_at: string
          equipment_id: string
          id: string
          interval_days: number | null
          interval_hours: number | null
          last_completed_at: string | null
          last_completed_hours: number | null
          name: string
          next_due_date: string | null
          next_due_hours: number | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          equipment_id: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          last_completed_at?: string | null
          last_completed_hours?: number | null
          name: string
          next_due_date?: string | null
          next_due_hours?: number | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          equipment_id?: string
          id?: string
          interval_days?: number | null
          interval_hours?: number | null
          last_completed_at?: string | null
          last_completed_hours?: number | null
          name?: string
          next_due_date?: string | null
          next_due_hours?: number | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          delivery_method: string
          estimate_id: string | null
          id: string
          job_id: string | null
          manually_marked_sent: boolean
          message_body: string | null
          message_type: string
          property_id: string | null
          recipient_phone: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          delivery_method?: string
          estimate_id?: string | null
          id?: string
          job_id?: string | null
          manually_marked_sent?: boolean
          message_body?: string | null
          message_type: string
          property_id?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          delivery_method?: string
          estimate_id?: string | null
          id?: string
          job_id?: string | null
          manually_marked_sent?: boolean
          message_body?: string | null
          message_type?: string
          property_id?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_sources: {
        Row: {
          active: boolean
          county: string
          created_at: string
          display_name: string
          id: string
          notes: string | null
          provider: string | null
          source_key: string
          state: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          county: string
          created_at?: string
          display_name: string
          id?: string
          notes?: string | null
          provider?: string | null
          source_key: string
          state: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          county?: string
          created_at?: string
          display_name?: string
          id?: string
          notes?: string | null
          provider?: string | null
          source_key?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      parcels: {
        Row: {
          apn: string | null
          created_at: string
          created_by: string | null
          id: string
          land_use: string | null
          lat: number | null
          lon: number | null
          lot_sqft: number | null
          mailing_address: string | null
          owner_name: string | null
          raw_json: Json
          situs_address: string | null
          source: string
          source_parcel_id: string
          updated_at: string
        }
        Insert: {
          apn?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          land_use?: string | null
          lat?: number | null
          lon?: number | null
          lot_sqft?: number | null
          mailing_address?: string | null
          owner_name?: string | null
          raw_json: Json
          situs_address?: string | null
          source: string
          source_parcel_id: string
          updated_at?: string
        }
        Update: {
          apn?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          land_use?: string | null
          lat?: number | null
          lon?: number | null
          lot_sqft?: number | null
          mailing_address?: string | null
          owner_name?: string | null
          raw_json?: Json
          situs_address?: string | null
          source?: string
          source_parcel_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          blackout_dates: string[]
          business_id: string | null
          created_at: string
          default_setup_minutes: number
          home_base_address: string | null
          home_base_latitude: number | null
          home_base_longitude: number | null
          id: string
          minimum_price: number
          review_request_url: string | null
          round_to_nearest: number
          settings_json: Json | null
          target_hourly_rate: number
          time_zone: string
          updated_at: string
          user_id: string
          venmo_handle: string | null
        }
        Insert: {
          blackout_dates?: string[]
          business_id?: string | null
          created_at?: string
          default_setup_minutes?: number
          home_base_address?: string | null
          home_base_latitude?: number | null
          home_base_longitude?: number | null
          id?: string
          minimum_price?: number
          review_request_url?: string | null
          round_to_nearest?: number
          settings_json?: Json | null
          target_hourly_rate?: number
          time_zone?: string
          updated_at?: string
          user_id: string
          venmo_handle?: string | null
        }
        Update: {
          blackout_dates?: string[]
          business_id?: string | null
          created_at?: string
          default_setup_minutes?: number
          home_base_address?: string | null
          home_base_latitude?: number | null
          home_base_longitude?: number | null
          id?: string
          minimum_price?: number
          review_request_url?: string | null
          round_to_nearest?: number
          settings_json?: Json | null
          target_hourly_rate?: number
          time_zone?: string
          updated_at?: string
          user_id?: string
          venmo_handle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          default_equipment_cost_per_hour: number | null
          default_hourly_rate: number | null
          id: string
          minimum_visit_charge: number | null
          owner_name: string | null
          service_radius_miles: number | null
          updated_at: string
        }
        Insert: {
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          default_equipment_cost_per_hour?: number | null
          default_hourly_rate?: number | null
          id: string
          minimum_visit_charge?: number | null
          owner_name?: string | null
          service_radius_miles?: number | null
          updated_at?: string
        }
        Update: {
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          default_equipment_cost_per_hour?: number | null
          default_hourly_rate?: number | null
          id?: string
          minimum_visit_charge?: number | null
          owner_name?: string | null
          service_radius_miles?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          access_notes: string | null
          auto_schedule_next: boolean
          business_id: string
          city: string | null
          county: string | null
          created_at: string
          created_by: string
          customer_id: string
          default_blow_off_enabled: boolean | null
          default_edging_enabled: boolean | null
          default_mowing_enabled: boolean | null
          default_price: number | null
          default_service_package: string | null
          default_weed_eating_enabled: boolean | null
          estimated_lot_sqft: number | null
          estimated_mowable_acres: number | null
          full_address: string | null
          gate_code: string | null
          id: string
          internal_notes: string | null
          latitude: number | null
          longitude: number | null
          lot_size_source: string | null
          normalized_address: string | null
          obstacle_notes: string | null
          parcel_acres: number | null
          parcel_id: string | null
          parking_notes: string | null
          pet_warning: string | null
          postal_code: string | null
          preferred_service_day: string | null
          property_name: string | null
          schedule_anchor_date: string | null
          service_address: string
          service_frequency: string
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          auto_schedule_next?: boolean
          business_id: string
          city?: string | null
          county?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          default_blow_off_enabled?: boolean | null
          default_edging_enabled?: boolean | null
          default_mowing_enabled?: boolean | null
          default_price?: number | null
          default_service_package?: string | null
          default_weed_eating_enabled?: boolean | null
          estimated_lot_sqft?: number | null
          estimated_mowable_acres?: number | null
          full_address?: string | null
          gate_code?: string | null
          id?: string
          internal_notes?: string | null
          latitude?: number | null
          longitude?: number | null
          lot_size_source?: string | null
          normalized_address?: string | null
          obstacle_notes?: string | null
          parcel_acres?: number | null
          parcel_id?: string | null
          parking_notes?: string | null
          pet_warning?: string | null
          postal_code?: string | null
          preferred_service_day?: string | null
          property_name?: string | null
          schedule_anchor_date?: string | null
          service_address: string
          service_frequency?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          auto_schedule_next?: boolean
          business_id?: string
          city?: string | null
          county?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          default_blow_off_enabled?: boolean | null
          default_edging_enabled?: boolean | null
          default_mowing_enabled?: boolean | null
          default_price?: number | null
          default_service_package?: string | null
          default_weed_eating_enabled?: boolean | null
          estimated_lot_sqft?: number | null
          estimated_mowable_acres?: number | null
          full_address?: string | null
          gate_code?: string | null
          id?: string
          internal_notes?: string | null
          latitude?: number | null
          longitude?: number | null
          lot_size_source?: string | null
          normalized_address?: string | null
          obstacle_notes?: string | null
          parcel_acres?: number | null
          parcel_id?: string | null
          parking_notes?: string | null
          pet_warning?: string | null
          postal_code?: string | null
          preferred_service_day?: string | null
          property_name?: string | null
          schedule_anchor_date?: string | null
          service_address?: string
          service_frequency?: string
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      schedule_upcoming: {
        Row: {
          created_by: string | null
          first_name: string | null
          job_id: string | null
          job_title: string | null
          last_name: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_address: string | null
          status: string | null
          visit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_visits_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_business_member: {
        Args: { target_business_id: string }
        Returns: boolean
      }
      is_business_owner: {
        Args: { target_business_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
