export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      badges: {
        Row: {
          icon: string | null;
          key: string;
          label: string;
        };
        Insert: {
          icon?: string | null;
          key: string;
          label: string;
        };
        Update: {
          icon?: string | null;
          key?: string;
          label?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          post_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          post_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
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
          routing: string;
          status: string;
          to_id: string;
        };
        Insert: {
          created_at?: string;
          from_id: string;
          id?: string;
          match_id?: string | null;
          message?: string | null;
          routing?: string;
          status?: string;
          to_id: string;
        };
        Update: {
          created_at?: string;
          from_id?: string;
          id?: string;
          match_id?: string | null;
          message?: string | null;
          routing?: string;
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
      event_registrations: {
        Row: {
          checked_in: boolean;
          created_at: string;
          event_id: string;
          id: string;
          profile_id: string;
          rating: number | null;
          status: string;
        };
        Insert: {
          checked_in?: boolean;
          created_at?: string;
          event_id: string;
          id?: string;
          profile_id: string;
          rating?: number | null;
          status?: string;
        };
        Update: {
          checked_in?: boolean;
          created_at?: string;
          event_id?: string;
          id?: string;
          profile_id?: string;
          rating?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          capacity: number | null;
          created_at: string;
          host_id: string | null;
          host_partner_id: string | null;
          id: string;
          location: string | null;
          starts_at: string | null;
          title: string;
          type: string | null;
          visibility: string;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          host_id?: string | null;
          host_partner_id?: string | null;
          id?: string;
          location?: string | null;
          starts_at?: string | null;
          title: string;
          type?: string | null;
          visibility?: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          host_id?: string | null;
          host_partner_id?: string | null;
          id?: string;
          location?: string | null;
          starts_at?: string | null;
          title?: string;
          type?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_host_partner_id_fkey";
            columns: ["host_partner_id"];
            isOneToOne: false;
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          profile_id: string;
          rating: number | null;
          ref_id: string | null;
          ref_type: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          profile_id: string;
          rating?: number | null;
          ref_id?: string | null;
          ref_type?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          profile_id?: string;
          rating?: number | null;
          ref_id?: string | null;
          ref_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          category: string;
          id: string;
          profile_id: string;
          progress: number | null;
          title: string;
        };
        Insert: {
          category: string;
          id?: string;
          profile_id: string;
          progress?: number | null;
          title: string;
        };
        Update: {
          category?: string;
          id?: string;
          profile_id?: string;
          progress?: number | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goals_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goals_profile_id_fkey";
            columns: ["profile_id"];
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
      member_settings: {
        Row: {
          contactable_by_prime: boolean;
          notify_email_digest: boolean;
          notify_email_events: boolean;
          notify_email_requests: boolean;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          contactable_by_prime?: boolean;
          notify_email_digest?: boolean;
          notify_email_events?: boolean;
          notify_email_requests?: boolean;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          contactable_by_prime?: boolean;
          notify_email_digest?: boolean;
          notify_email_events?: boolean;
          notify_email_requests?: boolean;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_settings_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
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
      notifications: {
        Row: {
          created_at: string;
          id: string;
          payload: Json | null;
          profile_id: string;
          read_at: string | null;
          type: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          payload?: Json | null;
          profile_id: string;
          read_at?: string | null;
          type?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: Json | null;
          profile_id?: string;
          read_at?: string | null;
          type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_profile_id_fkey";
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
      partners: {
        Row: {
          category: string | null;
          contact: string | null;
          created_at: string;
          description: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          region: string | null;
          website: string | null;
        };
        Insert: {
          category?: string | null;
          contact?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          region?: string | null;
          website?: string | null;
        };
        Update: {
          category?: string | null;
          contact?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          region?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partners_category_fkey";
            columns: ["category"];
            isOneToOne: false;
            referencedRelation: "partner_categories";
            referencedColumns: ["key"];
          },
        ];
      };
      post_likes: {
        Row: {
          created_at: string;
          post_id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_likes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          hashtags: string[] | null;
          id: string;
          visibility: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          hashtags?: string[] | null;
          id?: string;
          visibility?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          hashtags?: string[] | null;
          id?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_badges: {
        Row: {
          awarded_at: string;
          badge_key: string;
          profile_id: string;
        };
        Insert: {
          awarded_at?: string;
          badge_key: string;
          profile_id: string;
        };
        Update: {
          awarded_at?: string;
          badge_key?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_badges_badge_key_fkey";
            columns: ["badge_key"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "profile_badges_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_badges_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
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
      profile_interests: {
        Row: {
          id: string;
          label: string;
          profile_id: string;
          theme: string | null;
        };
        Insert: {
          id?: string;
          label: string;
          profile_id: string;
          theme?: string | null;
        };
        Update: {
          id?: string;
          label?: string;
          profile_id?: string;
          theme?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profile_interests_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_interests_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_theme_scores: {
        Row: {
          profile_id: string;
          score: number;
          theme: string;
        };
        Insert: {
          profile_id: string;
          score: number;
          theme: string;
        };
        Update: {
          profile_id?: string;
          score?: number;
          theme?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_theme_scores_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_theme_scores_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
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
          dev_focus: string | null;
          dev_progress: number | null;
          goals: string | null;
          headline: string | null;
          id: string;
          interests: string[] | null;
          is_public: boolean;
          member_number: string | null;
          member_since: string | null;
          name: string | null;
          next_steps: string[] | null;
          potential_score: number;
          profile_completion: number;
          region: string | null;
          roles: string[] | null;
          short_bio: string | null;
          socials: Json | null;
          tier: string;
          updated_at: string;
          videos: string[];
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          branche?: string | null;
          company?: string | null;
          competencies?: string[] | null;
          created_at?: string;
          dev_focus?: string | null;
          dev_progress?: number | null;
          goals?: string | null;
          headline?: string | null;
          id: string;
          interests?: string[] | null;
          is_public?: boolean;
          member_number?: string | null;
          member_since?: string | null;
          name?: string | null;
          next_steps?: string[] | null;
          potential_score?: number;
          profile_completion?: number;
          region?: string | null;
          roles?: string[] | null;
          short_bio?: string | null;
          socials?: Json | null;
          tier?: string;
          updated_at?: string;
          videos?: string[];
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          branche?: string | null;
          company?: string | null;
          competencies?: string[] | null;
          created_at?: string;
          dev_focus?: string | null;
          dev_progress?: number | null;
          goals?: string | null;
          headline?: string | null;
          id?: string;
          interests?: string[] | null;
          is_public?: boolean;
          member_number?: string | null;
          member_since?: string | null;
          name?: string | null;
          next_steps?: string[] | null;
          potential_score?: number;
          profile_completion?: number;
          region?: string | null;
          roles?: string[] | null;
          short_bio?: string | null;
          socials?: Json | null;
          tier?: string;
          updated_at?: string;
          videos?: string[];
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
          roles: string[] | null;
          short_bio: string | null;
          tier: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          company?: string | null;
          id?: string | null;
          name?: string | null;
          region?: string | null;
          roles?: string[] | null;
          short_bio?: string | null;
          tier?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          company?: string | null;
          id?: string | null;
          name?: string | null;
          region?: string | null;
          roles?: string[] | null;
          short_bio?: string | null;
          tier?: string | null;
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
      // Hand-maintained until `supabase gen types` is re-run (AGE-249). Mirrors the
      // routing_queue table from 20260614120000_volume_routing_queue.sql (§8 manager
      // queue; rows inserted only by the lifecycle trigger, manager-only RLS).
      routing_queue: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          id: string;
          match_id: string;
          need_id: string | null;
          routing: string;
          status: string;
          volume_band: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          id?: string;
          match_id: string;
          need_id?: string | null;
          routing?: string;
          status?: string;
          volume_band?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          id?: string;
          match_id?: string;
          need_id?: string | null;
          routing?: string;
          status?: string;
          volume_band?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "routing_queue_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routing_queue_need_id_fkey";
            columns: ["need_id"];
            isOneToOne: false;
            referencedRelation: "needs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routing_queue_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-249). Mirrors the
      // staff_roles table from 20260614120000_volume_routing_queue.sql (server-controlled
      // matching_manager/admin; self-read only, no client write).
      staff_roles: {
        Row: {
          created_at: string;
          profile_id: string;
          role: string;
        };
        Insert: {
          created_at?: string;
          profile_id: string;
          role: string;
        };
        Update: {
          created_at?: string;
          profile_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_roles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      current_tier_rank: { Args: never; Returns: number };
      is_matching_manager: { Args: never; Returns: boolean };
      is_prime_plus: { Args: never; Returns: boolean };
      // Hand-maintained until `supabase gen types` is re-run (AGE-249). Mirrors the
      // list_routing_queue() RPC from 20260614120000_volume_routing_queue.sql (manager-
      // only enriched read of the §8 routing queue).
      list_routing_queue: {
        Args: never;
        Returns: {
          id: string;
          match_id: string;
          status: string;
          routing: string;
          volume_band: string | null;
          score: number;
          member_a_name: string | null;
          member_b_name: string | null;
          need_category: string | null;
          need_title: string | null;
          assigned_to: string | null;
          created_at: string;
        }[];
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-251). Mirrors
      // 20260615140000_event_rpcs.sql (event registration counts, register, check-in).
      event_registration_counts: {
        Args: { p_event_ids: string[] };
        Returns: {
          event_id: string;
          registered_count: number;
          waitlist_count: number;
        }[];
      };
      register_for_event: {
        Args: { p_event_id: string };
        Returns: string;
      };
      set_event_check_in: {
        Args: { p_registration_id: string; p_checked_in: boolean };
        Returns: undefined;
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-250). Mirrors the
      // post_engagement_counts(uuid[]) RPC from 20260615120000_post_engagement_counts.sql
      // (read-only aggregate like/comment counts per visible post).
      post_engagement_counts: {
        Args: { p_post_ids: string[] };
        Returns: {
          post_id: string;
          like_count: number;
          comment_count: number;
        }[];
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-245). Mirrors the
      // recompute_my_matches() RPC from 20260614090000_match_engine.sql (returns the
      // number of matches upserted for the logged-in member).
      recompute_my_matches: {
        Args: never;
        Returns: number;
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-242). Mirrors the
      // recompute_potential_score(uuid) RPC from 20260613230000_potential_score.sql.
      recompute_potential_score: {
        Args: { p_profile_id: string };
        Returns: Json;
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-241). Mirrors the
      // search_directory(...) RPC from 20260613170000_directory_search.sql exactly.
      search_directory: {
        Args: {
          p_query?: string | null;
          p_theme?: string | null;
          p_branche?: string | null;
          p_region?: string | null;
          p_competency?: string | null;
          p_offering?: string | null;
        };
        Returns: {
          id: string;
          name: string | null;
          avatar_url: string | null;
          region: string | null;
          company: string | null;
          short_bio: string | null;
          branche: string | null;
          tier: string;
          roles: string[] | null;
          competencies: string[] | null;
          has_offers: boolean;
          has_needs: boolean;
        }[];
      };
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
