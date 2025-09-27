import { supabase } from './supabase';
import { ActivityType } from '../types';

export class ActivityLogger {
  private static getClientInfo() {
    return {
      userAgent: navigator.userAgent,
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

      const { data, error } = await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_activity_type: activityType,
        p_description: description,
        p_metadata: metadata,
        p_ip_address: clientInfo.ipAddress,
        p_user_agent: clientInfo.userAgent
      });

      if (error) {
        console.error('Failed to log activity:', error);
        // Try direct insert as fallback
        const { error: insertError } = await supabase
          .from('activity_logs')
          .insert({
            user_id: user.id,
            activity_type: activityType,
            description: description,
            metadata: metadata,
            ip_address: clientInfo.ipAddress,
            user_agent: clientInfo.userAgent
          });
        
        if (insertError) {
          console.error('Fallback insert also failed:', insertError);
        }
      } else {
        console.log('Activity logged successfully:', { activityType, description });
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  static async logLogin(): Promise<void> {
    await this.logActivity('login', 'User signed in to the alumni portal');
  }

  static async logLogout(): Promise<void> {
    await this.logActivity('logout', 'User signed out of the alumni portal');
  }

  static async logPasswordChange(): Promise<void> {
    await this.logActivity('password_change', 'User successfully changed their password');
  }

  static async logRegistration(): Promise<void> {
    await this.logActivity('registration', 'New alumni account created and registered');
  }

  static async logEmailVerification(): Promise<void> {
    await this.logActivity('email_verification', 'User verified their email address successfully');
  }

  static async logProfileUpdate(changes: Record<string, any>): Promise<void> {
    const changeCount = Object.keys(changes).length;
    const description = changeCount === 1 
      ? `Profile updated: ${Object.keys(changes)[0]} changed`
      : `Profile updated: ${changeCount} fields changed`;
    
    await this.logActivity('profile_update', description, changes);
  }
}