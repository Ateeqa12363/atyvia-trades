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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calls: {
        Row: {
          agent_id: string | null
          appointment_notes: string | null
          appointment_time: string | null
          booked_appointment: boolean | null
          callback_completed: boolean
          callback_completed_at: string | null
          caller_name: string | null
          caller_name_verified: boolean
          created_at: string
          custom_data: Json | null
          direction: string | null
          disconnect_reason: string | null
          duration_seconds: number | null
          end_time: string | null
          from_number: string | null
          id: string
          raw: Json | null
          recording_url: string | null
          retell_call_id: string
          sentiment: string | null
          site_id: string | null
          start_time: string | null
          status: string | null
          summary: string | null
          to_number: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          appointment_notes?: string | null
          appointment_time?: string | null
          booked_appointment?: boolean | null
          callback_completed?: boolean
          callback_completed_at?: string | null
          caller_name?: string | null
          caller_name_verified?: boolean
          created_at?: string
          custom_data?: Json | null
          direction?: string | null
          disconnect_reason?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          from_number?: string | null
          id?: string
          raw?: Json | null
          recording_url?: string | null
          retell_call_id: string
          sentiment?: string | null
          site_id?: string | null
          start_time?: string | null
          status?: string | null
          summary?: string | null
          to_number?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          appointment_notes?: string | null
          appointment_time?: string | null
          booked_appointment?: boolean | null
          callback_completed?: boolean
          callback_completed_at?: string | null
          caller_name?: string | null
          caller_name_verified?: boolean
          created_at?: string
          custom_data?: Json | null
          direction?: string | null
          disconnect_reason?: string | null
          duration_seconds?: number | null
          end_time?: string | null
          from_number?: string | null
          id?: string
          raw?: Json | null
          recording_url?: string | null
          retell_call_id?: string
          sentiment?: string | null
          site_id?: string | null
          start_time?: string | null
          status?: string | null
          summary?: string | null
          to_number?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          phone_key: string | null
          site_id: string
          town: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          phone_key?: string | null
          site_id: string
          town?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          phone_key?: string | null
          site_id?: string
          town?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          position: number
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          invoice_id: string
          line_total?: number
          position?: number
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          position?: number
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          address: string | null
          approved_at: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          invoice_number: string
          job_id: string | null
          notes: string | null
          paid_at: string | null
          phone: string | null
          sent_at: string | null
          site_id: string
          status: string
          subtotal: number
          total: number
          updated_at: string
          vat_rate: number
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          phone?: string | null
          sent_at?: string | null
          site_id: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          job_id?: string | null
          notes?: string | null
          paid_at?: string | null
          phone?: string | null
          sent_at?: string | null
          site_id?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          job_id: string | null
          kind: string
          position: number
          quote_id: string | null
          site_id: string
          site_visit_id: string | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          position?: number
          quote_id?: string | null
          site_id: string
          site_visit_id?: string | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          position?: number
          quote_id?: string | null
          site_id?: string
          site_visit_id?: string | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          assigned_to: string | null
          cal_booking_id: string | null
          confirmation_sent_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          phone: string | null
          price: number
          quote_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          site_id: string
          site_visit_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          cal_booking_id?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          price?: number
          quote_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          site_id: string
          site_visit_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          cal_booking_id?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          price?: number
          quote_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          site_id?: string
          site_visit_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      message_log: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          direction: string
          error: string | null
          id: string
          invoice_id: string | null
          job_id: string | null
          provider: string | null
          provider_ref: string | null
          quote_id: string | null
          recipient: string | null
          sent_at: string | null
          site_id: string
          site_visit_id: string | null
          status: string
          subject: string | null
          template: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          quote_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          site_id: string
          site_visit_id?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          quote_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          site_id?: string
          site_visit_id?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_log_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          site_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          site_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          site_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          selected_site_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          selected_site_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          selected_site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_selected_site_id_fkey"
            columns: ["selected_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          line_total: number
          position: number
          quantity: number
          quote_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_id: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_total?: number
          position?: number
          quantity?: number
          quote_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_settings: {
        Row: {
          accreditations: string
          business_address: string
          business_email: string
          business_name: string
          business_phone: string
          callout_fee: number
          company_number: string
          contingency_pct: number
          created_at: string
          day_rate: number
          deposit_pct: number
          free_travel_miles: number
          id: string
          insurance: string
          labour_rate: number
          logo_url: string
          markup_pct: number
          mate_rate: number
          mileage_rate: number
          minimum_charge: number
          notes_to_ai: string
          onboarding_completed: boolean
          out_of_hours_uplift_pct: number
          parking_fee: number
          payment_methods: string
          payment_terms_days: number
          preferred_merchants: string
          quote_validity_days: number
          site_id: string
          standard_exclusions: string
          standard_inclusions: string
          terms: string
          trade: string
          updated_at: string
          vat_number: string
          vat_rate: number
          vat_registered: boolean
          warranty: string
          waste_disposal_fee: number
          website: string
        }
        Insert: {
          accreditations?: string
          business_address?: string
          business_email?: string
          business_name?: string
          business_phone?: string
          callout_fee?: number
          company_number?: string
          contingency_pct?: number
          created_at?: string
          day_rate?: number
          deposit_pct?: number
          free_travel_miles?: number
          id?: string
          insurance?: string
          labour_rate?: number
          logo_url?: string
          markup_pct?: number
          mate_rate?: number
          mileage_rate?: number
          minimum_charge?: number
          notes_to_ai?: string
          onboarding_completed?: boolean
          out_of_hours_uplift_pct?: number
          parking_fee?: number
          payment_methods?: string
          payment_terms_days?: number
          preferred_merchants?: string
          quote_validity_days?: number
          site_id: string
          standard_exclusions?: string
          standard_inclusions?: string
          terms?: string
          trade?: string
          updated_at?: string
          vat_number?: string
          vat_rate?: number
          vat_registered?: boolean
          warranty?: string
          waste_disposal_fee?: number
          website?: string
        }
        Update: {
          accreditations?: string
          business_address?: string
          business_email?: string
          business_name?: string
          business_phone?: string
          callout_fee?: number
          company_number?: string
          contingency_pct?: number
          created_at?: string
          day_rate?: number
          deposit_pct?: number
          free_travel_miles?: number
          id?: string
          insurance?: string
          labour_rate?: number
          logo_url?: string
          markup_pct?: number
          mate_rate?: number
          mileage_rate?: number
          minimum_charge?: number
          notes_to_ai?: string
          onboarding_completed?: boolean
          out_of_hours_uplift_pct?: number
          parking_fee?: number
          payment_methods?: string
          payment_terms_days?: number
          preferred_merchants?: string
          quote_validity_days?: number
          site_id?: string
          standard_exclusions?: string
          standard_inclusions?: string
          terms?: string
          trade?: string
          updated_at?: string
          vat_number?: string
          vat_rate?: number
          vat_registered?: boolean
          warranty?: string
          waste_disposal_fee?: number
          website?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          address: string | null
          cal_booking_id: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          declined_at: string | null
          id: string
          notes: string | null
          phone: string | null
          respond_token: string | null
          responded_by: string | null
          sent_at: string | null
          site_id: string
          site_visit_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          vat_rate: number
          visit_completed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          address?: string | null
          cal_booking_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          declined_at?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          respond_token?: string | null
          responded_by?: string | null
          sent_at?: string | null
          site_id: string
          site_visit_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_rate?: number
          visit_completed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          address?: string | null
          cal_booking_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          declined_at?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          respond_token?: string | null
          responded_by?: string | null
          sent_at?: string | null
          site_id?: string
          site_visit_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_rate?: number
          visit_completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          channel: string
          created_at: string
          due_at: string
          error: string | null
          id: string
          invoice_id: string | null
          job_id: string | null
          kind: string
          message: string | null
          quote_id: string | null
          recipient: string | null
          sent_at: string | null
          site_id: string
          site_visit_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          due_at: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          kind: string
          message?: string | null
          quote_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          site_id: string
          site_visit_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          due_at?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          job_id?: string | null
          kind?: string
          message?: string | null
          quote_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          site_id?: string
          site_visit_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_site_visit_id_fkey"
            columns: ["site_visit_id"]
            isOneToOne: false
            referencedRelation: "site_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      site_visits: {
        Row: {
          address: string | null
          cal_booking_id: string | null
          call_id: string | null
          confirmation_sent_at: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          notes: string | null
          phone: string | null
          scheduled_at: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cal_booking_id?: string | null
          call_id?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          scheduled_at?: string | null
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cal_booking_id?: string | null
          call_id?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          scheduled_at?: string | null
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_visits_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_visits_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string | null
          retell_agent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone_number?: string | null
          retell_agent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string | null
          retell_agent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          customer_email: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          customer_email?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      customer_book: {
        Args: { _site_id: string }
        Returns: {
          address: string
          completed_count: number
          email: string
          first_job: string
          group_key: string
          job_count: number
          last_job: string
          name: string
          paid_revenue: number
          phone: string
          revenue: number
        }[]
      }
      dashboard_summary: {
        Args: { _from: string; _site_id: string; _to: string }
        Returns: Json
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_site: { Args: { _site_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "staff"
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
    Enums: {
      app_role: ["admin", "manager", "staff"],
    },
  },
} as const
