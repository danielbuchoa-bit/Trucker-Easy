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
      weigh_station_reports: {
        Row: {
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
      [_ in never]: never
    }
    Functions: {
      can_create_report: { Args: { p_user_id: string }; Returns: boolean }
      can_insert_bypass_event: {
        Args: { p_user_id: string; p_weigh_station_id: string }
        Returns: boolean
      }
      can_review_facility: {
        Args: { p_facility_id: string; p_user_id: string }
        Returns: boolean
      }
      can_submit_poi_feedback: {
        Args: { p_poi_id: string; p_user_id: string }
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
