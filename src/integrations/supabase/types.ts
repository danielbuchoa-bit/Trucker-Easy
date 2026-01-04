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
      can_insert_bypass_event: {
        Args: { p_user_id: string; p_weigh_station_id: string }
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
