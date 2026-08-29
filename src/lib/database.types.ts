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
      // Von Hand gepflegt wie der Functions-Block unten (AGE-498): ein volles
      // `supabase gen types` mit CLI 2.113 schreibt die Datei stillos um
      // (Semikolons weg) und markiert RPC-Rueckgabespalten als non-null, was
      // zwanzig Testfixtures bricht, die legitim `null` pruefen. Werkzeug-Drift,
      // kein Schema-Unterschied — gehoert in einen eigenen Change.
      admin_audit: {
        Row: {
          action: string;
          actor: string;
          at: string;
          id: number;
          payload: Json | null;
          target: string;
        };
        Insert: {
          action: string;
          actor: string;
          at?: string;
          id?: never;
          payload?: Json | null;
          target: string;
        };
        Update: {
          action?: string;
          actor?: string;
          at?: string;
          id?: never;
          payload?: Json | null;
          target?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_actor_fkey";
            columns: ["actor"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
        // AGE-531 (C8), von Hand ergänzt: vier Spalten, und `starts_at` wird
        // an ALLEN DREI Stellen nicht-nullbar. Nur die Row zu verengen reichte
        // nicht — der Typvertrag nähme sonst weiterhin genau den Schreibzugriff
        // an, den `alter column starts_at set not null` verbietet.
        Row: {
          capacity: number | null;
          cover_path: string | null;
          created_at: string;
          description: string | null;
          ends_at: string | null;
          host_id: string | null;
          host_partner_id: string | null;
          id: string;
          location: string | null;
          starts_at: string;
          title: string;
          topics: string[] | null;
          type: string | null;
          visibility: string;
        };
        Insert: {
          capacity?: number | null;
          cover_path?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string | null;
          host_id?: string | null;
          host_partner_id?: string | null;
          id?: string;
          location?: string | null;
          starts_at: string;
          title: string;
          topics?: string[] | null;
          type?: string | null;
          visibility?: string;
        };
        Update: {
          capacity?: number | null;
          cover_path?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string | null;
          host_id?: string | null;
          host_partner_id?: string | null;
          id?: string;
          location?: string | null;
          starts_at?: string;
          title?: string;
          topics?: string[] | null;
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
          idea: string | null;
          likes: string | null;
          misses: string | null;
          note: string | null;
          profile_id: string;
          rating: number | null;
          ref_id: string | null;
          ref_type: string | null;
          route: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idea?: string | null;
          likes?: string | null;
          misses?: string | null;
          note?: string | null;
          profile_id: string;
          rating?: number | null;
          ref_id?: string | null;
          ref_type?: string | null;
          route?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          idea?: string | null;
          likes?: string | null;
          misses?: string | null;
          note?: string | null;
          profile_id?: string;
          rating?: number | null;
          ref_id?: string | null;
          ref_type?: string | null;
          route?: string | null;
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
          // AGE-641 (war AGE-620) — die sechs App-Schalter. Ein Schalter je
          // EREIGNIS, nicht je Transport: Glocke und Push gemeinsam.
          // `not null default true` in der Migration, also hier ohne `| null`.
          notify_app_comment: boolean;
          notify_app_contact: boolean;
          notify_app_event: boolean;
          notify_app_like: boolean;
          notify_app_message: boolean;
          notify_app_post: boolean;
          onboarded_at: string | null;
          profile_id: string;
          theme: string;
          updated_at: string;
        };
        Insert: {
          contactable_by_prime?: boolean;
          notify_email_digest?: boolean;
          notify_email_events?: boolean;
          notify_email_requests?: boolean;
          notify_app_comment?: boolean;
          notify_app_contact?: boolean;
          notify_app_event?: boolean;
          notify_app_like?: boolean;
          notify_app_message?: boolean;
          notify_app_post?: boolean;
          onboarded_at?: string | null;
          profile_id: string;
          theme?: string;
          updated_at?: string;
        };
        Update: {
          contactable_by_prime?: boolean;
          notify_email_digest?: boolean;
          notify_email_events?: boolean;
          notify_email_requests?: boolean;
          notify_app_comment?: boolean;
          notify_app_contact?: boolean;
          notify_app_event?: boolean;
          notify_app_like?: boolean;
          notify_app_message?: boolean;
          notify_app_post?: boolean;
          onboarded_at?: string | null;
          profile_id?: string;
          theme?: string;
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
      platform_settings: {
        Row: {
          id: boolean;
          open_contact: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: boolean;
          open_contact?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: boolean;
          open_contact?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
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
        // last_message_* fuehrt messages_thread_aktivitaet() (AGE-627). Die
        // drei Spalten stehen bewusst NUR in Row: authenticated haelt kein
        // UPDATE auf dieser Tabelle, und ein beim INSERT mitgegebener Wert
        // wird vom BEFORE-Trigger verworfen. Sie in Insert/Update zu fuehren
        // hiesse, einen Schreibweg anzubieten, den es nicht gibt.
        Row: {
          a_profile_id: string;
          b_profile_id: string;
          created_at: string;
          id: string;
          last_message_at: string | null;
          last_message_body: string | null;
          last_message_sender_id: string | null;
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
          source: string;
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
          source?: string;
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
          source?: string;
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
          source: string;
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
          source?: string;
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
          source?: string;
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
      post_media: {
        Row: {
          created_at: string;
          height: number;
          id: string;
          post_id: string;
          sort: number;
          storage_path: string;
          width: number;
        };
        Insert: {
          created_at?: string;
          height: number;
          id?: string;
          post_id: string;
          sort: number;
          storage_path: string;
          width: number;
        };
        Update: {
          created_at?: string;
          height?: number;
          id?: string;
          post_id?: string;
          sort?: number;
          storage_path?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_saves: {
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
            foreignKeyName: "post_saves_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_saves_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_saves_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles_public";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          angekuendigt_am: string | null;
          author_id: string;
          body: string;
          created_at: string;
          hashtags: string[] | null;
          id: string;
          kind: string;
          like_count: number;
          ref_id: string | null;
          veroeffentlicht_ab: string;
          video_url: string | null;
          visibility: string;
        };
        Insert: {
          angekuendigt_am?: string | null;
          author_id: string;
          body: string;
          created_at?: string;
          hashtags?: string[] | null;
          id?: string;
          kind?: string;
          like_count?: number;
          ref_id?: string | null;
          veroeffentlicht_ab?: string;
          video_url?: string | null;
          visibility?: string;
        };
        Update: {
          angekuendigt_am?: string | null;
          author_id?: string;
          body?: string;
          created_at?: string;
          hashtags?: string[] | null;
          id?: string;
          kind?: string;
          like_count?: number;
          ref_id?: string | null;
          veroeffentlicht_ab?: string;
          video_url?: string | null;
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
          {
            foreignKeyName: "posts_ref_id_fkey";
            columns: ["ref_id"];
            isOneToOne: false;
            referencedRelation: "events";
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
          city: string | null;
          country: string | null;
          email: string | null;
          phone: string | null;
          postal_code: string | null;
          profile_id: string;
          state: string | null;
          street: string | null;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          profile_id: string;
          state?: string | null;
          street?: string | null;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          email?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          profile_id?: string;
          state?: string | null;
          street?: string | null;
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
      // Kein Client-Grant und keine Policy (20260811090100): der Typ steht hier
      // fuer die Admin-RPCs und den Import, nicht fuer einen Client-Zugriff.
      // Eine Abfrage von `authenticated` aus laeuft in „permission denied".
      profile_legacy: {
        Row: {
          created_at: string;
          legacy_price: number | null;
          legacy_source_id: string | null;
          legacy_tier: string | null;
          paid_until: string | null;
          profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          legacy_price?: number | null;
          legacy_source_id?: string | null;
          legacy_tier?: string | null;
          paid_until?: string | null;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          legacy_price?: number | null;
          legacy_source_id?: string | null;
          legacy_tier?: string | null;
          paid_until?: string | null;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_legacy_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profile_legacy_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
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
          cover_url: string | null;
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
          cover_url?: string | null;
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
          cover_url?: string | null;
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
      release_entry_skips: {
        // `skipped_by` und `skipped_at` stehen NUR in Row: beide füllt die
        // Datenbank (`default auth.uid()` bzw. `default now()`), und die
        // Insert-Policy verlangt `skipped_by = auth.uid()`. Ein Client, der sie
        // mitschickt, wird abgewiesen — der Typ sagt es ihm vorher.
        //
        // Kein `Update`: die Tabelle trägt kein UPDATE-Recht. Zurückgenommen
        // wird per DELETE, und das ist dieselbe Zeile, weil `slug` der
        // Primärschlüssel ist.
        Row: {
          skipped_at: string;
          skipped_by: string | null;
          slug: string;
        };
        Insert: {
          slug: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "release_entry_skips_skipped_by_fkey";
            columns: ["skipped_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      release_notes: {
        // `status` steht bewusst in Insert UND Update — der Client DARF ihn
        // schreiben, aber nur als 'draft'; das hält die Policy
        // `release_notes_admin_draft`/`_edit` fest, in `using` und
        // `with check`. Der Wechsel auf 'sent' gehört allein
        // `send_release_note()`, und die drei Spalten, die dabei entstehen,
        // stehen deshalb NUR in Row.
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          entry_slugs: string[];
          id: string;
          recipient_count: number | null;
          sent_at: string | null;
          status: string;
          title: string;
        };
        Insert: {
          body: string;
          created_by?: string | null;
          entry_slugs?: string[];
          id?: string;
          status?: string;
          title: string;
        };
        Update: {
          body?: string;
          entry_slugs?: string[];
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "release_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null;
          company: string | null;
          cover_url: string | null;
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
          cover_url?: string | null;
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
          cover_url?: string | null;
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
      tags: {
        Row: {
          active: boolean;
          key: string;
          label: string;
          sort: number;
        };
        Insert: {
          active?: boolean;
          key: string;
          label: string;
          sort: number;
        };
        Update: {
          active?: boolean;
          key?: string;
          label?: string;
          sort?: number;
        };
        Relationships: [];
      };
      /** Lesestand je Mitglied und Thread (AGE-583). Eigentuemerprivat: die
       *  Zeile des Gegenuebers ist nicht lesbar. Deshalb liegt der Wert hier
       *  und NICHT als Spalte auf `message_threads` — dort gibt
       *  `threads_select` jedem Teilnehmer die ganze Zeile, und der Lesestand
       *  waere eine Lesebestaetigung. */
      thread_read_positions: {
        Row: {
          last_read_at: string;
          profile_id: string;
          thread_id: string;
        };
        Insert: {
          last_read_at?: string;
          profile_id: string;
          thread_id: string;
        };
        Update: {
          last_read_at?: string;
          profile_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_read_positions_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "message_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_read_positions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      create_post_with_media: {
        Args: {
          p_post_id: string;
          p_body: string;
          p_visibility: string;
          p_hashtags: string[];
          p_tags: string[];
          p_media: Json;
          /** AGE-667: OHNE Fragezeichen. Der Parameter traegt in Postgres
           *  bewusst keinen Vorgabewert — der erzeugte eine Ueberladung statt
           *  einer Ersetzung, und der alte sechsstellige Schreibweg bliebe
           *  daneben offen. `null` heisst „sofort". */
          p_veroeffentlicht_ab: string | null;
        };
        Returns: string;
      };
      current_tier_rank: { Args: never; Returns: number };
      /** AGE-631: stellt eine Release-Note genau EINMAL zu; gibt die Zahl der
       *  wirklich beschriebenen Mitglieder zurueck. Wirft, wenn der Aufrufer
       *  kein Admin ist oder die Note schon zugestellt wurde. */
      send_release_note: { Args: { p_id: string }; Returns: number };
      is_matching_manager: { Args: never; Returns: boolean };
      // `is_prime_plus` stand hier bis 2026-08-06 und existierte in der Datenbank
      // seit AGE-311 nicht mehr (gedroppt in 20260715150000:319, nachdem alle
      // sieben abhaengigen Policies auf has_level() umgehaengt worden waren).
      // Eine tote Zeile in einer generierten Datei — entfernt mit AGE-495.
      //
      // Aktivierungs-Gate (AGE-495). Wie der Rest dieses Blocks von Hand
      // gepflegt: ein vollstaendiges `supabase gen types` bringt derzeit
      // Nullability-Drift in unbeteiligten Typen mit und gehoert in einen
      // eigenen Change.
      is_activated: { Args: never; Returns: boolean };
      /** Ungelesene Nachrichten je Thread fuer den Aufrufer (AGE-583).
       *
       *  `unread_count` ist in der Datenbank `bigint` (der Typ von `count(*)`),
       *  kommt ueber PostgREST aber als JSON-**Zahl** an — am 26.08. gegen den
       *  lokalen Stack gemessen, nicht angenommen: `typeof` ist `number` und
       *  `wert + 1` ergibt 3, nicht "21". Die Genauigkeitsgrenze von
       *  JS-Zahlen liegt bei 2^53 und ist fuer eine Zahl ungelesener
       *  Nachrichten ohne Belang.
       *
       *  Threads OHNE Ungelesenes kommen GAR NICHT vor — nicht als Zeile mit 0.
       *  Ein nicht aktiviertes Konto bekommt null Zeilen; die Funktion ist
       *  SECURITY INVOKER und erbt das Gate aus den Policies. */
      unread_message_counts: {
        Args: never;
        Returns: { thread_id: string; unread_count: number }[];
      };
      my_activation_state: {
        Args: never;
        /** `blocked` seit AGE-581: wahr bei deaktiviert ODER geloescht. Ein
         *  Wahrheitswert und kein Zustandswort — welche der beiden Handlungen
         *  ein Admin vorgenommen hat, geht den Betroffenen so wenig an wie
         *  einen Leser des Feeds. `activated` behaelt seine Bedeutung („hat je
         *  bestaetigt") und wird davon NICHT umgedeutet. */
        Returns: { activated: boolean; blocked: boolean; display_name: string | null }[];
      };
      // Admin-Bearbeitung fremder Profile (AGE-498), aus
      // 20260811090300_admin_profile_functions.sql. Von Hand gepflegt wie der
      // Rest dieses Blocks.
      //
      // Alle drei sind fuer `authenticated` ausfuehrbar — die Abwehr sitzt IN
      // der Funktion (is_admin()), damit sie pruefbar ist. Ein Nicht-Admin
      // bekommt eine Ausnahme, keine leere Antwort.
      admin_update_profile: {
        Args: { target: string; patch: Json };
        Returns: undefined;
      };
      // Stufe eines Mitglieds setzen (AGE-634), aus
      // 20260827160000_admin_set_tier.sql. Von Hand gepflegt wie der Rest
      // dieses Blocks — `supabase gen types` NICHT darueberlaufen lassen.
      admin_set_tier: {
        Args: { p_profile_id: string; p_tier: string; p_grund: string };
        Returns: string;
      };
      admin_get_profile: { Args: { target: string }; Returns: Json };
      admin_find_profile: { Args: { needle: string }; Returns: Json };
      // Admin-Mitgliederliste (AGE-566), aus 20260817120000_admin_member_list.sql.
      // Von Hand gepflegt wie der Rest dieses Blocks.
      //
      // Die ersten fuenfzehn Rueckgabespalten sind die von `search_directory`, in
      // deren Reihenfolge — daran haengt die Verzeichnis-Ansicht, die dieselbe
      // Karte speist. Ein pgTAP-Test haelt beide Spaltenlisten UND fuer ein
      // bestaetigtes Mitglied den Zeileninhalt gegeneinander; laeuft eine weg,
      // wird er rot und benennt die abweichende Spalte.
      //
      // ALLE VIER Argumente sind optional. Ohne Vorgabewerte scheiterte der
      // argumentlose Aufruf mit 42883 statt der zugesicherten 42501 — hier steht
      // deshalb `?`, weil es in der Datenbank ein `default` gibt, nicht umgekehrt.
      admin_list_members: {
        Args: {
          /** Sucht in `name` UND `login_email`, ohne Ruecksicht auf die
           *  Schreibung. Leer und null filtern nicht; Jokerzeichen sind Text. */
          p_query?: string | null;
          /** `alle` | `aktiviert` | `offen` | `deaktiviert` | `geloescht`
           *  (AGE-581). null wirkt wie `alle`; jeder andere Wert bricht mit
           *  22023 ab, statt still alles zu zeigen. Die ersten drei schliessen
           *  Deaktivierte und Geloeschte AUS — sie beantworten Fragen ueber die
           *  Mitgliedschaft, nicht ueber den Tabelleninhalt. */
          p_status?: string | null;
          p_limit?: number | null;
          p_offset?: number | null;
        };
        Returns: {
          id: string;
          name: string | null;
          avatar_url: string | null;
          /** Relativer PFAD im Bucket `covers`, keine fertige URL (AGE-580).
           *  Die Karte uebersetzt ihn ueber `bildUrl("covers", …)`; wer den Wert
           *  direkt in `src` schreibt, rendert tote Bilder. */
          cover_url: string | null;
          region: string | null;
          company: string | null;
          short_bio: string | null;
          branche: string | null;
          tier: string;
          roles: string[] | null;
          competencies: string[] | null;
          has_offers: boolean;
          has_needs: boolean;
          /** Distinct, ohne NULL, leeres Array statt NULL — nie `null`. */
          offer_categories: string[];
          need_categories: string[];
          /** Die Anmeldeadresse aus `auth.users`, NICHT die Kontaktadresse. */
          login_email: string;
          /** `activated_at is not null` — damit die Flaeche den Zustand anzeigt,
           *  statt ihn zu erraten. */
          bestaetigt: boolean;
          member_since: string | null;
          /** Zeitpunkte, keine Wahrheitswerte (AGE-581): die Flaeche soll sagen
           *  koennen, SEIT WANN. Beide null heisst unversehrt. */
          deaktiviert_seit: string | null;
          geloescht_seit: string | null;
          /** Aus `profile_legacy`, ueber einen LEFT JOIN — ein Mitglied ohne
           *  Altdatenzeile faellt nicht aus der Liste, es traegt hier null. */
          paid_until: string | null;
          payment_type: string | null;
          /** Steht ein GoTrue-Ban in der ZUKUNFT? (AGE-581) Die einzige Auskunft
           *  der Flaeche ueber `banned_until`. Das Zeilenmenue braucht sie, um
           *  den Nachsetz-Weg fuer einen fehlenden Ban anzubieten: eine
           *  deaktivierte Zeile OHNE Ban ist ein halber Zustand und sieht sonst
           *  aus wie jede andere. Ein ABGELAUFENER Ban zaehlt nicht. */
          gebannt: boolean;
        }[];
      };
      /** Aktiviert ein fremdes Profil und schreibt in DERSELBEN Transaktion nach
       *  `admin_audit`. Bricht mit 22023 ab, wenn das Ziel schon bestaetigt ist. */
      admin_activate_member: { Args: { target: string }; Returns: string };
      // Hand-maintained until `supabase gen types` is re-run (AGE-358). Mirrors the
      // admin_list_feedback(int, int) RPC from
      // 20260825120000_admin_zaehler_und_feedback_blaetterung.sql (admin-only enriched
      // read of QM feedback with the author name; empty for non-admins, geblaettert).
      admin_list_feedback: {
        Args: {
          /** 1..100, geklemmt statt abgewiesen; null faellt auf 25 zurueck. */
          p_limit?: number | null;
          /** >= 0, geklemmt. Die Ordnung ist `created_at desc, id desc` und
           *  damit total — ohne den zweiten Schluessel koennte dieselbe Zeile
           *  auf zwei Seiten stehen. */
          p_offset?: number | null;
        };
        Returns: {
          id: string;
          rating: number | null;
          likes: string | null;
          misses: string | null;
          idea: string | null;
          route: string | null;
          ref_type: string | null;
          created_at: string;
          author_name: string;
          profile_id: string;
        }[];
      };
      // Hand-maintained until `supabase gen types` is re-run (AGE-249). Mirrors the
      // admin_member_counts() RPC from
      // 20260825120000_admin_zaehler_und_feedback_blaetterung.sql (wie viele Mitglieder
      // in jedem Zustand stehen — eine Zeile je Zustand EINSCHLIESSLICH der mit null,
      // global und ohne Suchbegriff; bricht fuer Nicht-Admins mit 42501 ab, statt
      // Nullen zu liefern).
      admin_member_counts: {
        Args: never;
        Returns: {
          /** `alle` | `aktiviert` | `offen` | `deaktiviert` | `geloescht` —
           *  dieselben Zustaende, die `admin_list_members.p_status` kennt, und
           *  entschieden von derselben `member_state_matches`. */
          status: string;
          anzahl: number;
        }[];
      };
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
      // AGE-531 (C8): die Teilnehmerreihe. Bewusst OHNE `checked_in` und
      // `rating` — die bleiben dem Host über regs_select_self_or_host.
      event_attendees: {
        Args: { p_event_id: string };
        Returns: {
          profile_id: string;
          status: string;
        }[];
      };
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
      // Von Hand nachgetragen, wie die Nachbarn (AGE-358). Spiegelt
      // former_member_entries(uuid[], uuid[]) aus
      // 20260823160000_former_member_entries.sql (AGE-581).
      former_member_entries: {
        Args: {
          /** BEITRAGS-IDs, keine Profil-IDs — die Funktion loest den Urheber
           *  selbst auf und prueft dabei dieselbe Sichtbarkeit wie fuer den
           *  Beitrag. Mit Profil-IDs waere sie ein Weg, den Bestand nach
           *  Entfernten durchzufragen. */
          p_post_ids?: string[];
          p_comment_ids?: string[];
        };
        Returns: {
          /** `post` oder `comment`. */
          kind: string;
          entry_id: string;
          /** Deaktiviert ODER geloescht — welche der beiden Handlungen ein
           *  Admin vorgenommen hat, gibt sie bewusst NICHT preis. */
          former: boolean;
        }[];
      };
      // Von Hand nachgetragen (AGE-582). Spiegelt die beiden Aggregate aus
      // 20260824170000_feed_sidebar_aggregate.sql. Beide sind `security invoker`
      // — sie kopieren das Sichtbarkeitspraedikat NICHT, es gilt das des
      // Aufrufers.
      feed_tag_counts: {
        Args: never;
        Returns: {
          tag_key: string;
          tag_label: string;
          /** `bigint` aus `count(*)` — supabase-js liefert es als number. */
          post_count: number;
        }[];
      };
      feed_top_authors: {
        /** Wird auf 1..20 geklemmt, `null` wird zu 5. */
        Args: { p_limit?: number };
        Returns: {
          profile_id: string;
          name: string;
          /** NICHT `string`, anders als der Typgenerator meldet: `avatar_url`
           *  ist in `profiles_public` nullbar, und die meisten Profile tragen
           *  keines. Dieselbe Werkzeug-Drift wie im Dateikopf beschrieben. */
          avatar_url: string | null;
          post_count: number;
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
      // search_directory(...) RPC from 20260804200000_directory_search_categories.sql
      // exactly — die Signatur hat dort acht Parameter, weil sie ERSETZT wurde
      // (drop + create); die alte sechsstellige Fassung existiert nicht mehr.
      search_directory: {
        Args: {
          p_query?: string | null;
          p_theme?: string | null;
          p_branche?: string | null;
          p_region?: string | null;
          p_competency?: string | null;
          p_offering?: string | null;
          /** Kompass-Kategorien „bietet": ODER innerhalb, UND gegen p_needs. */
          p_offers?: string[] | null;
          /** Kompass-Kategorien „sucht". Leeres Array filtert NICHT. */
          p_needs?: string[] | null;
        };
        Returns: {
          id: string;
          name: string | null;
          avatar_url: string | null;
          /** Relativer PFAD im Bucket `covers`, keine fertige URL (AGE-580).
           *  Die Karte uebersetzt ihn ueber `bildUrl("covers", …)`; wer den Wert
           *  direkt in `src` schreibt, rendert tote Bilder. */
          cover_url: string | null;
          region: string | null;
          company: string | null;
          short_bio: string | null;
          branche: string | null;
          tier: string;
          roles: string[] | null;
          competencies: string[] | null;
          has_offers: boolean;
          has_needs: boolean;
          /** Distinct, ohne NULL, leeres Array statt NULL — nie `null`. */
          offer_categories: string[];
          need_categories: string[];
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
