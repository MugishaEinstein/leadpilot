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
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          category: string | null
          company: string | null
          country: string | null
          created_at: string
          email: string | null
          follow_up_draft: string | null
          id: string
          maps_url: string | null
          message: string
          name: string
          phone: string | null
          place_id: string | null
          rating: number | null
          review_count: number | null
          score: string | null
          score_reason: string | null
          scrape_job_id: string | null
          source: string
          status: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          follow_up_draft?: string | null
          id?: string
          maps_url?: string | null
          message: string
          name: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          review_count?: number | null
          score?: string | null
          score_reason?: string | null
          scrape_job_id?: string | null
          source?: string
          status?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          follow_up_draft?: string | null
          id?: string
          maps_url?: string | null
          message?: string
          name?: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          review_count?: number | null
          score?: string | null
          score_reason?: string | null
          scrape_job_id?: string | null
          source?: string
          status?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_scrape_job_id_fkey"
            columns: ["scrape_job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_jobs: {
        Row: {
          business_type: string
          country: string
          created_at: string
          id: string
          region_index: number
          regions: string[] | null
          result_count: number
          sheet_tab: string | null
          sheet_url: string | null
          spreadsheet_id: string | null
          user_id: string
        }
        Insert: {
          business_type: string
          country: string
          created_at?: string
          id?: string
          region_index?: number
          regions?: string[] | null
          result_count?: number
          sheet_tab?: string | null
          sheet_url?: string | null
          spreadsheet_id?: string | null
          user_id: string
        }
        Update: {
          business_type?: string
          country?: string
          created_at?: string
          id?: string
          region_index?: number
          regions?: string[] | null
          result_count?: number
          sheet_tab?: string | null
          sheet_url?: string | null
          spreadsheet_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          payment_reference: string | null
          plan: Database["public"]["Enums"]["app_plan"]
          requested_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Insert: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_reference?: string | null
          plan: Database["public"]["Enums"]["app_plan"]
          requested_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_reference?: string | null
          plan?: Database["public"]["Enums"]["app_plan"]
          requested_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sheets: {
        Row: {
          created_at: string
          spreadsheet_id: string
          spreadsheet_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          spreadsheet_id: string
          spreadsheet_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          spreadsheet_id?: string
          spreadsheet_url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_subscription_status: {
        Args: {
          _days?: number
          _id: string
          _note?: string
          _status: Database["public"]["Enums"]["subscription_status"]
        }
        Returns: boolean
      }
      admin_subscriptions: {
        Args: never
        Returns: {
          amount: number
          confirmed_at: string
          email: string
          expires_at: string
          id: string
          note: string
          payment_reference: string
          plan: Database["public"]["Enums"]["app_plan"]
          requested_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_plan: "starter" | "growth" | "scale"
      app_role: "admin" | "user"
      subscription_status:
        | "pending"
        | "active"
        | "expired"
        | "declined"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_plan: ["starter", "growth", "scale"],
      app_role: ["admin", "user"],
      subscription_status: [
        "pending",
        "active",
        "expired",
        "declined",
        "cancelled",
      ],
    },
  },
} as const
