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
      contact_requests: {
        Row: {
          created_at: string;
          from_id: string;
          id: string;
          match_id: string | null;
          message: string | null;
          status: string;
          to_id: string;
        };
        Insert: {
          created_at?: string;
          from_id: string;
          id?: string;
          match_id?: string | null;
          message?: string | null;
          status?: string;
          to_id: string;
        };
        Update: {
          created_at?: string;
          from_id?: string;
          id?: string;
          match_id?: string | null;
          message?: string | null;
          status?: string;
          to_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_requests_from_id_fkey";
            columns: ["from_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_requests_from_id_fkey";
            columns: ["from_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_requests_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_requests_to_id_fkey";
            columns: ["to_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_requests_to_id_fkey";
            columns: ["to_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          a_profile_id: string;
          b_profile_id: string;
          basis: Json | null;
          created_at: string;
          id: string;
          routing: string;
          score: number;
          status: string;
        };
        Insert: {
          a_profile_id: string;
          b_profile_id: string;
          basis?: Json | null;
          created_at?: string;
          id?: string;
          routing?: string;
          score: number;
          status?: string;
        };
        Update: {
          a_profile_id?: string;
          b_profile_id?: string;
          basis?: Json | null;
          created_at?: string;
          id?: string;
          routing?: string;
          score?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_a_profile_id_fkey";
            columns: ["a_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_a_profile_id_fkey";
            columns: ["a_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_b_profile_id_fkey";
            columns: ["b_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_b_profile_id_fkey";
            columns: ["b_profile_id"];
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
      message_threads: {
        Row: {
          a_profile_id: string;
          b_profile_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          a_profile_id: string;
          b_profile_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          a_profile_id?: string;
          b_profile_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_threads_a_profile_id_fkey";
            columns: ["a_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_a_profile_id_fkey";
            columns: ["a_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_b_profile_id_fkey";
            columns: ["b_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_threads_b_profile_id_fkey";
            columns: ["b_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          sender_id: string;
          thread_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          thread_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      needs: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          profile_id: string;
          tags: string[] | null;
          theme: string | null;
          title: string;
          tx_volume_band: string | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          profile_id: string;
          tags?: string[] | null;
          theme?: string | null;
          title: string;
          tx_volume_band?: string | null;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          profile_id?: string;
          tags?: string[] | null;
          theme?: string | null;
          title?: string;
          tx_volume_band?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "needs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "needs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      offers: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          profile_id: string;
          tags: string[] | null;
          theme: string | null;
          title: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          profile_id: string;
          tags?: string[] | null;
          theme?: string | null;
          title: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          profile_id?: string;
          tags?: string[] | null;
          theme?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "offers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "offers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
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
