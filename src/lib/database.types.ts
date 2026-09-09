export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          invite_code: string;
          host_id: string | null;
          room_code: string | null;
          status: 'ACTIVE' | 'ARCHIVED';
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          invite_code: string;
          host_id?: string | null;
          room_code?: string | null;
          status?: 'ACTIVE' | 'ARCHIVED';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rooms']['Insert']>;
        Relationships: [];
      };
      room_members: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          role: 'owner' | 'member';
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          role?: 'owner' | 'member';
          joined_at?: string;
        };
        Update: Partial<Database['public']['Tables']['room_members']['Insert']>;
        Relationships: [];
      };
      room_states: {
        Row: {
          room_code: string;
          current_url: string | null;
          media_type: 'youtube' | 'spotify' | null;
          title: string | null;
          is_playing: boolean;
          timestamp: number;
          playback_rate: number;
          updated_at: string;
        };
        Insert: {
          room_code: string;
          current_url?: string | null;
          media_type?: 'youtube' | 'spotify' | null;
          title?: string | null;
          is_playing?: boolean;
          timestamp?: number;
          playback_rate?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['room_states']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_room_by_invite_code: {
        Args: { code: string };
        Returns: { id: string }[];
      };
      get_my_rooms: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          description: string | null;
          host_id: string;
          room_code: string;
          status: 'ACTIVE' | 'ARCHIVED';
          created_at: string;
          member_count: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Room = Database['public']['Tables']['rooms']['Row'];
export type UserProfile = Database['public']['Tables']['users']['Row'];
