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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      addon_groups: {
        Row: {
          id: string
          is_required: boolean
          max_select: number
          min_select: number
          product_id: string
          sort_order: number
          title: string
        }
        Insert: {
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          product_id: string
          sort_order?: number
          title: string
        }
        Update: {
          id?: string
          is_required?: boolean
          max_select?: number
          min_select?: number
          product_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          id: string
          label: string | null
          neighborhood: string
          number: string
          reference: string | null
          state: string
          street: string
          user_id: string
        }
        Insert: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          label?: string | null
          neighborhood: string
          number: string
          reference?: string | null
          state?: string
          street: string
          user_id: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          label?: string | null
          neighborhood?: string
          number?: string
          reference?: string | null
          state?: string
          street?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_logs: {
        Row: {
          action: string
          admin_username: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_username: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_username?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      admin_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      ai_bot_configs: {
        Row: {
          bot_key: string
          created_at: string
          display_name: string
          is_enabled: boolean
          openai_api_key: string | null
          openai_model: string
          system_prompt: string
          updated_at: string
          welcome_message: string
        }
        Insert: {
          bot_key: string
          created_at?: string
          display_name: string
          is_enabled?: boolean
          openai_api_key?: string | null
          openai_model?: string
          system_prompt?: string
          updated_at?: string
          welcome_message?: string
        }
        Update: {
          bot_key?: string
          created_at?: string
          display_name?: string
          is_enabled?: boolean
          openai_api_key?: string | null
          openai_model?: string
          system_prompt?: string
          updated_at?: string
          welcome_message?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          session_id?: string | null
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          customer_name: string
          customer_phone: string
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          customer_name?: string
          customer_phone: string
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience: string
          created_at: string
          id: string
          message: string
          name: string
          scheduled_at: string | null
          sent_count: number
          status: string
          total_recipients: number
        }
        Insert: {
          audience?: string
          created_at?: string
          id?: string
          message?: string
          name: string
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          total_recipients?: number
        }
        Update: {
          audience?: string
          created_at?: string
          id?: string
          message?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          total_recipients?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      chatbot_settings: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          ai_temperature: number | null
          bot_name: string
          fallback_message: string
          faqs: Json
          id: boolean
          is_enabled: boolean
          openai_api_key: string | null
          openai_model: string | null
          system_prompt: string | null
          updated_at: string
          welcome_message: string
          whatsapp: string
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_temperature?: number | null
          bot_name?: string
          fallback_message?: string
          faqs?: Json
          id?: boolean
          is_enabled?: boolean
          openai_api_key?: string | null
          openai_model?: string | null
          system_prompt?: string | null
          updated_at?: string
          welcome_message?: string
          whatsapp?: string
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          ai_temperature?: number | null
          bot_name?: string
          fallback_message?: string
          faqs?: Json
          id?: boolean
          is_enabled?: boolean
          openai_api_key?: string | null
          openai_model?: string | null
          system_prompt?: string | null
          updated_at?: string
          welcome_message?: string
          whatsapp?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_phone: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_phone: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_phone?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      coupon_usages: {
        Row: {
          coupon_id: string
          created_at: string
          customer_phone: string
          discount_applied: number
          id: string
          order_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_phone: string
          discount_applied?: number
          id?: string
          order_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_phone?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          category_ids: string[] | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          max_discount: number | null
          max_uses: number | null
          min_order: number
          product_ids: string[] | null
          total_uses: number
          type: string
          uses_per_customer: number | null
          valid_until: string | null
          value: number
        }
        Insert: {
          category_ids?: string[] | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_discount?: number | null
          max_uses?: number | null
          min_order?: number
          product_ids?: string[] | null
          total_uses?: number
          type?: string
          uses_per_customer?: number | null
          valid_until?: string | null
          value?: number
        }
        Update: {
          category_ids?: string[] | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_discount?: number | null
          max_uses?: number | null
          min_order?: number
          product_ids?: string[] | null
          total_uses?: number
          type?: string
          uses_per_customer?: number | null
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      delivery_drivers: {
        Row: {
          created_at: string
          custom_fields: Json | null
          id: string
          is_active: boolean
          name: string
          nickname: string | null
          notes: string | null
          phone: string
          photo_url: string | null
          plate: string | null
          status: string
          updated_at: string
          vehicle: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          id?: string
          is_active?: boolean
          name: string
          nickname?: string | null
          notes?: string | null
          phone: string
          photo_url?: string | null
          plate?: string | null
          status?: string
          updated_at?: string
          vehicle?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          nickname?: string | null
          notes?: string | null
          phone?: string
          photo_url?: string | null
          plate?: string | null
          status?: string
          updated_at?: string
          vehicle?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      driver_assignments: {
        Row: {
          assigned_at: string
          completed_at: string | null
          driver_id: string
          id: string
          order_id: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          driver_id: string
          id?: string
          order_id: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          driver_id?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gemini_config: {
        Row: {
          ai_instructions: string
          context_window: number
          daily_limit: number
          daily_reset_at: string | null
          daily_tokens_reset_at: string | null
          daily_tokens_used: number
          daily_used: number
          free_tier_only: boolean
          gemini_api_key_encrypted: string | null
          gemini_api_key_masked: string | null
          gemini_api_key_set_at: string | null
          gemini_model: string
          id: boolean
          is_active: boolean
          last_error: string | null
          last_used_at: string | null
          updated_at: string
        }
        Insert: {
          ai_instructions?: string
          context_window?: number
          daily_limit?: number
          daily_reset_at?: string | null
          daily_tokens_reset_at?: string | null
          daily_tokens_used?: number
          daily_used?: number
          free_tier_only?: boolean
          gemini_api_key_encrypted?: string | null
          gemini_api_key_masked?: string | null
          gemini_api_key_set_at?: string | null
          gemini_model?: string
          id?: boolean
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_instructions?: string
          context_window?: number
          daily_limit?: number
          daily_reset_at?: string | null
          daily_tokens_reset_at?: string | null
          daily_tokens_used?: number
          daily_used?: number
          free_tier_only?: boolean
          gemini_api_key_encrypted?: string | null
          gemini_api_key_masked?: string | null
          gemini_api_key_set_at?: string | null
          gemini_model?: string
          id?: boolean
          is_active?: boolean
          last_error?: string | null
          last_used_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ia_unresolved_queries: {
        Row: {
          bot_response: string
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_message: string
        }
        Insert: {
          bot_response: string
          created_at?: string
          customer_name?: string
          customer_phone: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_message: string
        }
        Update: {
          bot_response?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_message?: string
        }
        Relationships: []
      }
      integration_99food_config: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          id: string
          is_active: boolean | null
          store_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          store_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_accounts: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          points_balance: number
          total_earned: number
          total_redeemed: number
        }
        Insert: {
          created_at?: string
          customer_name?: string
          customer_phone: string
          id?: string
          points_balance?: number
          total_earned?: number
          total_redeemed?: number
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          points_balance?: number
          total_earned?: number
          total_redeemed?: number
        }
        Relationships: []
      }
      loyalty_config: {
        Row: {
          id: boolean
          is_active: boolean
          points_per_order: number
          points_per_real: number
          points_to_redeem: number
          reward_description: string
          reward_value: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          is_active?: boolean
          points_per_order?: number
          points_per_real?: number
          points_to_redeem?: number
          reward_description?: string
          reward_value?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          is_active?: boolean
          points_per_order?: number
          points_per_real?: number
          points_to_redeem?: number
          reward_description?: string
          reward_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          account_id: string
          created_at: string
          description: string
          id: string
          order_id: string | null
          points: number
          type: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          points: number
          type: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string | null
          points?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      order_item_addons: {
        Row: {
          addon_id: string | null
          id: string
          name: string
          order_item_id: string
          price: number
          quantity: number
        }
        Insert: {
          addon_id?: string | null
          id?: string
          name: string
          order_item_id: string
          price: number
          quantity?: number
        }
        Update: {
          addon_id?: string | null
          id?: string
          name?: string
          order_item_id?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "product_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_addons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total: number
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          change_for: number | null
          city: string
          complement: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          discount: number
          id: string
          neighborhood: string
          notes: string | null
          number: string
          order_number: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          status: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          change_for?: number | null
          city?: string
          complement?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          discount?: number
          id?: string
          neighborhood: string
          notes?: string | null
          number: string
          order_number?: number
          payment_method: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          street: string
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          change_for?: number | null
          city?: string
          complement?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          discount?: number
          id?: string
          neighborhood?: string
          notes?: string | null
          number?: string
          order_number?: number
          payment_method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          street?: string
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_addons: {
        Row: {
          description: string | null
          group_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          description?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          description?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_addons_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          featured_order: number
          id: string
          is_active: boolean
          is_featured: boolean
          is_sold_out: boolean
          name: string
          pix_code: string | null
          pix_qrcode_url: string | null
          price: number
          price_from: boolean
          quantity_label: string | null
          serves: number | null
          slug: string
          sort_order: number
          weight: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_sold_out?: boolean
          name: string
          pix_code?: string | null
          pix_qrcode_url?: string | null
          price?: number
          price_from?: boolean
          quantity_label?: string | null
          serves?: number | null
          slug: string
          sort_order?: number
          weight?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_sold_out?: boolean
          name?: string
          pix_code?: string | null
          pix_qrcode_url?: string | null
          price?: number
          price_from?: boolean
          quantity_label?: string | null
          serves?: number | null
          slug?: string
          sort_order?: number
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          discount_percent: number | null
          ends_at: string | null
          id: string
          is_active: boolean
          product_id: string
          promo_price: number | null
          starts_at: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          product_id: string
          promo_price?: number | null
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          product_id?: string
          promo_price?: number | null
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          order_id: string | null
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          order_id?: string | null
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          order_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          is_active: boolean
          open_time: string
          shift_label: string | null
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: string
          is_active?: boolean
          open_time: string
          shift_label?: string | null
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          open_time?: string
          shift_label?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          address_line: string
          banner_url: string | null
          delivery_fee: number
          delivery_time_max: number
          delivery_time_min: number
          description: string
          id: boolean
          is_open: boolean
          logo_url: string | null
          opening_hours: string
          pause_reason: string | null
          paused_at: string | null
          phone: string
          pix_code: string | null
          pix_qrcode_url: string | null
          store_name: string
          tagline: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          address_line?: string
          banner_url?: string | null
          delivery_fee?: number
          delivery_time_max?: number
          delivery_time_min?: number
          description?: string
          id?: boolean
          is_open?: boolean
          logo_url?: string | null
          opening_hours?: string
          pause_reason?: string | null
          paused_at?: string | null
          phone?: string
          pix_code?: string | null
          pix_qrcode_url?: string | null
          store_name?: string
          tagline?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          address_line?: string
          banner_url?: string | null
          delivery_fee?: number
          delivery_time_max?: number
          delivery_time_min?: number
          description?: string
          id?: boolean
          is_open?: boolean
          logo_url?: string | null
          opening_hours?: string
          pause_reason?: string | null
          paused_at?: string | null
          phone?: string
          pix_code?: string | null
          pix_qrcode_url?: string | null
          store_name?: string
          tagline?: string
          updated_at?: string
          whatsapp?: string
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
      whatsapp_config: {
        Row: {
          access_token: string | null
          app_secret_hash: string | null
          business_account_id: string | null
          endpoint_url: string | null
          id: boolean
          is_active: boolean
          is_connected: boolean
          last_test_error: string | null
          last_test_status: string | null
          last_tested_at: string | null
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          updated_at: string
          webhook_url: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          app_secret_hash?: string | null
          business_account_id?: string | null
          endpoint_url?: string | null
          id?: boolean
          is_active?: boolean
          is_connected?: boolean
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          updated_at?: string
          webhook_url?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          app_secret_hash?: string | null
          business_account_id?: string | null
          endpoint_url?: string | null
          id?: boolean
          is_active?: boolean
          is_connected?: boolean
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          updated_at?: string
          webhook_url?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          ai_paused: boolean
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_paused?: boolean
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_paused?: boolean
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_events: {
        Row: {
          created_at: string
          error_message: string | null
          from_name: string | null
          from_phone: string
          gemini_model_used: string | null
          gemini_response: string | null
          gemini_tokens_used: number | null
          id: string
          message_body: string | null
          message_type: string
          raw_payload: Json | null
          replied_at: string | null
          status: string
          waba_message_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          from_name?: string | null
          from_phone: string
          gemini_model_used?: string | null
          gemini_response?: string | null
          gemini_tokens_used?: number | null
          id?: string
          message_body?: string | null
          message_type?: string
          raw_payload?: Json | null
          replied_at?: string | null
          status?: string
          waba_message_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          from_name?: string | null
          from_phone?: string
          gemini_model_used?: string | null
          gemini_response?: string | null
          gemini_tokens_used?: number | null
          id?: string
          message_body?: string | null
          message_type?: string
          raw_payload?: Json | null
          replied_at?: string | null
          status?: string
          waba_message_id?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivery_status: string
          direction: string
          id: string
          provider_message_id: string | null
          sender: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          delivery_status?: string
          direction: string
          id?: string
          provider_message_id?: string | null
          sender: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string
          direction?: string
          id?: string
          provider_message_id?: string | null
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_provider_config: {
        Row: {
          api_token: string | null
          endpoint: string | null
          id: boolean
          instance_name: string | null
          is_connected: boolean
          last_tested_at: string | null
          phone_number: string | null
          provider_name: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_token?: string | null
          endpoint?: string | null
          id?: boolean
          instance_name?: string | null
          is_connected?: boolean
          last_tested_at?: string | null
          phone_number?: string | null
          provider_name?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_token?: string | null
          endpoint?: string | null
          id?: boolean
          instance_name?: string | null
          is_connected?: boolean
          last_tested_at?: string | null
          phone_number?: string | null
          provider_name?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cliente"
      order_status:
        | "recebido"
        | "confirmado"
        | "em_preparacao"
        | "pronto"
        | "saiu_entrega"
        | "entregue"
        | "cancelado"
      payment_method: "pix" | "cartao" | "dinheiro"
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
      app_role: ["admin", "cliente"],
      order_status: [
        "recebido",
        "confirmado",
        "em_preparacao",
        "pronto",
        "saiu_entrega",
        "entregue",
        "cancelado",
      ],
      payment_method: ["pix", "cartao", "dinheiro"],
    },
  },
} as const
