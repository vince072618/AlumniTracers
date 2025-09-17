import { supabase } from './supabase';
import { ActivityType } from '../types';

export class ActivityLogger {
  private static getClientInfo() {
    return {
      userAgent: navigator.userAgent,
      // Note: Getting real IP address requires server-side implementation
      // For now, we'll use a placeholder
      ipAddress: 'client-side'
    };
  }

  static async logActivity(
    activityType: ActivityType,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Cannot log activity: No authenticated user');
        return;
      }

      const clientInfo = this.getClientInfo();

      const { error } = await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: activityType,
        p_description: description,
        p_metadata: metadata,
        p_ip_address: clientInfo.ipAddress,
        p_user_agent: clientInfo.userAgent
      });

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  static async logLogin(): Promise<void> {
    await this.logActivity('login', 'User signed in successfully');
  }

  static async logLogout(): Promise<void> {
    await this.logActivity('logout', 'User signed out');
  }

  static async logPasswordChange(): Promise<void> {
    await this.logActivity('password_change', 'User changed their password');
  }

  static async logRegistration(): Promise<void> {
    await this.logActivity('registration', 'New user account created');
  }

  static async logEmailVerification(): Promise<void> {
    await this.logActivity('email_verification', 'User verified their email address');
  }
}