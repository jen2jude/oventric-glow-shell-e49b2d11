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
      ad_campaigns: {
        Row: {
          advertiser: string
          advertiser_email: string | null
          advertiser_user_id: string | null
          advertiser_whatsapp: string | null
          body: string
          cities: string[]
          countries: string[]
          created_at: string
          created_by: string | null
          cta_label: string
          cta_lead_email: string | null
          cta_type: string
          cta_url: string
          cta_whatsapp: string | null
          daily_budget_usd: number
          description: string
          end_at: string | null
          escrow_locked: number
          header: string
          id: string
          media_path: string | null
          media_url: string | null
          placements: string[]
          priority: number
          spent_usd: number
          start_at: string | null
          status: string
          tier: string
          title: string
          total_budget_usd: number
          updated_at: string
        }
        Insert: {
          advertiser: string
          advertiser_email?: string | null
          advertiser_user_id?: string | null
          advertiser_whatsapp?: string | null
          body?: string
          cities?: string[]
          countries?: string[]
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_lead_email?: string | null
          cta_type?: string
          cta_url?: string
          cta_whatsapp?: string | null
          daily_budget_usd?: number
          description?: string
          end_at?: string | null
          escrow_locked?: number
          header?: string
          id?: string
          media_path?: string | null
          media_url?: string | null
          placements?: string[]
          priority?: number
          spent_usd?: number
          start_at?: string | null
          status?: string
          tier: string
          title: string
          total_budget_usd?: number
          updated_at?: string
        }
        Update: {
          advertiser?: string
          advertiser_email?: string | null
          advertiser_user_id?: string | null
          advertiser_whatsapp?: string | null
          body?: string
          cities?: string[]
          countries?: string[]
          created_at?: string
          created_by?: string | null
          cta_label?: string
          cta_lead_email?: string | null
          cta_type?: string
          cta_url?: string
          cta_whatsapp?: string | null
          daily_budget_usd?: number
          description?: string
          end_at?: string | null
          escrow_locked?: number
          header?: string
          id?: string
          media_path?: string | null
          media_url?: string | null
          placements?: string[]
          priority?: number
          spent_usd?: number
          start_at?: string | null
          status?: string
          tier?: string
          title?: string
          total_budget_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      ad_creatives: {
        Row: {
          bytes: number | null
          campaign_id: string
          created_at: string
          duration_s: number | null
          height: number | null
          id: string
          kind: string
          mime: string | null
          path: string
          sort_order: number
          width: number | null
        }
        Insert: {
          bytes?: number | null
          campaign_id: string
          created_at?: string
          duration_s?: number | null
          height?: number | null
          id?: string
          kind: string
          mime?: string | null
          path: string
          sort_order?: number
          width?: number | null
        }
        Update: {
          bytes?: number | null
          campaign_id?: string
          created_at?: string
          duration_s?: number | null
          height?: number | null
          id?: string
          kind?: string
          mime?: string | null
          path?: string
          sort_order?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_daily_spend: {
        Row: {
          campaign_id: string
          clicks: number
          day: string
          impressions: number
          leads: number
          spent_usd: number
        }
        Insert: {
          campaign_id: string
          clicks?: number
          day: string
          impressions?: number
          leads?: number
          spent_usd?: number
        }
        Update: {
          campaign_id?: string
          clicks?: number
          day?: string
          impressions?: number
          leads?: number
          spent_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_spend_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_events: {
        Row: {
          campaign_id: string
          city: string | null
          cost_usd: number
          country: string | null
          id: string
          kind: string
          occurred_at: string
          placement: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          city?: string | null
          cost_usd?: number
          country?: string | null
          id?: string
          kind: string
          occurred_at?: string
          placement?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          city?: string | null
          cost_usd?: number
          country?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          placement?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_inquiries: {
        Row: {
          acknowledged: boolean
          admin_notes: string | null
          body: string | null
          cities: string[] | null
          company: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          countries: string[] | null
          created_at: string
          cta_type: string | null
          cta_url: string | null
          cta_whatsapp: string | null
          daily_budget_usd: number | null
          demographics: Json | null
          description: string | null
          duration_days: number | null
          header: string
          id: string
          image_paths: string[] | null
          notes: string | null
          objective: string | null
          status: string
          tier: string
          total_budget_usd: number | null
          updated_at: string
          user_id: string | null
          video_path: string | null
          video_url: string | null
          website: string | null
        }
        Insert: {
          acknowledged?: boolean
          admin_notes?: string | null
          body?: string | null
          cities?: string[] | null
          company?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          countries?: string[] | null
          created_at?: string
          cta_type?: string | null
          cta_url?: string | null
          cta_whatsapp?: string | null
          daily_budget_usd?: number | null
          demographics?: Json | null
          description?: string | null
          duration_days?: number | null
          header: string
          id?: string
          image_paths?: string[] | null
          notes?: string | null
          objective?: string | null
          status?: string
          tier: string
          total_budget_usd?: number | null
          updated_at?: string
          user_id?: string | null
          video_path?: string | null
          video_url?: string | null
          website?: string | null
        }
        Update: {
          acknowledged?: boolean
          admin_notes?: string | null
          body?: string | null
          cities?: string[] | null
          company?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          countries?: string[] | null
          created_at?: string
          cta_type?: string | null
          cta_url?: string | null
          cta_whatsapp?: string | null
          daily_budget_usd?: number | null
          demographics?: Json | null
          description?: string | null
          duration_days?: number | null
          header?: string
          id?: string
          image_paths?: string[] | null
          notes?: string | null
          objective?: string | null
          status?: string
          tier?: string
          total_budget_usd?: number | null
          updated_at?: string
          user_id?: string | null
          video_path?: string | null
          video_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      ad_leads: {
        Row: {
          campaign_id: string
          created_at: string
          digest_sent_at: string | null
          email: string | null
          id: string
          message: string | null
          meta: Json
          name: string | null
          phone: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          digest_sent_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          meta?: Json
          name?: string | null
          phone?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          digest_sent_at?: string | null
          email?: string | null
          id?: string
          message?: string | null
          meta?: Json
          name?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_targets_cities: {
        Row: {
          active: boolean
          city: string
          country_code: string
          created_at: string
          id: string
          region: string | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          city: string
          country_code: string
          created_at?: string
          id?: string
          region?: string | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          city?: string
          country_code?: string
          created_at?: string
          id?: string
          region?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      affiliate_reservations: {
        Row: {
          country: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          audience: string
          body: string
          channels: string[]
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_name: string
          created_at: string
          id: string
          initials: string
          is_hidden: boolean
          post_id: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string
          created_at?: string
          id?: string
          initials?: string
          is_hidden?: boolean
          post_id: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          initials?: string
          is_hidden?: boolean
          post_id?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "blog_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          body_html: string
          category_id: string | null
          cover_path: string | null
          created_at: string
          excerpt: string
          id: string
          published_at: string | null
          scheduled_at: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body_html?: string
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_html?: string
          category_id?: string | null
          cover_path?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          scheduled_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      bounties: {
        Row: {
          accepted_applicant_id: string | null
          admin_hold: boolean
          applicant_limit: number
          category: string
          cover_path: string | null
          created_at: string
          deadline_at: string | null
          description: string
          dispute_status: string
          end_at: string | null
          fx_snapshot: Json | null
          id: string
          images: string[]
          original_amount: number | null
          original_currency: string | null
          poster_id: string
          price_usd: number
          promoted: boolean
          reject_reason: string | null
          released_at: string | null
          solved_at: string | null
          start_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          accepted_applicant_id?: string | null
          admin_hold?: boolean
          applicant_limit?: number
          category?: string
          cover_path?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          dispute_status?: string
          end_at?: string | null
          fx_snapshot?: Json | null
          id?: string
          images?: string[]
          original_amount?: number | null
          original_currency?: string | null
          poster_id: string
          price_usd: number
          promoted?: boolean
          reject_reason?: string | null
          released_at?: string | null
          solved_at?: string | null
          start_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          accepted_applicant_id?: string | null
          admin_hold?: boolean
          applicant_limit?: number
          category?: string
          cover_path?: string | null
          created_at?: string
          deadline_at?: string | null
          description?: string
          dispute_status?: string
          end_at?: string | null
          fx_snapshot?: Json | null
          id?: string
          images?: string[]
          original_amount?: number | null
          original_currency?: string | null
          poster_id?: string
          price_usd?: number
          promoted?: boolean
          reject_reason?: string | null
          released_at?: string | null
          solved_at?: string | null
          start_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bounty_applications: {
        Row: {
          applicant_id: string
          bounty_id: string
          created_at: string
          id: string
          pitch: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          bounty_id: string
          created_at?: string
          id?: string
          pitch?: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          bounty_id?: string
          created_at?: string
          id?: string
          pitch?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_applications_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      bounty_categories: {
        Row: {
          active: boolean
          created_at: string
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      bounty_submissions: {
        Row: {
          bounty_id: string
          created_at: string
          files: Json
          id: string
          solver_id: string
          submitted_at: string | null
          summary: string
          timeline: string
          updated_at: string
        }
        Insert: {
          bounty_id: string
          created_at?: string
          files?: Json
          id?: string
          solver_id: string
          submitted_at?: string | null
          summary?: string
          timeline?: string
          updated_at?: string
        }
        Update: {
          bounty_id?: string
          created_at?: string
          files?: Json
          id?: string
          solver_id?: string
          submitted_at?: string | null
          summary?: string
          timeline?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_submissions_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_categories: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      circle_join_requests: {
        Row: {
          circle_id: string
          coc_answers: Json | null
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          circle_id: string
          coc_answers?: Json | null
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          circle_id?: string
          coc_answers?: Json | null
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_join_requests_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          coc_accepted_at: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          coc_accepted_at?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          coc_accepted_at?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["circle_status"]
          target_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["circle_status"]
          target_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["circle_status"]
          target_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      circle_resources: {
        Row: {
          added_by: string
          circle_id: string
          created_at: string
          id: string
          kind: string
          pinned: boolean
          title: string
          url: string
        }
        Insert: {
          added_by: string
          circle_id: string
          created_at?: string
          id?: string
          kind?: string
          pinned?: boolean
          title: string
          url: string
        }
        Update: {
          added_by?: string
          circle_id?: string
          created_at?: string
          id?: string
          kind?: string
          pinned?: boolean
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_resources_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          avatar_hue: string
          avatar_url: string | null
          banner_hue: string
          category: string
          code_of_conduct: Json
          cover_url: string | null
          created_at: string
          description: string | null
          emoji: string
          id: string
          is_private: boolean
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_hue?: string
          avatar_url?: string | null
          banner_hue?: string
          category?: string
          code_of_conduct?: Json
          cover_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_private?: boolean
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_hue?: string
          avatar_url?: string | null
          banner_hue?: string
          category?: string
          code_of_conduct?: Json
          cover_url?: string | null
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          is_private?: boolean
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          image_url: string | null
          kind: string
          note: string | null
          ref_id: string | null
          sort_order: number
          title: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          note?: string | null
          ref_id?: string | null
          sort_order?: number
          title?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          note?: string | null
          ref_id?: string | null
          sort_order?: number
          title?: string | null
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          reaction: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          reaction?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_pct: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_pct: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_pct?: number
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          amount_paid_usd: number
          cashback_usd: number | null
          completed_at: string | null
          coupon_code: string | null
          course_id: string
          created_at: string
          discount_usd: number | null
          display_currency: string | null
          display_total: number | null
          id: string
          paid_at: string | null
          payment_method: string | null
          user_id: string
        }
        Insert: {
          amount_paid_usd?: number
          cashback_usd?: number | null
          completed_at?: string | null
          coupon_code?: string | null
          course_id: string
          created_at?: string
          discount_usd?: number | null
          display_currency?: string | null
          display_total?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          user_id: string
        }
        Update: {
          amount_paid_usd?: number
          cashback_usd?: number | null
          completed_at?: string | null
          coupon_code?: string | null
          course_id?: string
          created_at?: string
          discount_usd?: number | null
          display_currency?: string | null
          display_total?: number | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          content_data: Json
          content_type: string
          course_id: string
          created_at: string
          description: string
          duration_min: number
          id: string
          is_preview: boolean
          position: number
          section_position: number
          section_title: string | null
          title: string
          updated_at: string
          video_provider: string
          video_url: string | null
        }
        Insert: {
          content_data?: Json
          content_type?: string
          course_id: string
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          is_preview?: boolean
          position?: number
          section_position?: number
          section_title?: string | null
          title: string
          updated_at?: string
          video_provider?: string
          video_url?: string | null
        }
        Update: {
          content_data?: Json
          content_type?: string
          course_id?: string
          created_at?: string
          description?: string
          duration_min?: number
          id?: string
          is_preview?: boolean
          position?: number
          section_position?: number
          section_title?: string | null
          title?: string
          updated_at?: string
          video_provider?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string
          course_id: string
          id: string
          module_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id: string
          id?: string
          module_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string
          id?: string
          module_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          certificate_template: string | null
          cover_path: string | null
          created_at: string
          description: string
          fx_snapshot: Json | null
          id: string
          instructor_name: string | null
          is_free: boolean
          is_published: boolean
          issue_certificate: boolean
          level: string
          long_description: string | null
          original_amount: number | null
          original_currency: string | null
          owner_id: string
          price_usd: number
          promoted: boolean
          quizzes: Json
          require_linear: boolean
          slug: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          certificate_template?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string
          fx_snapshot?: Json | null
          id?: string
          instructor_name?: string | null
          is_free?: boolean
          is_published?: boolean
          issue_certificate?: boolean
          level?: string
          long_description?: string | null
          original_amount?: number | null
          original_currency?: string | null
          owner_id: string
          price_usd?: number
          promoted?: boolean
          quizzes?: Json
          require_linear?: boolean
          slug: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          certificate_template?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string
          fx_snapshot?: Json | null
          id?: string
          instructor_name?: string | null
          is_free?: boolean
          is_published?: boolean
          issue_certificate?: boolean
          level?: string
          long_description?: string | null
          original_amount?: number | null
          original_currency?: string | null
          owner_id?: string
          price_usd?: number
          promoted?: boolean
          quizzes?: Json
          require_linear?: boolean
          slug?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          media_path: string | null
          media_type: string | null
          order_id: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          media_type?: string | null
          order_id?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          media_type?: string | null
          order_id?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          scope: string
          target_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          scope?: string
          target_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          scope?: string
          target_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      flutterwave_webhook_events: {
        Row: {
          event: string | null
          received_at: string
          reference: string | null
          signature: string
        }
        Insert: {
          event?: string | null
          received_at?: string
          reference?: string | null
          signature: string
        }
        Update: {
          event?: string | null
          received_at?: string
          reference?: string | null
          signature?: string
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          status: string
          target_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          target_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          target_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      manual_payments: {
        Row: {
          amount: number
          amount_usd: number
          created_at: string
          currency: string
          id: string
          meta: Json
          payer_note: string | null
          proof_path: string | null
          provider: string
          purpose: string
          reference: string
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string | null
          target_label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_usd?: number
          created_at?: string
          currency: string
          id?: string
          meta?: Json
          payer_note?: string | null
          proof_path?: string | null
          provider?: string
          purpose: string
          reference: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_usd?: number
          created_at?: string
          currency?: string
          id?: string
          meta?: Json
          payer_note?: string | null
          proof_path?: string | null
          provider?: string
          purpose?: string
          reference?: string
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          kind: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          kind?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          in_app: boolean
          push: boolean
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          in_app?: boolean
          push?: boolean
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          in_app?: boolean
          push?: boolean
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          from_user_id: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          from_user_id?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_disputes: {
        Row: {
          admin_note: string | null
          against_user_id: string | null
          created_at: string
          details: string | null
          id: string
          image_paths: string[]
          opened_by: string
          order_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          against_user_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          image_paths?: string[]
          opened_by: string
          order_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          against_user_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          image_paths?: string[]
          opened_by?: string
          order_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_refund_at: string | null
          auto_release_at: string | null
          buyer_confirmed_at: string | null
          buyer_id: string
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_email: string | null
          delivery_note: string | null
          delivery_whatsapp: string | null
          display_currency: Database["public"]["Enums"]["wallet_currency"]
          display_total: number
          dispute_status: string
          download_token: string
          escrow_status: string
          fx_rate: number
          id: string
          paid_at: string | null
          payment_method: string
          payout_release_at: string | null
          paystack_ref: string | null
          prerelease_notified_at: string | null
          product_category_snapshot: string | null
          product_id: string | null
          product_name_snapshot: string | null
          quantity: number
          refund_reason: string | null
          refunded_at: string | null
          released_at: string | null
          released_by: string | null
          seller_id: string
          seller_share_usd: number
          service_brief: Json | null
          service_package_id: string | null
          service_package_snapshot: Json | null
          status: string
          total_usd: number
          unit_price_usd: number
        }
        Insert: {
          auto_refund_at?: string | null
          auto_release_at?: string | null
          buyer_confirmed_at?: string | null
          buyer_id: string
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_email?: string | null
          delivery_note?: string | null
          delivery_whatsapp?: string | null
          display_currency?: Database["public"]["Enums"]["wallet_currency"]
          display_total: number
          dispute_status?: string
          download_token?: string
          escrow_status?: string
          fx_rate?: number
          id?: string
          paid_at?: string | null
          payment_method: string
          payout_release_at?: string | null
          paystack_ref?: string | null
          prerelease_notified_at?: string | null
          product_category_snapshot?: string | null
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          refund_reason?: string | null
          refunded_at?: string | null
          released_at?: string | null
          released_by?: string | null
          seller_id: string
          seller_share_usd?: number
          service_brief?: Json | null
          service_package_id?: string | null
          service_package_snapshot?: Json | null
          status?: string
          total_usd: number
          unit_price_usd: number
        }
        Update: {
          auto_refund_at?: string | null
          auto_release_at?: string | null
          buyer_confirmed_at?: string | null
          buyer_id?: string
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_email?: string | null
          delivery_note?: string | null
          delivery_whatsapp?: string | null
          display_currency?: Database["public"]["Enums"]["wallet_currency"]
          display_total?: number
          dispute_status?: string
          download_token?: string
          escrow_status?: string
          fx_rate?: number
          id?: string
          paid_at?: string | null
          payment_method?: string
          payout_release_at?: string | null
          paystack_ref?: string | null
          prerelease_notified_at?: string | null
          product_category_snapshot?: string | null
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          refund_reason?: string | null
          refunded_at?: string | null
          released_at?: string | null
          released_by?: string | null
          seller_id?: string
          seller_share_usd?: number
          service_brief?: Json | null
          service_package_id?: string | null
          service_package_snapshot?: Json | null
          status?: string
          total_usd?: number
          unit_price_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_package_id_fkey"
            columns: ["service_package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_settings: {
        Row: {
          flutterwave_enabled: boolean
          id: number
          meta: Json
          minipay_account_name: string | null
          minipay_currencies: string[]
          minipay_enabled: boolean
          minipay_handle: string | null
          minipay_instructions: string | null
          paystack_enabled: boolean
          updated_at: string
        }
        Insert: {
          flutterwave_enabled?: boolean
          id?: number
          meta?: Json
          minipay_account_name?: string | null
          minipay_currencies?: string[]
          minipay_enabled?: boolean
          minipay_handle?: string | null
          minipay_instructions?: string | null
          paystack_enabled?: boolean
          updated_at?: string
        }
        Update: {
          flutterwave_enabled?: boolean
          id?: number
          meta?: Json
          minipay_account_name?: string | null
          minipay_currencies?: string[]
          minipay_enabled?: boolean
          minipay_handle?: string | null
          minipay_instructions?: string | null
          paystack_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payout_recipients: {
        Row: {
          account_name: string
          account_number: string | null
          bank_code: string | null
          bank_name: string | null
          created_at: string
          currency: string
          id: string
          is_default: boolean
          method: string
          momo_network: string | null
          paystack_recipient_code: string
          phone: string | null
          provider: string
          provider_recipient_code: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          account_name: string
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          currency: string
          id?: string
          is_default?: boolean
          method: string
          momo_network?: string | null
          paystack_recipient_code: string
          phone?: string | null
          provider?: string
          provider_recipient_code?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          method?: string
          momo_network?: string | null
          paystack_recipient_code?: string
          phone?: string | null
          provider?: string
          provider_recipient_code?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          destination: Json
          fee_amount: number | null
          id: string
          method: string
          net_amount: number | null
          paystack_recipient_code: string | null
          paystack_transfer_code: string | null
          processed_at: string | null
          processed_by: string | null
          provider: string
          provider_recipient_code: string | null
          provider_transfer_code: string | null
          recipient_id: string | null
          reject_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          currency: string
          destination?: Json
          fee_amount?: number | null
          id?: string
          method: string
          net_amount?: number | null
          paystack_recipient_code?: string | null
          paystack_transfer_code?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider?: string
          provider_recipient_code?: string | null
          provider_transfer_code?: string | null
          recipient_id?: string | null
          reject_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          destination?: Json
          fee_amount?: number | null
          id?: string
          method?: string
          net_amount?: number | null
          paystack_recipient_code?: string | null
          paystack_transfer_code?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider?: string
          provider_recipient_code?: string | null
          provider_transfer_code?: string | null
          recipient_id?: string | null
          reject_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "payout_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_webhook_events: {
        Row: {
          event: string | null
          received_at: string
          reference: string | null
          signature: string
        }
        Insert: {
          event?: string | null
          received_at?: string
          reference?: string | null
          signature: string
        }
        Update: {
          event?: string | null
          received_at?: string
          reference?: string | null
          signature?: string
        }
        Relationships: []
      }
      photo_batch_items: {
        Row: {
          batch_id: string
          created_at: string
          error: string | null
          file_name: string | null
          id: string
          path: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["photo_batch_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          error?: string | null
          file_name?: string | null
          id?: string
          path: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["photo_batch_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          error?: string | null
          file_name?: string | null
          id?: string
          path?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["photo_batch_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "photo_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_batches: {
        Row: {
          created_at: string
          expected_count: number
          id: string
          note: string | null
          status: Database["public"]["Enums"]["photo_batch_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expected_count?: number
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["photo_batch_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expected_count?: number
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["photo_batch_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          base_currency: string
          fx_rates: Json
          fx_updated_at: string | null
          id: number
          live_fx_enabled: boolean
          meta: Json
          updated_at: string
        }
        Insert: {
          base_currency?: string
          fx_rates?: Json
          fx_updated_at?: string | null
          id?: number
          live_fx_enabled?: boolean
          meta?: Json
          updated_at?: string
        }
        Update: {
          base_currency?: string
          fx_rates?: Json
          fx_updated_at?: string | null
          id?: number
          live_fx_enabled?: boolean
          meta?: Json
          updated_at?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          author_name: string
          created_at: string
          id: string
          initials: string
          parent_id: string | null
          post_id: string
          text: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name: string
          created_at?: string
          id?: string
          initials: string
          parent_id?: string | null
          post_id: string
          text: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          created_at?: string
          id?: string
          initials?: string
          parent_id?: string | null
          post_id?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media_tags: {
        Row: {
          created_at: string
          id: string
          media_index: number
          post_id: string
          product_id: string
          x_percent: number | null
          y_percent: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          media_index?: number
          post_id: string
          product_id: string
          x_percent?: number | null
          y_percent?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          media_index?: number
          post_id?: string
          product_id?: string
          x_percent?: number | null
          y_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      post_product_attachments: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_product_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_product_attachments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_kind?: string
        }
        Relationships: []
      }
      post_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          channel: string
          created_at: string
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          audience: string
          author_id: string
          circle_id: string | null
          created_at: string
          id: string
          media_path: string | null
          media_paths: string[]
          media_type: string | null
          mentioned_user_ids: string[]
          repost_of: string | null
          shared_to_feed: boolean
          text: string
          updated_at: string
          views_count: number
          wall_user_id: string | null
        }
        Insert: {
          audience?: string
          author_id: string
          circle_id?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          media_paths?: string[]
          media_type?: string | null
          mentioned_user_ids?: string[]
          repost_of?: string | null
          shared_to_feed?: boolean
          text: string
          updated_at?: string
          views_count?: number
          wall_user_id?: string | null
        }
        Update: {
          audience?: string
          author_id?: string
          circle_id?: string | null
          created_at?: string
          id?: string
          media_path?: string | null
          media_paths?: string[]
          media_type?: string | null
          mentioned_user_ids?: string[]
          repost_of?: string | null
          shared_to_feed?: boolean
          text?: string
          updated_at?: string
          views_count?: number
          wall_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_repost_of_fkey"
            columns: ["repost_of"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_contacts: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          method: string
          note: string | null
          product_id: string
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          method: string
          note?: string | null
          product_id: string
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          product_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_contacts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          product_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products: {
        Row: {
          activation_guide: string | null
          basic_info: string | null
          brand: string | null
          category: string
          condition: string | null
          cover_path: string | null
          created_at: string
          delivery: string | null
          description: string
          external_url: string | null
          file_path: string | null
          fx_snapshot: Json | null
          hue: string
          id: string
          image_paths: string[]
          in_stock: boolean
          kind: string
          location: string | null
          name: string
          negotiable: string | null
          original_amount: number | null
          original_currency: string | null
          price_usd: number
          promoted: boolean
          rating: number
          reject_reason: string | null
          requires_manual_delivery: boolean
          reviews: number
          seller_id: string
          seller_phone: string | null
          slug: string | null
          social_link: string | null
          status: string
          subcategory: string | null
          updated_at: string
          vendor: string
          whatsapp_number: string | null
        }
        Insert: {
          activation_guide?: string | null
          basic_info?: string | null
          brand?: string | null
          category: string
          condition?: string | null
          cover_path?: string | null
          created_at?: string
          delivery?: string | null
          description?: string
          external_url?: string | null
          file_path?: string | null
          fx_snapshot?: Json | null
          hue?: string
          id?: string
          image_paths?: string[]
          in_stock?: boolean
          kind?: string
          location?: string | null
          name: string
          negotiable?: string | null
          original_amount?: number | null
          original_currency?: string | null
          price_usd: number
          promoted?: boolean
          rating?: number
          reject_reason?: string | null
          requires_manual_delivery?: boolean
          reviews?: number
          seller_id: string
          seller_phone?: string | null
          slug?: string | null
          social_link?: string | null
          status?: string
          subcategory?: string | null
          updated_at?: string
          vendor?: string
          whatsapp_number?: string | null
        }
        Update: {
          activation_guide?: string | null
          basic_info?: string | null
          brand?: string | null
          category?: string
          condition?: string | null
          cover_path?: string | null
          created_at?: string
          delivery?: string | null
          description?: string
          external_url?: string | null
          file_path?: string | null
          fx_snapshot?: Json | null
          hue?: string
          id?: string
          image_paths?: string[]
          in_stock?: boolean
          kind?: string
          location?: string | null
          name?: string
          negotiable?: string | null
          original_amount?: number | null
          original_currency?: string | null
          price_usd?: number
          promoted?: boolean
          rating?: number
          reject_reason?: string | null
          requires_manual_delivery?: boolean
          reviews?: number
          seller_id?: string
          seller_phone?: string | null
          slug?: string | null
          social_link?: string | null
          status?: string
          subcategory?: string | null
          updated_at?: string
          vendor?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          address_public: boolean
          avatar_path: string | null
          banned_at: string | null
          bio: string | null
          certifications: Json
          country: string | null
          cover_path: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          deletion_liveness_path: string | null
          deletion_reason: string | null
          display_name: string | null
          dob_public: boolean
          education: Json
          flag_reason: string | null
          flagged: boolean
          has_seen_feature_carousel: boolean
          interests: string[]
          kyc_completed_at: string | null
          kyc_id_path: string | null
          kyc_selfie_path: string | null
          languages: string[]
          last_liveness_verified_at: string | null
          notification_preferences: Json
          phone: string | null
          profile_completed_at: string | null
          reputation_stars: number
          shop_about: string | null
          shop_cover_path: string | null
          shop_logo_path: string | null
          shop_name: string | null
          skill_levels: Json
          skills: string[]
          slug: string
          social_links: Json
          tools: string[]
          updated_at: string
          user_id: string
          username: string | null
          verification_tier: string
        }
        Insert: {
          address?: string | null
          address_public?: boolean
          avatar_path?: string | null
          banned_at?: string | null
          bio?: string | null
          certifications?: Json
          country?: string | null
          cover_path?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          deletion_liveness_path?: string | null
          deletion_reason?: string | null
          display_name?: string | null
          dob_public?: boolean
          education?: Json
          flag_reason?: string | null
          flagged?: boolean
          has_seen_feature_carousel?: boolean
          interests?: string[]
          kyc_completed_at?: string | null
          kyc_id_path?: string | null
          kyc_selfie_path?: string | null
          languages?: string[]
          last_liveness_verified_at?: string | null
          notification_preferences?: Json
          phone?: string | null
          profile_completed_at?: string | null
          reputation_stars?: number
          shop_about?: string | null
          shop_cover_path?: string | null
          shop_logo_path?: string | null
          shop_name?: string | null
          skill_levels?: Json
          skills?: string[]
          slug: string
          social_links?: Json
          tools?: string[]
          updated_at?: string
          user_id: string
          username?: string | null
          verification_tier?: string
        }
        Update: {
          address?: string | null
          address_public?: boolean
          avatar_path?: string | null
          banned_at?: string | null
          bio?: string | null
          certifications?: Json
          country?: string | null
          cover_path?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          deletion_liveness_path?: string | null
          deletion_reason?: string | null
          display_name?: string | null
          dob_public?: boolean
          education?: Json
          flag_reason?: string | null
          flagged?: boolean
          has_seen_feature_carousel?: boolean
          interests?: string[]
          kyc_completed_at?: string | null
          kyc_id_path?: string | null
          kyc_selfie_path?: string | null
          languages?: string[]
          last_liveness_verified_at?: string | null
          notification_preferences?: Json
          phone?: string | null
          profile_completed_at?: string | null
          reputation_stars?: number
          shop_about?: string | null
          shop_cover_path?: string | null
          shop_logo_path?: string | null
          shop_name?: string | null
          skill_levels?: Json
          skills?: string[]
          slug?: string
          social_links?: Json
          tools?: string[]
          updated_at?: string
          user_id?: string
          username?: string | null
          verification_tier?: string
        }
        Relationships: []
      }
      promo_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          promo_id: string
          promo_title: string | null
          session_id: string | null
          surface: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          promo_id: string
          promo_title?: string | null
          session_id?: string | null
          surface?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          promo_id?: string
          promo_title?: string | null
          session_id?: string | null
          surface?: string
          user_id?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      service_packages: {
        Row: {
          created_at: string
          delivery_days: number | null
          features: string[]
          id: string
          name: string
          original_amount: number
          original_currency: string
          price_usd: number
          product_id: string
          revisions: number | null
          sort_order: number
          summary: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_days?: number | null
          features?: string[]
          id?: string
          name: string
          original_amount?: number
          original_currency?: string
          price_usd?: number
          product_id: string
          revisions?: number | null
          sort_order?: number
          summary?: string
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_days?: number | null
          features?: string[]
          id?: string
          name?: string
          original_amount?: number
          original_currency?: string
          price_usd?: number
          product_id?: string
          revisions?: number | null
          sort_order?: number
          summary?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_path: string
          media_type: string
          user_id: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path: string
          media_type?: string
          user_id: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path?: string
          media_type?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      support_feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          rating: number
          topic: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          rating: number
          topic?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          rating?: number
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          details: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          details: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_wallet_transactions: {
        Row: {
          amount_usd: number
          created_at: string
          id: string
          kind: string
          meta: Json
          ref_id: string | null
          source: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          ref_id?: string | null
          source: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          ref_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_wallet_transactions_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "system_wallets"
            referencedColumns: ["kind"]
          },
        ]
      }
      system_wallets: {
        Row: {
          balance_usd: number
          kind: string
          updated_at: string
        }
        Insert: {
          balance_usd?: number
          kind: string
          updated_at?: string
        }
        Update: {
          balance_usd?: number
          kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      tool_categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tools: {
        Row: {
          category_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tools_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tool_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: Database["public"]["Enums"]["wallet_currency"]
          id: string
          inflow: boolean
          occurred_at: string
          paystack_ref: string | null
          status: Database["public"]["Enums"]["wallet_tx_status"]
          tx_hash: string
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: Database["public"]["Enums"]["wallet_currency"]
          id?: string
          inflow: boolean
          occurred_at?: string
          paystack_ref?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          tx_hash: string
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["wallet_currency"]
          id?: string
          inflow?: boolean
          occurred_at?: string
          paystack_ref?: string | null
          status?: Database["public"]["Enums"]["wallet_tx_status"]
          tx_hash?: string
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          accumulated_cashback: number
          available_balance: number
          bounty_balance: number
          created_at: string
          currency: string
          escrow_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accumulated_cashback?: number
          available_balance?: number
          bounty_balance?: number
          created_at?: string
          currency: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accumulated_cashback?: number
          available_balance?: number
          bounty_balance?: number
          created_at?: string
          currency?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_pins: {
        Row: {
          created_at: string
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_campaign: { Args: { _id: string }; Returns: undefined }
      ad_price_per_event: {
        Args: { _kind: string; _tier: string }
        Returns: number
      }
      admin_reset_wallet: {
        Args: { _currency: string; _user_id: string; _which: string }
        Returns: undefined
      }
      assert_recent_liveness: { Args: never; Returns: undefined }
      bounty_auto_release_due: { Args: never; Returns: number }
      bounty_publish_lock: {
        Args: { _amount_usd: number; _bounty_id: string }
        Returns: undefined
      }
      bounty_publish_lock_currency: {
        Args: { _amount: number; _bounty_id: string; _currency: string }
        Returns: undefined
      }
      bounty_refund_escrow: {
        Args: { _bounty_id: string; _reason: string }
        Returns: undefined
      }
      bounty_release_escrow: {
        Args: { _bounty_id: string }
        Returns: undefined
      }
      bounty_wallet_transfer_to_main: {
        Args: { _amount: number }
        Returns: undefined
      }
      cashback_credit: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      cashback_debit: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      current_user_slug: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      end_campaign: { Args: { _id: string }; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_my_campaign: {
        Args: { _id: string }
        Returns: {
          advertiser: string
          advertiser_email: string | null
          advertiser_user_id: string | null
          advertiser_whatsapp: string | null
          body: string
          cities: string[]
          countries: string[]
          created_at: string
          created_by: string | null
          cta_label: string
          cta_lead_email: string | null
          cta_type: string
          cta_url: string
          cta_whatsapp: string | null
          daily_budget_usd: number
          description: string
          end_at: string | null
          escrow_locked: number
          header: string
          id: string
          media_path: string | null
          media_url: string | null
          placements: string[]
          priority: number
          spent_usd: number
          start_at: string | null
          status: string
          tier: string
          title: string
          total_budget_usd: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ad_campaigns"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_product_contact: {
        Args: { _product_id: string }
        Returns: {
          location: string
          seller_phone: string
          whatsapp_number: string
        }[]
      }
      get_product_contact: {
        Args: { _product_id: string }
        Returns: {
          location: string
          seller_phone: string
          whatsapp_number: string
        }[]
      }
      has_any_management_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_post_view: { Args: { _post_id: string }; Returns: undefined }
      is_blocked_by_post_author: {
        Args: { _is_blog?: boolean; _post_id: string }
        Returns: boolean
      }
      is_circle_admin: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      list_serving_ads: {
        Args: {
          _city?: string
          _country?: string
          _limit?: number
          _placement: string
        }
        Returns: {
          body: string
          creatives: Json
          cta_label: string
          cta_type: string
          cta_url: string
          cta_whatsapp: string
          description: string
          header: string
          id: string
          priority: number
          tier: string
        }[]
      }
      log_ad_event: {
        Args: {
          _campaign_id: string
          _city: string
          _country: string
          _kind: string
          _placement: string
          _session: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notif_topic_for_kind: { Args: { _kind: string }; Returns: string }
      oventric_slugify: { Args: { _txt: string }; Returns: string }
      pause_campaign: { Args: { _id: string }; Returns: undefined }
      payout_request_create: {
        Args: {
          _amount: number
          _currency: string
          _destination: Json
          _method: string
        }
        Returns: string
      }
      payout_request_create_live:
        | {
            Args: {
              _amount: number
              _currency: string
              _destination: Json
              _fee: number
              _method: string
              _net: number
              _recipient_code: string
              _recipient_id: string
            }
            Returns: string
          }
        | {
            Args: {
              _amount: number
              _currency: string
              _destination: Json
              _fee: number
              _method: string
              _net: number
              _provider?: string
              _recipient_code: string
              _recipient_id: string
            }
            Returns: string
          }
      payout_request_mark_paid: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      payout_request_reject: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      post_visible_to_me: { Args: { _post_id: string }; Returns: boolean }
      profile_social_counts: {
        Args: { _slug: string }
        Returns: {
          circle_members: number
          followers: number
          following: number
        }[]
      }
      public_circle_directory: {
        Args: never
        Returns: {
          avatar_hue: string
          avatar_url: string
          banner_hue: string
          category: string
          cover_url: string
          created_at: string
          description: string
          emoji: string
          id: string
          member_count: number
          name: string
          post_count: number
          slug: string
        }[]
      }
      purge_expired_stories: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_liveness_attestation: { Args: never; Returns: string }
      submit_ad_lead: {
        Args: {
          _campaign_id: string
          _email: string
          _message: string
          _meta: Json
          _name: string
          _phone: string
        }
        Returns: string
      }
      system_wallet_credit: {
        Args: {
          _amount: number
          _kind: string
          _meta?: Json
          _ref?: string
          _source: string
        }
        Returns: undefined
      }
      wallet_credit: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      wallet_credit_currency: {
        Args: { _amount: number; _currency: string; _user_id: string }
        Returns: undefined
      }
      wallet_debit: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      wallet_debit_currency: {
        Args: { _amount: number; _currency: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "finance"
        | "content"
        | "support"
      blog_status: "draft" | "published" | "scheduled"
      circle_status: "pending" | "accepted"
      photo_batch_status: "queued" | "uploading" | "ready" | "failed"
      report_reason: "spam" | "harassment" | "ip" | "scam"
      report_status: "pending" | "approved" | "hidden"
      wallet_currency:
        | "USD"
        | "NGN"
        | "GHS"
        | "ZAR"
        | "KES"
        | "EGP"
        | "MAD"
        | "DZD"
        | "TND"
        | "LYD"
        | "XOF"
        | "XAF"
        | "ETB"
        | "UGX"
        | "TZS"
        | "RWF"
        | "BIF"
        | "CDF"
        | "AOA"
        | "MZN"
        | "ZMW"
        | "MWK"
        | "BWP"
        | "NAD"
        | "LSL"
        | "SZL"
        | "MUR"
        | "SCR"
        | "CVE"
        | "GMD"
        | "GNF"
        | "LRD"
        | "SLE"
        | "SDG"
        | "SSP"
        | "SOS"
        | "DJF"
        | "ERN"
        | "KMF"
        | "MGA"
        | "MRU"
        | "STN"
        | "ZWG"
      wallet_tx_status: "success" | "pending" | "failed"
      wallet_tx_type:
        | "Marketplace Purchase"
        | "Gig Bounty Escrowed"
        | "Ad Injection Charge"
        | "Affiliate Cashback Payout"
        | "Wallet Top-Up"
        | "Payout Withdrawal"
        | "Marketplace Sale"
        | "Cashback Earned"
        | "Bounty Payout"
        | "Bounty Refund"
        | "Bounty To Main"
        | "Campaign Escrow"
        | "Campaign Refund"
        | "Wallet Transfer Sent"
        | "Wallet Transfer Received"
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
      app_role: ["admin", "moderator", "user", "finance", "content", "support"],
      blog_status: ["draft", "published", "scheduled"],
      circle_status: ["pending", "accepted"],
      photo_batch_status: ["queued", "uploading", "ready", "failed"],
      report_reason: ["spam", "harassment", "ip", "scam"],
      report_status: ["pending", "approved", "hidden"],
      wallet_currency: [
        "USD",
        "NGN",
        "GHS",
        "ZAR",
        "KES",
        "EGP",
        "MAD",
        "DZD",
        "TND",
        "LYD",
        "XOF",
        "XAF",
        "ETB",
        "UGX",
        "TZS",
        "RWF",
        "BIF",
        "CDF",
        "AOA",
        "MZN",
        "ZMW",
        "MWK",
        "BWP",
        "NAD",
        "LSL",
        "SZL",
        "MUR",
        "SCR",
        "CVE",
        "GMD",
        "GNF",
        "LRD",
        "SLE",
        "SDG",
        "SSP",
        "SOS",
        "DJF",
        "ERN",
        "KMF",
        "MGA",
        "MRU",
        "STN",
        "ZWG",
      ],
      wallet_tx_status: ["success", "pending", "failed"],
      wallet_tx_type: [
        "Marketplace Purchase",
        "Gig Bounty Escrowed",
        "Ad Injection Charge",
        "Affiliate Cashback Payout",
        "Wallet Top-Up",
        "Payout Withdrawal",
        "Marketplace Sale",
        "Cashback Earned",
        "Bounty Payout",
        "Bounty Refund",
        "Bounty To Main",
        "Campaign Escrow",
        "Campaign Refund",
        "Wallet Transfer Sent",
        "Wallet Transfer Received",
      ],
    },
  },
} as const
