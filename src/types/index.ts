export type UserRole = 'alumni';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  graduationYear: number;
  course: string;
  currentJob?: string;
  company?: string;
  location?: string;
  // whether the user's declared location has been verified
  locationVerified?: boolean;
  phoneNumber?: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  graduationYear: number;
  course: string;
  phoneNumber: string;
}

export interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  graduationYear: number;
  course: string;
  currentJob?: string;
  company?: string;
  // kept for backward compatibility/storage, but UI now uses region + specificLocation
  location?: string;
  region?: string;
  specificLocation?: string;
  // whether the user is in the Philippines or outside (International)
  locationScope?: 'Philippines' | 'International';
  // whether the location has been verified (required to save changes)
  locationVerified?: boolean;
  phoneNumber?: string;
}

export interface PasswordResetData {
  email: string;
}

export interface PasswordUpdateData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Activity Log types
export type ActivityType = 
  | 'login'
  | 'logout'
  | 'profile_update'
  | 'password_change'
  | 'registration'
  | 'email_verification';

export interface ActivityLog {
  id: string;
  userId: string;
  activityType: ActivityType;
  description: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Database types for Supabase
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  graduation_year: number;
  course: string;
  current_job?: string;
  company?: string;
  location?: string;
  location_verified?: boolean;
  // alumni verification status managed by admin
  is_verified?: boolean;
  verified_at?: string | null;
  verified_by?: string | null;
  phone_number?: string;
  created_at: string;
  updated_at?: string;
}