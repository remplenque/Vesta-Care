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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          ack_at: string | null
          explanation: string | null
          id: string
          level: string
          message: string
          metric: string
          module_id: string
          reading_id: string | null
          status: string
          ts: string
          user_id: string
          value: number | null
        }
        Insert: {
          ack_at?: string | null
          explanation?: string | null
          id?: string
          level: string
          message: string
          metric: string
          module_id: string
          reading_id?: string | null
          status?: string
          ts?: string
          user_id: string
          value?: number | null
        }
        Update: {
          ack_at?: string | null
          explanation?: string | null
          id?: string
          level?: string
          message?: string
          metric?: string
          module_id?: string
          reading_id?: string | null
          status?: string
          ts?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_reading_id_fkey"
            columns: ["reading_id"]
            isOneToOne: false
            referencedRelation: "readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          id: string
          metadata: Json
          role: string
          ts: string
          user_id: string
        }
        Insert: {
          content?: string | null
          id?: string
          metadata?: Json
          role: string
          ts?: string
          user_id: string
        }
        Update: {
          content?: string | null
          id?: string
          metadata?: Json
          role?: string
          ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions: {
        Row: {
          id: string
          name: string
          source: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          source?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          access_token: string
          created_at: string
          id: string
          name: string
          phone: string | null
          relation: string | null
          user_id: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          relation?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          relation?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          description: string
          id: string
          module_id: string | null
          target: Json | null
          user_id: string
        }
        Insert: {
          description: string
          id?: string
          module_id?: string | null
          target?: Json | null
          user_id: string
        }
        Update: {
          description?: string
          id?: string
          module_id?: string | null
          target?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_records: {
        Row: {
          confirmed: boolean
          created_at: string
          extracted: Json | null
          file_path: string | null
          id: string
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          extracted?: Json | null
          file_path?: string | null
          id?: string
          user_id: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          extracted?: Json | null
          file_path?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          dose: string | null
          id: string
          name: string
          schedule: Json
          user_id: string
        }
        Insert: {
          dose?: string | null
          id?: string
          name: string
          schedule?: Json
          user_id: string
        }
        Update: {
          dose?: string | null
          id?: string
          name?: string
          schedule?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          id: string
          manifest: Json
          status: string
        }
        Insert: {
          id: string
          manifest?: Json
          status: string
        }
        Update: {
          id?: string
          manifest?: Json
          status?: string
        }
        Relationships: []
      }
      outbound_messages: {
        Row: {
          alert_id: string | null
          body: string
          channel: string
          contact_id: string | null
          id: string
          ts: string
          user_id: string
        }
        Insert: {
          alert_id?: string | null
          body: string
          channel?: string
          contact_id?: string | null
          id?: string
          ts?: string
          user_id: string
        }
        Update: {
          alert_id?: string | null
          body?: string
          channel?: string
          contact_id?: string | null
          id?: string
          ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "emergency_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          timezone: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          timezone?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          timezone?: string
        }
        Relationships: []
      }
      readings: {
        Row: {
          id: string
          metadata: Json
          metric: string
          module_id: string
          reading_group: string | null
          source: string
          ts: string
          unit: string | null
          user_id: string
          value: number
        }
        Insert: {
          id?: string
          metadata?: Json
          metric: string
          module_id: string
          reading_group?: string | null
          source?: string
          ts?: string
          unit?: string | null
          user_id: string
          value: number
        }
        Update: {
          id?: string
          metadata?: Json
          metric?: string
          module_id?: string
          reading_group?: string | null
          source?: string
          ts?: string
          unit?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "readings_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_personas: {
        Row: {
          active: boolean
          email: string
          emergency_since: string | null
          last_tick: string | null
          persona: string
          profile: string
        }
        Insert: {
          active?: boolean
          email: string
          emergency_since?: string | null
          last_tick?: string | null
          persona: string
          profile: string
        }
        Update: {
          active?: boolean
          email?: string
          emergency_since?: string | null
          last_tick?: string | null
          persona?: string
          profile?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          confirmed: boolean
          enabled: boolean
          module_id: string
          thresholds: Json | null
          thresholds_source: string
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          enabled?: boolean
          module_id: string
          thresholds?: Json | null
          thresholds_source?: string
          user_id: string
        }
        Update: {
          confirmed?: boolean
          enabled?: boolean
          module_id?: string
          thresholds?: Json | null
          thresholds_source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_modules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      evaluate_level: {
        Args: { thresholds: Json; value: number }
        Returns: string
      }
      get_contact_view: { Args: { p_token: string }; Returns: Json }
      get_whatsapp_feed: {
        Args: { p_since?: string }
        Returns: {
          alert_id: string
          body: string
          channel: string
          contact_id: string
          contact_name: string
          contact_phone: string
          id: string
          patient_name: string
          ts: string
          user_id: string
        }[]
      }
      ingest_bp: {
        Args: {
          p_diastolic: number
          p_source?: string
          p_systolic: number
          p_user_id: string
        }
        Returns: string
      }
      ingest_reading: {
        Args: {
          p_metadata?: Json
          p_metric: string
          p_module_id: string
          p_reading_group?: string
          p_source?: string
          p_ts?: string
          p_unit?: string
          p_user_id: string
          p_value: number
        }
        Returns: string
      }
      reset_demo: {
        Args: { p_mode: string; p_user_id?: string }
        Returns: Json
      }
      sim_compact: { Args: never; Returns: number }
      sim_open_session: { Args: never; Returns: string }
      sim_set_active: {
        Args: { p_active: boolean; p_persona: string }
        Returns: undefined
      }
      sim_status: {
        Args: never
        Returns: {
          active: boolean
          emergency_since: string
          last_tick: string
          persona: string
        }[]
      }
      sim_tick: { Args: never; Returns: undefined }
      sim_walk: {
        Args: { p_hi: number; p_last: number; p_lo: number; p_step: number }
        Returns: number
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
    Enums: {},
  },
} as const
