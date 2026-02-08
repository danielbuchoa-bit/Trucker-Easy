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
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_passwords: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bypass_events: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          lat: number
          lng: number
          occurred_at: string
          result: string
          source: string
          user_id: string
          vehicle_id: string | null
          weigh_station_id: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          lat: number
          lng: number
          occurred_at: string
          result: string
          source?: string
          user_id: string
          vehicle_id?: string | null
          weigh_station_id: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          occurred_at?: string
          result?: string
          source?: string
          user_id?: string
          vehicle_id?: string | null
          weigh_station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bypass_events_weigh_station_id_fkey"
            columns: ["weigh_station_id"]
            isOneToOne: false
            referencedRelation: "weigh_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string | null
          nickname: string | null
          notifications_enabled: boolean | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          nickname?: string | null
          notifications_enabled?: boolean | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          nickname?: string | null
          notifications_enabled?: boolean | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          language: string | null
          last_message_at: string | null
          last_message_preview: string | null
          member_count: number
          message_count: number
          name: string
          region: string | null
          trailer_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          language?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          member_count?: number
          message_count?: number
          name: string
          region?: string | null
          trailer_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          language?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          member_count?: number
          message_count?: number
          name?: string
          region?: string | null
          trailer_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          created_at: string
          document_type: string
          expiration_date: string | null
          file_url: string | null
          id: string
          reminder_sent: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          expiration_date?: string | null
          file_url?: string | null
          id?: string
          reminder_sent?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          expiration_date?: string | null
          file_url?: string | null
          id?: string
          reminder_sent?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_food_profiles: {
        Row: {
          allergies: string[] | null
          budget_preference: string | null
          created_at: string
          diet_type: string | null
          health_goals: string[] | null
          id: string
          restrictions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[] | null
          budget_preference?: string | null
          created_at?: string
          diet_type?: string | null
          health_goals?: string[] | null
          id?: string
          restrictions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string[] | null
          budget_preference?: string | null
          created_at?: string
          diet_type?: string | null
          health_goals?: string[] | null
          id?: string
          restrictions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      emotional_checkins: {
        Row: {
          body_condition: number
          checkin_type: string
          created_at: string
          day_quality: number | null
          energy_level: number
          id: string
          notes: string | null
          stress_level: number
          user_id: string
        }
        Insert: {
          body_condition: number
          checkin_type: string
          created_at?: string
          day_quality?: number | null
          energy_level: number
          id?: string
          notes?: string | null
          stress_level: number
          user_id: string
        }
        Update: {
          body_condition?: number
          checkin_type?: string
          created_at?: string
          day_quality?: number | null
          energy_level?: number
          id?: string
          notes?: string | null
          stress_level?: number
          user_id?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          facility_type: string
          geofence_radius_m: number
          id: string
          lat: number
          lng: number
          name: string
          place_id: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          facility_type?: string
          geofence_radius_m?: number
          id?: string
          lat: number
          lng: number
          name: string
          place_id?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          facility_type?: string
          geofence_radius_m?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          place_id?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      facility_aggregates: {
        Row: {
          avg_exit_ease: number | null
          avg_overall: number
          avg_parking: number | null
          avg_speed: number | null
          avg_staff_help: number | null
          avg_treatment: number | null
          facility_id: string
          review_count: number
          typical_time: string | null
          updated_at: string
        }
        Insert: {
          avg_exit_ease?: number | null
          avg_overall?: number
          avg_parking?: number | null
          avg_speed?: number | null
          avg_staff_help?: number | null
          avg_treatment?: number | null
          facility_id: string
          review_count?: number
          typical_time?: string | null
          updated_at?: string
        }
        Update: {
          avg_exit_ease?: number | null
          avg_overall?: number
          avg_parking?: number | null
          avg_speed?: number | null
          avg_staff_help?: number | null
          avg_treatment?: number | null
          facility_id?: string
          review_count?: number
          typical_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_aggregates_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: true
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_ratings: {
        Row: {
          address: string | null
          avg_wait_minutes: number | null
          comment: string | null
          created_at: string
          dock_access_rating: number | null
          facility_name: string
          facility_type: string
          id: string
          lat: number | null
          lng: number | null
          overall_rating: number
          restroom_rating: number | null
          staff_rating: number | null
          tags: string[] | null
          user_id: string
          wait_time_rating: number | null
        }
        Insert: {
          address?: string | null
          avg_wait_minutes?: number | null
          comment?: string | null
          created_at?: string
          dock_access_rating?: number | null
          facility_name: string
          facility_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          overall_rating: number
          restroom_rating?: number | null
          staff_rating?: number | null
          tags?: string[] | null
          user_id: string
          wait_time_rating?: number | null
        }
        Update: {
          address?: string | null
          avg_wait_minutes?: number | null
          comment?: string | null
          created_at?: string
          dock_access_rating?: number | null
          facility_name?: string
          facility_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          overall_rating?: number
          restroom_rating?: number | null
          staff_rating?: number | null
          tags?: string[] | null
          user_id?: string
          wait_time_rating?: number | null
        }
        Relationships: []
      }
      facility_reviews: {
        Row: {
          created_at: string
          exit_ease_rating: number | null
          facility_id: string
          id: string
          overall_rating: number
          overnight_allowed: string | null
          parking_available: string | null
          parking_rating: number | null
          restroom_available: string | null
          speed_rating: number | null
          staff_help_rating: number | null
          time_spent: string | null
          tips: string | null
          treatment_rating: number | null
          user_id: string
          visit_type: string
        }
        Insert: {
          created_at?: string
          exit_ease_rating?: number | null
          facility_id: string
          id?: string
          overall_rating: number
          overnight_allowed?: string | null
          parking_available?: string | null
          parking_rating?: number | null
          restroom_available?: string | null
          speed_rating?: number | null
          staff_help_rating?: number | null
          time_spent?: string | null
          tips?: string | null
          treatment_rating?: number | null
          user_id: string
          visit_type?: string
        }
        Update: {
          created_at?: string
          exit_ease_rating?: number | null
          facility_id?: string
          id?: string
          overall_rating?: number
          overnight_allowed?: string | null
          parking_available?: string | null
          parking_rating?: number | null
          restroom_available?: string | null
          speed_rating?: number | null
          staff_help_rating?: number | null
          time_spent?: string | null
          tips?: string | null
          treatment_rating?: number | null
          user_id?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_reviews_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_meals: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          meal_name: string
          notes: string | null
          restaurant_name: string
          truck_stop_id: string | null
          truck_stop_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          meal_name: string
          notes?: string | null
          restaurant_name: string
          truck_stop_id?: string | null
          truck_stop_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          meal_name?: string
          notes?: string | null
          restaurant_name?: string
          truck_stop_id?: string | null
          truck_stop_name?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          action: string
          action_at: string
          created_at: string
          id: string
          medication_id: string
          scheduled_at: string
          snooze_minutes: number | null
          user_id: string
        }
        Insert: {
          action: string
          action_at?: string
          created_at?: string
          id?: string
          medication_id: string
          scheduled_at: string
          snooze_minutes?: number | null
          user_id: string
        }
        Update: {
          action?: string
          action_at?: string
          created_at?: string
          id?: string
          medication_id?: string
          scheduled_at?: string
          snooze_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          dosage_text: string
          driving_modal_disabled: boolean | null
          id: string
          name: string
          notes: string | null
          paused: boolean | null
          reminder_minutes_before: number | null
          schedule_type: string
          snooze_enabled: boolean | null
          snooze_options: number[] | null
          times_of_day: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          dosage_text: string
          driving_modal_disabled?: boolean | null
          id?: string
          name: string
          notes?: string | null
          paused?: boolean | null
          reminder_minutes_before?: number | null
          schedule_type?: string
          snooze_enabled?: boolean | null
          snooze_options?: number[] | null
          times_of_day?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          dosage_text?: string
          driving_modal_disabled?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          paused?: boolean | null
          reminder_minutes_before?: number | null
          schedule_type?: string
          snooze_enabled?: boolean | null
          snooze_options?: number[] | null
          times_of_day?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parking_reports: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          poi_id: string
          poi_name: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          poi_id: string
          poi_name: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          poi_id?: string
          poi_name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      poi_feedback: {
        Row: {
          cleanliness_rating: number
          created_at: string
          friendliness_rating: number
          id: string
          poi_id: string
          poi_name: string
          poi_type: string
          recommendation_rating: number
          structure_rating: number | null
          user_id: string
          would_return: boolean | null
        }
        Insert: {
          cleanliness_rating: number
          created_at?: string
          friendliness_rating: number
          id?: string
          poi_id: string
          poi_name: string
          poi_type: string
          recommendation_rating: number
          structure_rating?: number | null
          user_id: string
          would_return?: boolean | null
        }
        Update: {
          cleanliness_rating?: number
          created_at?: string
          friendliness_rating?: number
          id?: string
          poi_id?: string
          poi_name?: string
          poi_type?: string
          recommendation_rating?: number
          structure_rating?: number | null
          user_id?: string
          would_return?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          fraud_flag: boolean
          id: string
          invite_code: string
          invite_link: string
          notes: string | null
          referred_email: string | null
          referred_phone: string | null
          referred_user_id: string | null
          referrer_user_id: string
          reward_amount_cents: number
          reward_currency: string
          reward_reason: string | null
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fraud_flag?: boolean
          id?: string
          invite_code: string
          invite_link: string
          notes?: string | null
          referred_email?: string | null
          referred_phone?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
          reward_amount_cents?: number
          reward_currency?: string
          reward_reason?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fraud_flag?: boolean
          id?: string
          invite_code?: string
          invite_link?: string
          notes?: string | null
          referred_email?: string | null
          referred_phone?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
          reward_amount_cents?: number
          reward_currency?: string
          reward_reason?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: []
      }
      report_votes: {
        Row: {
          created_at: string
          id: string
          report_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_votes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "road_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      road_reports: {
        Row: {
          active: boolean
          confirmations: number
          created_at: string
          denials: number
          details: Json | null
          expires_at: string
          id: string
          lat: number
          lng: number
          report_type: string
          subtype: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          confirmations?: number
          created_at?: string
          denials?: number
          details?: Json | null
          expires_at: string
          id?: string
          lat: number
          lng: number
          report_type: string
          subtype?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          confirmations?: number
          created_at?: string
          denials?: number
          details?: Json | null
          expires_at?: string
          id?: string
          lat?: number
          lng?: number
          report_type?: string
          subtype?: string | null
          user_id?: string
        }
        Relationships: []
      }
      speed_alert_votes: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "speed_alert_votes_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "speed_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      speed_alerts: {
        Row: {
          active: boolean
          alert_type: string
          confirmations: number
          created_at: string
          denials: number
          expires_at: string
          id: string
          lat: number
          lng: number
          speed_limit: number | null
          user_id: string
        }
        Insert: {
          active?: boolean
          alert_type: string
          confirmations?: number
          created_at?: string
          denials?: number
          expires_at?: string
          id?: string
          lat: number
          lng: number
          speed_limit?: number | null
          user_id: string
        }
        Update: {
          active?: boolean
          alert_type?: string
          confirmations?: number
          created_at?: string
          denials?: number
          expires_at?: string
          id?: string
          lat?: number
          lng?: number
          speed_limit?: number | null
          user_id?: string
        }
        Relationships: []
      }
      stop_menu_items: {
        Row: {
          added_by: string
          available: boolean | null
          category: string
          created_at: string
          id: string
          item_name: string
          place_id: string
          price: number | null
          updated_at: string
          upvotes: number | null
        }
        Insert: {
          added_by: string
          available?: boolean | null
          category: string
          created_at?: string
          id?: string
          item_name: string
          place_id: string
          price?: number | null
          updated_at?: string
          upvotes?: number | null
        }
        Update: {
          added_by?: string
          available?: boolean | null
          category?: string
          created_at?: string
          id?: string
          item_name?: string
          place_id?: string
          price?: number | null
          updated_at?: string
          upvotes?: number | null
        }
        Relationships: []
      }
      stop_ratings: {
        Row: {
          bathroom_rating: number | null
          comment: string | null
          created_at: string
          food_rating: number | null
          id: string
          lat: number
          lng: number
          overall_rating: number
          parking_rating: number | null
          place_id: string
          place_name: string
          place_type: string
          price_rating: number | null
          safety_rating: number | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          bathroom_rating?: number | null
          comment?: string | null
          created_at?: string
          food_rating?: number | null
          id?: string
          lat: number
          lng: number
          overall_rating: number
          parking_rating?: number | null
          place_id: string
          place_name: string
          place_type: string
          price_rating?: number | null
          safety_rating?: number | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          bathroom_rating?: number | null
          comment?: string | null
          created_at?: string
          food_rating?: number | null
          id?: string
          lat?: number
          lng?: number
          overall_rating?: number
          parking_rating?: number | null
          place_id?: string
          place_name?: string
          place_type?: string
          price_rating?: number | null
          safety_rating?: number | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          id: string
          plan_tier: string
          provider: string
          source_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier: string
          provider: string
          source_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_tier?: string
          provider?: string
          source_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trucking_news: {
        Row: {
          category: string
          created_at: string
          fetched_at: string
          id: string
          image_url: string | null
          published_at: string
          source: string
          source_url: string
          state: string | null
          summary: string
          title: string
          urgency: string
        }
        Insert: {
          category: string
          created_at?: string
          fetched_at?: string
          id?: string
          image_url?: string | null
          published_at: string
          source: string
          source_url: string
          state?: string | null
          summary: string
          title: string
          urgency?: string
        }
        Update: {
          category?: string
          created_at?: string
          fetched_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          source_url?: string
          state?: string | null
          summary?: string
          title?: string
          urgency?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          amount_cents: number
          applied_at: string | null
          created_at: string
          currency: string
          id: string
          referral_id: string | null
          source: string
          status: Database["public"]["Enums"]["credit_status"]
          user_id: string
        }
        Insert: {
          amount_cents: number
          applied_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          referral_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["credit_status"]
          user_id: string
        }
        Update: {
          amount_cents?: number
          applied_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          referral_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["credit_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      weigh_station_reports: {
        Row: {
          comment: string | null
          created_at: string
          device_anon_id_hash: string | null
          id: string
          lat: number
          lng: number
          outcome: string
          route_id_hash: string | null
          station_id: string
          status_reported: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          device_anon_id_hash?: string | null
          id?: string
          lat: number
          lng: number
          outcome: string
          route_id_hash?: string | null
          station_id: string
          status_reported: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          device_anon_id_hash?: string | null
          id?: string
          lat?: number
          lng?: number
          outcome?: string
          route_id_hash?: string | null
          station_id?: string
          status_reported?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weigh_station_reports_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "weigh_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      weigh_stations: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number | null
          state: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number | null
          state?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number | null
          state?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_user_summary: {
        Row: {
          email: string | null
          full_name: string | null
          joined_at: string | null
          total_checkins: number | null
          total_facility_ratings: number | null
          total_messages: number | null
          total_poi_feedback: number | null
          total_reports: number | null
          total_stop_ratings: number | null
          user_id: string | null
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          joined_at?: string | null
          total_checkins?: never
          total_facility_ratings?: never
          total_messages?: never
          total_poi_feedback?: never
          total_reports?: never
          total_stop_ratings?: never
          user_id?: string | null
        }
        Update: {
          email?: string | null
          full_name?: string | null
          joined_at?: string | null
          total_checkins?: never
          total_facility_ratings?: never
          total_messages?: never
          total_poi_feedback?: never
          total_reports?: never
          total_stop_ratings?: never
          user_id?: string | null
        }
        Relationships: []
      }
      facility_ratings_public: {
        Row: {
          address: string | null
          avg_wait_minutes: number | null
          comment: string | null
          created_at: string | null
          dock_access_rating: number | null
          facility_name: string | null
          facility_type: string | null
          id: string | null
          lat: number | null
          lng: number | null
          overall_rating: number | null
          restroom_rating: number | null
          staff_rating: number | null
          tags: string[] | null
          wait_time_rating: number | null
        }
        Insert: {
          address?: string | null
          avg_wait_minutes?: number | null
          comment?: string | null
          created_at?: string | null
          dock_access_rating?: number | null
          facility_name?: string | null
          facility_type?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          overall_rating?: number | null
          restroom_rating?: number | null
          staff_rating?: number | null
          tags?: string[] | null
          wait_time_rating?: number | null
        }
        Update: {
          address?: string | null
          avg_wait_minutes?: number | null
          comment?: string | null
          created_at?: string | null
          dock_access_rating?: number | null
          facility_name?: string | null
          facility_type?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          overall_rating?: number | null
          restroom_rating?: number | null
          staff_rating?: number | null
          tags?: string[] | null
          wait_time_rating?: number | null
        }
        Relationships: []
      }
      poi_ratings_aggregate: {
        Row: {
          avg_cleanliness: number | null
          avg_friendliness: number | null
          avg_overall: number | null
          avg_recommendation: number | null
          avg_structure: number | null
          poi_id: string | null
          poi_name: string | null
          poi_type: string | null
          review_count: number | null
          would_return_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_create_report: { Args: { p_user_id: string }; Returns: boolean }
      can_earn_referral_reward: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      can_insert_bypass_event: {
        Args: { p_user_id: string; p_weigh_station_id: string }
        Returns: boolean
      }
      can_review_facility: {
        Args: { p_facility_id: string; p_user_id: string }
        Returns: boolean
      }
      can_submit_poi_feedback:
        | { Args: { p_poi_id: string; p_user_id: string }; Returns: boolean }
        | { Args: { p_poi_id: string; p_user_id: string }; Returns: boolean }
      get_available_credits: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_invite_code_valid: { Args: { p_code: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      credit_status: "available" | "applied" | "expired"
      referral_status:
        | "invited"
        | "installed"
        | "subscribed"
        | "cycle1"
        | "cycle2"
        | "cycle3"
        | "reward_earned"
        | "reward_applied"
        | "invalid"
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
      app_role: ["admin", "user"],
      credit_status: ["available", "applied", "expired"],
      referral_status: [
        "invited",
        "installed",
        "subscribed",
        "cycle1",
        "cycle2",
        "cycle3",
        "reward_earned",
        "reward_applied",
        "invalid",
      ],
    },
  },
} as const
