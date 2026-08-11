/**
 * Supabase Database Types
 *
 * These types are auto-generated from your Supabase schema.
 * Run `npm run generate:types` in packages/db to regenerate after schema changes.
 *
 * For now, this is a placeholder that matches the Iron Cloud schema
 * from docs/iron-cloud-database-schema.sql
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | 'customer'
  | 'rider'
  | 'warehouse_staff'
  | 'support_agent'
  | 'community_admin'
  | 'ops_admin'
  | 'super_admin';

export type OrderStatus =
  | 'draft'
  | 'booked'
  | 'pickup_assigned'
  | 'pickup_in_progress'
  | 'picked_up'
  | 'warehouse_received'
  | 'sorting'
  | 'ironing'
  | 'quality_check'
  | 'packed'
  | 'ready_for_delivery'
  | 'delivery_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'rated'
  | 'cancelled'
  | 'refund_initiated'
  | 'refund_completed';

export type JobType = 'pickup' | 'delivery';
export type JobStatus = 'assigned' | 'in_progress' | 'completed' | 'failed' | 'reassigned';
export type WalletTxnType = 'recharge' | 'debit' | 'refund' | 'cashback' | 'expiry';
export type NotificationChannel = 'push' | 'sms' | 'whatsapp' | 'email' | 'in_app';
export type TicketStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
export type SlotType = 'pickup' | 'delivery';
export type PaymentMethod = 'wallet' | 'razorpay_direct';
export type BoxStatus = 'AVAILABLE' | 'OCCUPIED';
export type BoxEventType = 'BOX_ASSIGNED' | 'BOX_RELEASED' | 'WRONG_BOX_SCAN';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          avatar_url: string | null;
          referral_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          referral_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string | null;
          phone?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          referral_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      warehouses: {
        Row: {
          id: string;
          name: string;
          city: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      communities: {
        Row: {
          id: string;
          name: string;
          city: string;
          geo_boundary: Json | null;
          pricing_tier: string;
          status: string;
          blocks_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          geo_boundary?: Json | null;
          pricing_tier?: string;
          status?: string;
          blocks_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          geo_boundary?: Json | null;
          pricing_tier?: string;
          status?: string;
          blocks_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      community_blocks: {
        Row: {
          id: string;
          community_id: string;
          name: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          name: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          name?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      community_flats: {
        Row: {
          id: string;
          block_id: string;
          flat_number: string;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          block_id: string;
          flat_number: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string;
          flat_number?: string;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      community_pickup_slots: {
        Row: {
          id: string;
          community_id: string;
          start_hour: number;
          capacity: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          start_hour: number;
          capacity?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          start_hour?: number;
          capacity?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          customer_id: string;
          community_id: string;
          tower: string | null;
          flat_number: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          community_id: string;
          tower?: string | null;
          flat_number: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          community_id?: string;
          tower?: string | null;
          flat_number?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      service_slots: {
        Row: {
          id: string;
          community_id: string;
          slot_type: SlotType;
          window_start: string;
          window_end: string;
          capacity: number;
          booked_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          community_id: string;
          slot_type: SlotType;
          window_start: string;
          window_end: string;
          capacity?: number;
          booked_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          community_id?: string;
          slot_type?: SlotType;
          window_start?: string;
          window_end?: string;
          capacity?: number;
          booked_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      riders: {
        Row: {
          id: string;
          vehicle_number: string | null;
          kyc_status: string;
          is_active: boolean;
          current_lat: number | null;
          current_lng: number | null;
          rating_avg: number;
          created_at: string;
        };
        Insert: {
          id: string;
          vehicle_number?: string | null;
          kyc_status?: string;
          is_active?: boolean;
          current_lat?: number | null;
          current_lng?: number | null;
          rating_avg?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_number?: string | null;
          kyc_status?: string;
          is_active?: boolean;
          current_lat?: number | null;
          current_lng?: number | null;
          rating_avg?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          category: string;
          name: string;
          unit: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category?: string;
          name: string;
          unit?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          name?: string;
          unit?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
          service_id: string;
          community_id: string | null;
          city: string | null;
          user_id: string | null;
          scope: string;
          base_price: number;
          express_multiplier: number;
          effective_from: string;
          effective_to: string | null;
        };
        Insert: {
          id?: string;
          service_id: string;
          community_id?: string | null;
          city?: string | null;
          user_id?: string | null;
          scope?: string;
          base_price: number;
          express_multiplier?: number;
          effective_from?: string;
          effective_to?: string | null;
        };
        Update: {
          id?: string;
          service_id?: string;
          community_id?: string | null;
          city?: string | null;
          user_id?: string | null;
          scope?: string;
          base_price?: number;
          express_multiplier?: number;
          effective_from?: string;
          effective_to?: string | null;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_type: string;
          discount_value: number;
          max_discount: number | null;
          usage_limit: number | null;
          used_count: number;
          valid_from: string | null;
          valid_to: string | null;
          community_ids: string[] | null;
          applicable_on: string[];
          cities: string[] | null;
          min_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_type: string;
          discount_value: number;
          max_discount?: number | null;
          usage_limit?: number | null;
          used_count?: number;
          valid_from?: string | null;
          valid_to?: string | null;
          community_ids?: string[] | null;
          applicable_on?: string[];
          cities?: string[] | null;
          min_amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          discount_type?: string;
          discount_value?: number;
          max_discount?: number | null;
          usage_limit?: number | null;
          used_count?: number;
          valid_from?: string | null;
          valid_to?: string | null;
          community_ids?: string[] | null;
          applicable_on?: string[];
          cities?: string[] | null;
          min_amount?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          id: string;
          coupon_id: string;
          customer_id: string;
          context: string;
          wallet_transaction_id: string | null;
          topup_amount: number | null;
          bonus_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          customer_id: string;
          context: string;
          wallet_transaction_id?: string | null;
          topup_amount?: number | null;
          bonus_amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          coupon_id?: string;
          customer_id?: string;
          context?: string;
          wallet_transaction_id?: string | null;
          topup_amount?: number | null;
          bonus_amount?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          address_id: string;
          community_id: string;
          warehouse_id: string | null;
          status: OrderStatus;
          pickup_slot_id: string | null;
          delivery_slot_id: string | null;
          is_express: boolean;
          special_instructions: string | null;
          subtotal: number;
          discount: number;
          total_amount: number;
          coupon_id: string | null;
          payment_method: PaymentMethod;
          payment_status: 'unpaid' | 'paid' | 'insufficient_funds';
          qr_code: string | null;
          partner_id: string | null;
          admin_notes: string | null;
          estimated_amount: number | null;
          estimated_garments: Json | null;
          customer_rating: number | null;
          customer_feedback: string | null;
          feedback_dismissed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          customer_id: string;
          address_id: string;
          community_id: string;
          warehouse_id?: string | null;
          status?: OrderStatus;
          pickup_slot_id?: string | null;
          delivery_slot_id?: string | null;
          is_express?: boolean;
          special_instructions?: string | null;
          subtotal?: number;
          discount?: number;
          total_amount?: number;
          coupon_id?: string | null;
          payment_method?: PaymentMethod;
          payment_status?: 'unpaid' | 'paid' | 'insufficient_funds';
          qr_code?: string | null;
          partner_id?: string | null;
          admin_notes?: string | null;
          estimated_amount?: number | null;
          estimated_garments?: Json | null;
          customer_rating?: number | null;
          customer_feedback?: string | null;
          feedback_dismissed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string;
          address_id?: string;
          community_id?: string;
          warehouse_id?: string | null;
          status?: OrderStatus;
          pickup_slot_id?: string | null;
          delivery_slot_id?: string | null;
          is_express?: boolean;
          special_instructions?: string | null;
          subtotal?: number;
          discount?: number;
          total_amount?: number;
          coupon_id?: string | null;
          payment_method?: PaymentMethod;
          payment_status?: 'unpaid' | 'paid' | 'insufficient_funds';
          qr_code?: string | null;
          partner_id?: string | null;
          admin_notes?: string | null;
          estimated_amount?: number | null;
          estimated_garments?: Json | null;
          customer_rating?: number | null;
          customer_feedback?: string | null;
          feedback_dismissed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partners: {
        Row: {
          id: string;
          name: string;
          contact_name: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          kyc_status: string;
          verification_status: string;
          working_hours: Json;
          capacity: number;
          rating_avg: number;
          settlement_cycle: string;
          bank_details: Json;
          documents: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          kyc_status?: string;
          verification_status?: string;
          working_hours?: Json;
          capacity?: number;
          rating_avg?: number;
          settlement_cycle?: string;
          bank_details?: Json;
          documents?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_name?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          kyc_status?: string;
          verification_status?: string;
          working_hours?: Json;
          capacity?: number;
          rating_avg?: number;
          settlement_cycle?: string;
          bank_details?: Json;
          documents?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partner_communities: {
        Row: { partner_id: string; community_id: string };
        Insert: { partner_id: string; community_id: string };
        Update: { partner_id?: string; community_id?: string };
        Relationships: [];
      };
      partner_orders: {
        Row: { partner_id: string; order_id: string; assigned_at: string };
        Insert: { partner_id: string; order_id: string; assigned_at?: string };
        Update: { partner_id?: string; order_id?: string; assigned_at?: string };
        Relationships: [];
      };
      settlements: {
        Row: {
          id: string;
          partner_id: string | null;
          rider_id: string | null;
          period_start: string;
          period_end: string;
          amount: number;
          status: string;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_id?: string | null;
          rider_id?: string | null;
          period_start: string;
          period_end: string;
          amount: number;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string | null;
          rider_id?: string | null;
          period_start?: string;
          period_end?: string;
          amount?: number;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          order_id: string | null;
          invoice_number: string;
          subtotal: number;
          gst_amount: number;
          total: number;
          pdf_url: string | null;
          issued_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          invoice_number: string;
          subtotal: number;
          gst_amount?: number;
          total: number;
          pdf_url?: string | null;
          issued_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          invoice_number?: string;
          subtotal?: number;
          gst_amount?: number;
          total?: number;
          pdf_url?: string | null;
          issued_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          name: string;
          type: string;
          channel: NotificationChannel;
          target: Json;
          payload: Json;
          status: string;
          scheduled_at: string | null;
          schedule: Json | null;
          sent_count: number;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          channel: NotificationChannel;
          target?: Json;
          payload?: Json;
          status?: string;
          scheduled_at?: string | null;
          schedule?: Json | null;
          sent_count?: number;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          channel?: NotificationChannel;
          target?: Json;
          payload?: Json;
          status?: string;
          scheduled_at?: string | null;
          schedule?: Json | null;
          sent_count?: number;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          platform: string | null;
          promotions_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_push_token: string;
          platform?: string | null;
          promotions_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          expo_push_token?: string;
          platform?: string | null;
          promotions_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          id: string;
          title: string;
          image_url: string | null;
          link: string | null;
          community_ids: string[] | null;
          cities: string[] | null;
          user_ids: string[] | null;
          position: string;
          active_from: string | null;
          active_to: string | null;
          is_active: boolean;
          max_impressions: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          image_url?: string | null;
          link?: string | null;
          community_ids?: string[] | null;
          cities?: string[] | null;
          user_ids?: string[] | null;
          position?: string;
          active_from?: string | null;
          active_to?: string | null;
          is_active?: boolean;
          max_impressions?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          image_url?: string | null;
          link?: string | null;
          community_ids?: string[] | null;
          cities?: string[] | null;
          user_ids?: string[] | null;
          position?: string;
          active_from?: string | null;
          active_to?: string | null;
          is_active?: boolean;
          max_impressions?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referee_id: string | null;
          code: string;
          reward_amount: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referee_id?: string | null;
          code: string;
          reward_amount?: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referee_id?: string | null;
          code?: string;
          reward_amount?: number;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      referral_programs: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          referrer_reward_amount: number;
          referee_reward_amount: number;
          min_referee_topup_amount: number;
          valid_from: string | null;
          valid_to: string | null;
          community_ids: string[] | null;
          cities: string[] | null;
          max_referrals_per_referrer: number | null;
          share_message_template: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          referrer_reward_amount?: number;
          referee_reward_amount?: number;
          min_referee_topup_amount?: number;
          valid_from?: string | null;
          valid_to?: string | null;
          community_ids?: string[] | null;
          cities?: string[] | null;
          max_referrals_per_referrer?: number | null;
          share_message_template?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          referrer_reward_amount?: number;
          referee_reward_amount?: number;
          min_referee_topup_amount?: number;
          valid_from?: string | null;
          valid_to?: string | null;
          community_ids?: string[] | null;
          cities?: string[] | null;
          max_referrals_per_referrer?: number | null;
          share_message_template?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_attributions: {
        Row: {
          id: string;
          program_id: string;
          referrer_id: string;
          referee_id: string;
          referral_code: string;
          status: string;
          qualifying_topup_amount: number | null;
          referrer_wallet_txn_id: string | null;
          referee_wallet_txn_id: string | null;
          rewarded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          referrer_id: string;
          referee_id: string;
          referral_code: string;
          status?: string;
          qualifying_topup_amount?: number | null;
          referrer_wallet_txn_id?: string | null;
          referee_wallet_txn_id?: string | null;
          rewarded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          referrer_id?: string;
          referee_id?: string;
          referral_code?: string;
          status?: string;
          qualifying_topup_amount?: number | null;
          referrer_wallet_txn_id?: string | null;
          referee_wallet_txn_id?: string | null;
          rewarded_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          plan_name: string;
          amount: number;
          billing_cycle: string;
          status: string;
          next_billing_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          plan_name: string;
          amount: number;
          billing_cycle?: string;
          status?: string;
          next_billing_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          plan_name?: string;
          amount?: number;
          billing_cycle?: string;
          status?: string;
          next_billing_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          id: string;
          role: UserRole;
          resource: string;
          action: string;
        };
        Insert: {
          id?: string;
          role: UserRole;
          resource: string;
          action: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          resource?: string;
          action?: string;
        };
        Relationships: [];
      };
      admin_notifications: {
        Row: {
          id: string;
          recipient_id: string;
          type: string;
          title: string;
          body: string | null;
          entity_type: string | null;
          entity_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          type: string;
          title: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rider_communities: {
        Row: { rider_id: string; community_id: string };
        Insert: { rider_id: string; community_id: string };
        Update: { rider_id?: string; community_id?: string };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          service_id: string;
          quantity: number;
          unit_price: number;
          before_photo_url: string | null;
          after_photo_url: string | null;
          issue: string | null;
          qc_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          service_id: string;
          quantity?: number;
          unit_price: number;
          before_photo_url?: string | null;
          after_photo_url?: string | null;
          issue?: string | null;
          qc_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          service_id?: string;
          quantity?: number;
          unit_price?: number;
          before_photo_url?: string | null;
          after_photo_url?: string | null;
          issue?: string | null;
          qc_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          status: OrderStatus;
          actor_id: string | null;
          metadata: Json;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: OrderStatus;
          actor_id?: string | null;
          metadata?: Json;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          status?: OrderStatus;
          actor_id?: string | null;
          metadata?: Json;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rider_jobs: {
        Row: {
          id: string;
          order_id: string;
          rider_id: string | null;
          job_type: JobType;
          status: JobStatus;
          scheduled_start: string | null;
          scheduled_end: string | null;
          route_sequence: number | null;
          proof_photo_url: string | null;
          proof_signature_url: string | null;
          failure_reason: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          rider_id?: string | null;
          job_type: JobType;
          status?: JobStatus;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          route_sequence?: number | null;
          proof_photo_url?: string | null;
          proof_signature_url?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          rider_id?: string | null;
          job_type?: JobType;
          status?: JobStatus;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          route_sequence?: number | null;
          proof_photo_url?: string | null;
          proof_signature_url?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          id: string;
          customer_id: string;
          balance: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          balance?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          balance?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          wallet_id: string;
          type: WalletTxnType;
          amount: number;
          balance_after: number;
          order_id: string | null;
          razorpay_payment_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          type: WalletTxnType;
          amount: number;
          balance_after: number;
          order_id?: string | null;
          razorpay_payment_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          type?: WalletTxnType;
          amount?: number;
          balance_after?: number;
          order_id?: string | null;
          razorpay_payment_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          channel: NotificationChannel;
          template_key: string;
          payload: Json;
          status: string;
          provider_message_id: string | null;
          error: string | null;
          created_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          channel: NotificationChannel;
          template_key: string;
          payload?: Json;
          status?: string;
          provider_message_id?: string | null;
          error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          channel?: NotificationChannel;
          template_key?: string;
          payload?: Json;
          status?: string;
          provider_message_id?: string | null;
          error?: string | null;
          created_at?: string;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          customer_id: string;
          order_id: string | null;
          category: string;
          status: TicketStatus;
          assigned_agent_id: string | null;
          sla_due_at: string | null;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          order_id?: string | null;
          category: string;
          status?: TicketStatus;
          assigned_agent_id?: string | null;
          sla_due_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          order_id?: string | null;
          category?: string;
          status?: TicketStatus;
          assigned_agent_id?: string | null;
          sla_due_at?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender_id: string | null;
          message: string;
          attachment_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender_id?: string | null;
          message: string;
          attachment_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          sender_id?: string | null;
          message?: string;
          attachment_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string;
          rider_rating: number | null;
          quality_rating: number | null;
          feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          customer_id: string;
          rider_rating?: number | null;
          quality_rating?: number | null;
          feedback?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          customer_id?: string;
          rider_rating?: number | null;
          quality_rating?: number | null;
          feedback?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_allowed_emails: {
        Row: {
          email: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          email: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: UserRole;
          created_at?: string;
        };
        Relationships: [];
      };
      boxes: {
        Row: {
          id: string;
          box_code: string;
          qr_code: string;
          community_id: string;
          status: BoxStatus;
          current_order_id: string | null;
          is_active: boolean;
          last_used_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          box_code: string;
          qr_code: string;
          community_id: string;
          status?: BoxStatus;
          current_order_id?: string | null;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          box_code?: string;
          qr_code?: string;
          community_id?: string;
          status?: BoxStatus;
          current_order_id?: string | null;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_boxes: {
        Row: {
          id: string;
          order_id: string;
          box_id: string;
          assigned_at: string;
          released_at: string | null;
          assigned_by: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          box_id: string;
          assigned_at?: string;
          released_at?: string | null;
          assigned_by?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          box_id?: string;
          assigned_at?: string;
          released_at?: string | null;
          assigned_by?: string | null;
        };
        Relationships: [];
      };
      box_events: {
        Row: {
          id: string;
          box_id: string | null;
          order_id: string | null;
          rider_id: string | null;
          event_type: BoxEventType;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          box_id?: string | null;
          order_id?: string | null;
          rider_id?: string | null;
          event_type: BoxEventType;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          box_id?: string | null;
          order_id?: string | null;
          rider_id?: string | null;
          event_type?: BoxEventType;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_role: {
        Args: Record<string, never>;
        Returns: UserRole;
      };
      cancel_customer_order: {
        Args: {
          p_order_id: string;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      submit_order_feedback: {
        Args: {
          p_order_id: string;
          p_rating: number;
          p_feedback?: string | null;
        };
        Returns: undefined;
      };
      dismiss_order_feedback: {
        Args: {
          p_order_id: string;
        };
        Returns: undefined;
      };
      normalize_box_code: {
        Args: { p_code: string };
        Returns: string;
      };
      resolve_box_scan: {
        Args: {
          p_box_code: string;
          p_order_id?: string | null;
          p_mode?: string;
        };
        Returns: Json;
      };
      attach_box_to_order: {
        Args: {
          p_order_id: string;
          p_box_code: string;
          p_rider_id: string;
        };
        Returns: Json;
      };
      release_box_from_order: {
        Args: {
          p_order_id: string;
          p_box_code: string;
          p_rider_id: string;
        };
        Returns: Json;
      };
      count_active_order_boxes: {
        Args: { p_order_id: string };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      job_type: JobType;
      job_status: JobStatus;
      wallet_txn_type: WalletTxnType;
      notification_channel: NotificationChannel;
      ticket_status: TicketStatus;
      slot_type: SlotType;
      payment_method: PaymentMethod;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
