export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      compass_responses: {
        Row: {
          answers: Json | null;
          created_at: string;
          id: string;
          potential_level: string | null;
          profile_id: string;
          routing: string | null;
          theme: string | null;
          tx_volume_band: string | null;
        };
        Insert: {
          answers?: Json | null;
          created_at?: string;
          id?: string;
          potential_level?: string | null;
          profile_id: string;
          routing?: string | null;
          theme?: string | null;
          tx_volume_band?: string | null;
        };
        Update: {
          answers?: Json | null;
          created_at?: string;
          id?: string;
          potential_level?: string | null;
          profile_id?: string;
          routing?: string | null;
          theme?: string | null;
          tx_volume_band?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "compass_responses_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compass_responses_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      membership_tiers: {
        Row: {
          key: string;
          label: string;
          level_rank: number;
          price_year: number;
        };
        Insert: {
          key: string;
          label: string;
          level_rank: number;
          price_year: number;
        };
        Update: {
          key?: string;
          label?: string;
          level_rank?: number;
          price_year?: number;
        };
        Relationships: [];
      };
      partner_categories: {
        Row: {
          key: string;
          label: string;
        };
        Insert: {
          key: string;
          label: string;
        };
        Update: {
          key?: string;
          label?: string;
        };
        Relationships: [];
      };
      profile_contacts: {
        Row: {
          email: string | null;
          phone: string | null;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          email?: string | null;
          phone?: string | null;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          phone?: string | null;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_contacts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_contacts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          branche: string | null;
          company: string | null;
          competencies: string[] | null;
          created_at: string;
          goals: string | null;
          id: string;
          interests: string[] | null;
          is_public: boolean;
          name: string | null;
          potential_score: number;
          profile_completion: number;
          region: string | null;
          short_bio: string | null;
          socials: Json | null;
          tier: string;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          branche?: string | null;
          company?: string | null;
          competencies?: string[] | null;
          created_at?: string;
          goals?: string | null;
          id: string;
          interests?: string[] | null;
          is_public?: boolean;
          name?: string | null;
          potential_score?: number;
          profile_completion?: number;
          region?: string | null;
          short_bio?: string | null;
          socials?: Json | null;
          tier?: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          branche?: string | null;
          company?: string | null;
          competencies?: string[] | null;
          created_at?: string;
          goals?: string | null;
          id?: string;
          interests?: string[] | null;
          is_public?: boolean;
          name?: string | null;
          potential_score?: number;
          profile_completion?: number;
          region?: string | null;
          short_bio?: string | null;
          socials?: Json | null;
          tier?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tier_fkey";
            columns: ["tier"];
            isOneToOne: false;
            referencedRelation: "membership_tiers";
            referencedColumns: ["key"];
          },
        ];
      };
    };
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null;
          company: string | null;
          id: string | null;
          name: string | null;
          region: string | null;
          short_bio: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          company?: string | null;
          id?: string | null;
          name?: string | null;
          region?: string | null;
          short_bio?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          company?: string | null;
          id?: string | null;
          name?: string | null;
          region?: string | null;
          short_bio?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_tier_rank: { Args: never; Returns: number };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
