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
          created_at?: string;
          updated_at?: string;
        };
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
      };
      communities: {
        Row: {
          id: string;
          name: string;
          city: string;
          geo_boundary: Json | null;
          pricing_tier: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          city: string;
          geo_boundary?: Json | null;
          pricing_tier?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          city?: string;
          geo_boundary?: Json | null;
          pricing_tier?: string;
          status?: string;
          created_at?: string;
        };
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
      };
      riders: {
        Row: {
          id: string;
          vehicle_number: string | null;
          kyc_status: string;
          current_lat: number | null;
          current_lng: number | null;
          rating_avg: number;
          created_at: string;
        };
        Insert: {
          id: string;
          vehicle_number?: string | null;
          kyc_status?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          rating_avg?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_number?: string | null;
          kyc_status?: string;
          current_lat?: number | null;
          current_lng?: number | null;
          rating_avg?: number;
          created_at?: string;
        };
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
      };
      pricing_rules: {
        Row: {
          id: string;
          service_id: string;
          community_id: string | null;
          base_price: number;
          express_multiplier: number;
          effective_from: string;
          effective_to: string | null;
        };
        Insert: {
          id?: string;
          service_id: string;
          community_id?: string | null;
          base_price: number;
          express_multiplier?: number;
          effective_from?: string;
          effective_to?: string | null;
        };
        Update: {
          id?: string;
          service_id?: string;
          community_id?: string | null;
          base_price?: number;
          express_multiplier?: number;
          effective_from?: string;
          effective_to?: string | null;
        };
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
          created_at?: string;
        };
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
          qr_code: string | null;
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
          qr_code?: string | null;
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
          qr_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
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
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_role: {
        Args: Record<string, never>;
        Returns: UserRole;
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
