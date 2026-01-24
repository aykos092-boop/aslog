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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"]
          created_at: string
          id: string
          permissions: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          id?: string
          permissions?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          id?: string
          permissions?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_logs: {
        Row: {
          created_at: string
          id: string
          question: string
          response_time_ms: number | null
          satisfaction_rating: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question: string
          response_time_ms?: number | null
          satisfaction_rating?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question?: string
          response_time_ms?: number | null
          satisfaction_rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      balance_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      carrier_preferences: {
        Row: {
          carrier_id: string
          created_at: string
          id: string
          max_weight: number | null
          min_weight: number | null
          notify_all: boolean | null
          preferred_cargo_types: string[] | null
          preferred_routes: string[] | null
          updated_at: string
        }
        Insert: {
          carrier_id: string
          created_at?: string
          id?: string
          max_weight?: number | null
          min_weight?: number | null
          notify_all?: boolean | null
          preferred_cargo_types?: string[] | null
          preferred_routes?: string[] | null
          updated_at?: string
        }
        Update: {
          carrier_id?: string
          created_at?: string
          id?: string
          max_weight?: number | null
          min_weight?: number | null
          notify_all?: boolean | null
          preferred_cargo_types?: string[] | null
          preferred_routes?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          agreed_price: number
          carrier_id: string
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          order_id: string
          proof_photo_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["deal_status"]
          updated_at: string
        }
        Insert: {
          agreed_price: number
          carrier_id: string
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id: string
          proof_photo_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
        }
        Update: {
          agreed_price?: number
          carrier_id?: string
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          order_id?: string
          proof_photo_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      device_fingerprints: {
        Row: {
          city: string | null
          country: string | null
          fingerprint: string
          first_seen_at: string | null
          id: string
          ip_address: string | null
          is_suspicious: boolean | null
          is_vpn: boolean | null
          last_seen_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          fingerprint: string
          first_seen_at?: string | null
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          is_vpn?: boolean | null
          last_seen_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          fingerprint?: string
          first_seen_at?: string | null
          id?: string
          ip_address?: string | null
          is_suspicious?: boolean | null
          is_vpn?: boolean | null
          last_seen_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      favorite_carriers: {
        Row: {
          carrier_id: string
          client_id: string
          created_at: string
          id: string
          note: string | null
        }
        Insert: {
          carrier_id: string
          client_id: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Update: {
          carrier_id?: string
          client_id?: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          address: string
          address_normalized: string
          created_at: string
          formatted_address: string | null
          id: string
          lat: number
          lng: number
          provider: string | null
          updated_at: string
        }
        Insert: {
          address: string
          address_normalized: string
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat: number
          lng: number
          provider?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          address_normalized?: string
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number
          lng?: number
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gps_locations: {
        Row: {
          carrier_id: string
          deal_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          carrier_id: string
          deal_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
        }
        Update: {
          carrier_id?: string
          deal_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gps_locations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          address: string | null
          admin_notes: string | null
          auto_verified: boolean | null
          created_at: string
          data_match_score: number | null
          date_of_birth: string | null
          document_authenticity_score: number | null
          extracted_data: Json | null
          face_match_score: number | null
          first_name: string | null
          id: string
          last_name: string | null
          liveness_score: number | null
          middle_name: string | null
          ocr_confidence: number | null
          ocr_extracted_country: string | null
          ocr_extracted_dob: string | null
          ocr_extracted_expiry: string | null
          ocr_extracted_name: string | null
          ocr_extracted_passport_number: string | null
          ocr_extracted_surname: string | null
          ocr_raw_data: Json | null
          passport_back_url: string | null
          passport_country: string | null
          passport_expiry: string | null
          passport_front_url: string | null
          passport_number: string | null
          passport_series: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
          video_selfie_url: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          auto_verified?: boolean | null
          created_at?: string
          data_match_score?: number | null
          date_of_birth?: string | null
          document_authenticity_score?: number | null
          extracted_data?: Json | null
          face_match_score?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          liveness_score?: number | null
          middle_name?: string | null
          ocr_confidence?: number | null
          ocr_extracted_country?: string | null
          ocr_extracted_dob?: string | null
          ocr_extracted_expiry?: string | null
          ocr_extracted_name?: string | null
          ocr_extracted_passport_number?: string | null
          ocr_extracted_surname?: string | null
          ocr_raw_data?: Json | null
          passport_back_url?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_front_url?: string | null
          passport_number?: string | null
          passport_series?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
          video_selfie_url?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          auto_verified?: boolean | null
          created_at?: string
          data_match_score?: number | null
          date_of_birth?: string | null
          document_authenticity_score?: number | null
          extracted_data?: Json | null
          face_match_score?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          liveness_score?: number | null
          middle_name?: string | null
          ocr_confidence?: number | null
          ocr_extracted_country?: string | null
          ocr_extracted_dob?: string | null
          ocr_extracted_expiry?: string | null
          ocr_extracted_name?: string | null
          ocr_extracted_passport_number?: string | null
          ocr_extracted_surname?: string | null
          ocr_raw_data?: Json | null
          passport_back_url?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_front_url?: string | null
          passport_number?: string | null
          passport_series?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
          video_selfie_url?: string | null
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          balance: number
          created_at: string
          id: string
          lifetime_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          lifetime_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_rewards: {
        Row: {
          created_at: string
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          name: string
          points_cost: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          points_cost: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          points_cost?: number
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          deal_id: string | null
          id: string
          is_system: boolean | null
          order_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deal_id?: string | null
          id?: string
          is_system?: boolean | null
          order_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deal_id?: string | null
          id?: string
          is_system?: boolean | null
          order_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          type?: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          cargo_type: string
          client_id: string
          client_price: number | null
          created_at: string
          delivery_address: string
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_place_id: string | null
          description: string | null
          height: number | null
          id: string
          length: number | null
          photo_urls: string[] | null
          pickup_address: string
          pickup_date: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_place_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          weight: number | null
          width: number | null
        }
        Insert: {
          cargo_type: string
          client_id: string
          client_price?: number | null
          created_at?: string
          delivery_address: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_place_id?: string | null
          description?: string | null
          height?: number | null
          id?: string
          length?: number | null
          photo_urls?: string[] | null
          pickup_address: string
          pickup_date: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_place_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Update: {
          cargo_type?: string
          client_id?: string
          client_price?: number | null
          created_at?: string
          delivery_address?: string
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_place_id?: string | null
          description?: string | null
          height?: number | null
          id?: string
          length?: number | null
          photo_urls?: string[] | null
          pickup_address?: string
          pickup_date?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_place_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          max_attempts: number | null
          phone: string | null
          telegram_chat_id: string | null
          type: string
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          max_attempts?: number | null
          phone?: string | null
          telegram_chat_id?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          max_attempts?: number | null
          phone?: string | null
          telegram_chat_id?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      partner_api_keys: {
        Row: {
          api_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string | null
          request_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          request_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string | null
          request_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_webhooks: {
        Row: {
          created_at: string | null
          events: string[]
          id: string
          is_active: boolean | null
          partner_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          partner_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          partner_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_webhooks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partner_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      price_negotiations: {
        Row: {
          created_at: string
          id: string
          message: string | null
          order_id: string
          proposed_by: string
          proposed_price: number
          response_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          order_id: string
          proposed_by: string
          proposed_price: number
          response_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          order_id?: string
          proposed_by?: string
          proposed_price?: number
          response_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_negotiations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_negotiations_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          balance: number | null
          carrier_type: Database["public"]["Enums"]["carrier_type"] | null
          company_name: string | null
          created_at: string
          date_of_birth: string | null
          device_fingerprint: string | null
          email_verified: boolean | null
          fraud_score: number | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          last_ip: string | null
          locked_until: string | null
          login_attempts: number | null
          passport_number_hash: string | null
          passport_series: string | null
          phone: string | null
          phone_verified: boolean | null
          referral_code: string | null
          subscription_plan: string | null
          updated_at: string
          user_id: string
          vehicle_type: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          balance?: number | null
          carrier_type?: Database["public"]["Enums"]["carrier_type"] | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          device_fingerprint?: string | null
          email_verified?: boolean | null
          fraud_score?: number | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          last_ip?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          passport_number_hash?: string | null
          passport_series?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          subscription_plan?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          balance?: number | null
          carrier_type?: Database["public"]["Enums"]["carrier_type"] | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          device_fingerprint?: string | null
          email_verified?: boolean | null
          fraud_score?: number | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          last_ip?: string | null
          locked_until?: string | null
          login_attempts?: number | null
          passport_number_hash?: string | null
          passport_series?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          referral_code?: string | null
          subscription_plan?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_weight: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_weight?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_weight?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      promo_usages: {
        Row: {
          created_at: string
          discount_applied: number
          id: string
          order_id: string | null
          promo_code_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_applied: number
          id?: string
          order_id?: string | null
          promo_code_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          promo_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_usages_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
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
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          deal_id: string
          id: string
          rated_id: string
          rater_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          deal_id: string
          id?: string
          rated_id: string
          rater_id: string
          score: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          rated_id?: string
          rater_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          bonus_paid: boolean | null
          bonus_paid_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          bonus_paid?: boolean | null
          bonus_paid_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          bonus_paid?: boolean | null
          bonus_paid_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      registration_requests: {
        Row: {
          business_type: string | null
          company_name: string | null
          country: string | null
          created_at: string
          email_verification_token: string | null
          email_verified: boolean | null
          email_verified_at: string | null
          id: string
          onboarding_step: number | null
          privacy_accepted: boolean | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["registration_status"]
          terms_accepted: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_type?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email_verification_token?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          id?: string
          onboarding_step?: number | null
          privacy_accepted?: boolean | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          terms_accepted?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_type?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email_verification_token?: string | null
          email_verified?: boolean | null
          email_verified_at?: string | null
          id?: string
          onboarding_step?: number | null
          privacy_accepted?: boolean | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          terms_accepted?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          carrier_id: string
          comment: string | null
          created_at: string
          delivery_time: string | null
          id: string
          is_accepted: boolean | null
          order_id: string
          price: number
        }
        Insert: {
          carrier_id: string
          comment?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          is_accepted?: boolean | null
          order_id: string
          price: number
        }
        Update: {
          carrier_id?: string
          comment?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          is_accepted?: boolean | null
          order_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "responses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          description: string | null
          device_fingerprint: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          device_fingerprint?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          device_fingerprint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          features: Json | null
          id: string
          is_active: boolean | null
          limits: Json | null
          name: string
          price_monthly: number
          price_yearly: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name: string
          price_monthly: number
          price_yearly?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_users: {
        Row: {
          created_at: string | null
          id: string
          is_verified: boolean | null
          phone: string | null
          telegram_first_name: string | null
          telegram_id: string
          telegram_last_name: string | null
          telegram_username: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          telegram_first_name?: string | null
          telegram_id: string
          telegram_last_name?: string | null
          telegram_username?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          telegram_first_name?: string | null
          telegram_id?: string
          telegram_last_name?: string | null
          telegram_username?: string | null
          updated_at?: string | null
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
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          payme_subscription_id: string | null
          plan_id: string
          status: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payme_subscription_id?: string | null
          plan_id: string
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          payme_subscription_id?: string | null
          plan_id?: string
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_role: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_admin_permission: {
        Args: { p_permission: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_ip_address?: string
          p_new_data?: Json
          p_old_data?: Json
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      admin_role: "super_admin" | "manager" | "operator" | "auditor"
      app_role: "client" | "carrier" | "admin"
      carrier_type: "driver" | "company"
      deal_status:
        | "pending"
        | "accepted"
        | "in_transit"
        | "delivered"
        | "cancelled"
      kyc_status:
        | "not_started"
        | "pending"
        | "verified"
        | "rejected"
        | "manual_review"
      order_status: "open" | "in_progress" | "completed" | "cancelled"
      registration_status:
        | "pending"
        | "approved"
        | "rejected"
        | "resubmission_required"
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
      admin_role: ["super_admin", "manager", "operator", "auditor"],
      app_role: ["client", "carrier", "admin"],
      carrier_type: ["driver", "company"],
      deal_status: [
        "pending",
        "accepted",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      kyc_status: [
        "not_started",
        "pending",
        "verified",
        "rejected",
        "manual_review",
      ],
      order_status: ["open", "in_progress", "completed", "cancelled"],
      registration_status: [
        "pending",
        "approved",
        "rejected",
        "resubmission_required",
      ],
    },
  },
} as const
