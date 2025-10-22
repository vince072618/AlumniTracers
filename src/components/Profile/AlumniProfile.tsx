import React, { useState } from 'react';
import { CreditCard as Edit3, Save, X, User, GraduationCap, Briefcase, Building, MapPin, Phone, Mail, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileUpdateData } from '../../types';
import { supabase } from '../../lib/supabase';
import { ActivityLogger } from '../../lib/activityLogger';

const AlumniProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ProfileUpdateData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    graduationYear: user?.graduationYear || new Date().getFullYear(),
    course: user?.course || '',
    currentJob: user?.currentJob || '',
    company: user?.company || '',
    location: user?.location || '',
    phoneNumber: user?.phoneNumber || '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileUpdateData, string>>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const courses = [
     'BSIT',
    'TEP BSEd - English',
    'TEP BSEd - Math',
    'TEP - BEEd',
    'TEP - BECEd',
    'BSBA - Financial Management',
    'BSBA - Marketing Management',
    'BSBA - Operations Management',
  ];

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ProfileUpdateData, string>> = {};

    // Check every field for completion
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.course) newErrors.course = 'Course is required';
    if (!formData.graduationYear) newErrors.graduationYear = 'Graduation year is required';
    if (!formData.currentJob) newErrors.currentJob = 'Current job is required';
    if (!formData.company) newErrors.company = 'Company is required';
    if (!formData.location) newErrors.location = 'Location is required';
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Add this helper function to check if form is complete
  const isFormComplete = (): boolean => {
    return Boolean(
      formData.firstName &&
      formData.lastName &&
      formData.course &&
      formData.graduationYear &&
      formData.currentJob &&
      formData.company &&
      formData.location &&
      formData.phoneNumber
    );
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setSuccessMessage('');
    setErrors({});

    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('Attempting to update profile for user:', user.id);
      console.log('Form data:', formData);

      // Track changes for activity logging
      const changes: Record<string, any> = {};
      if (user.firstName !== formData.firstName) {
        changes.first_name = { old: user.firstName, new: formData.firstName };
      }
      if (user.lastName !== formData.lastName) {
        changes.last_name = { old: user.lastName, new: formData.lastName };
      }
      if (user.course !== formData.course) {
        changes.course = { old: user.course, new: formData.course };
      }
      if (user.graduationYear !== formData.graduationYear) {
        changes.graduation_year = { old: user.graduationYear, new: formData.graduationYear };
      }
      if (user.currentJob !== formData.currentJob) {
        changes.current_job = { old: user.currentJob || '', new: formData.currentJob || '' };
      }
      if (user.company !== formData.company) {
        changes.company = { old: user.company || '', new: formData.company || '' };
      }
      if (user.location !== formData.location) {
        changes.location = { old: user.location || '', new: formData.location || '' };
      }
      if (user.phoneNumber !== formData.phoneNumber) {
        changes.phone_number = { old: user.phoneNumber || '', new: formData.phoneNumber || '' };
      }

      // First check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      console.log('Existing profile check:', { existingProfile, fetchError });

      if (fetchError && fetchError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Creating new profile...');
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            graduation_year: formData.graduationYear,
            course: formData.course,
            current_job: formData.currentJob || null,
            company: formData.company || null,
            location: formData.location || null,
            phone_number: formData.phoneNumber || null,
            role: 'alumni',
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
        console.log('Profile created successfully');
        
        // Log profile creation
        await ActivityLogger.logProfileUpdate({
          action: 'profile_created',
          ...changes
        });
      } else if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
      } else {
        // Profile exists, update it
        console.log('Updating existing profile...');
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          graduation_year: formData.graduationYear,
          course: formData.course,
          current_job: formData.currentJob || null,
          company: formData.company || null,
          location: formData.location || null,
          phone_number: formData.phoneNumber || null,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      console.log('Profile updated successfully');
      
      // Log profile update only if there were changes
      if (Object.keys(changes).length > 0) {
        await ActivityLogger.logProfileUpdate(changes);
      }
      }

      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Refresh user data in context
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      console.error('Profile update error:', error);
      let errorMessage = 'Failed to update profile. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific Supabase errors
        if (error.message.includes('JWT')) {
          errorMessage = 'Session expired. Please refresh the page and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please refresh the page and try again.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      }
      
      setErrors({ firstName: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      graduationYear: user?.graduationYear || new Date().getFullYear(),
      course: user?.course || '',
      currentJob: user?.currentJob || '',
      company: user?.company || '',
      location: user?.location || '',
      phoneNumber: user?.phoneNumber || '',
    });
    setErrors({});
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'graduationYear' ? parseInt(value) : value 
    }));
    if (errors[name as keyof ProfileUpdateData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Alumni Profile</h2>
        <div className="flex items-center space-x-3">
          {successMessage && (
            <span className="text-green-600 text-sm font-medium">{successMessage}</span>
          )}
          {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit3 size={16} className="mr-2" />
                Edit Profile
              </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <X size={16} className="mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || !isFormComplete()}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mr-2" size={16} />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-6 mb-8 pb-6 border-b border-gray-200">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {user?.firstName} {user?.lastName}
              </h3>
              <p className="text-gray-600">{user?.course} • Year Graduated {user?.graduationYear}</p>
              <div className="flex items-center mt-2">
                <Mail size={14} className="text-gray-400 mr-2" />
                <span className="text-sm text-gray-600">{user?.email}</span>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.firstName || !formData.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter first name"
                  />
                  {(!formData.firstName || errors.firstName) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.firstName || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.lastName || !formData.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter last name"
                  />
                  {(!formData.lastName || errors.lastName) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.lastName || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.lastName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course/Program <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    name="course"
                    value={formData.course}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.course || !formData.course ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select your course</option>
                    {courses.map(course => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                  {(!formData.course || errors.course) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.course || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.course || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Year Graduated <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="number"
                    name="graduationYear"
                    value={formData.graduationYear}
                    onChange={handleChange}
                    min="1980"
                    max="2030"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  {(!formData.graduationYear || errors.graduationYear) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.graduationYear || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.graduationYear}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Job <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="currentJob"
                    value={formData.currentJob}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter your current job title"
                  />
                  {(!formData.currentJob || errors.currentJob) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.currentJob || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.currentJob || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter your company name"
                  />
                  {(!formData.company || errors.company) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.company || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.company || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter your current location"
                  />
                  {(!formData.location || errors.location) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.location || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.location || 'Not specified'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter your phone number"
                  />
                  {(!formData.phoneNumber || errors.phoneNumber) && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.phoneNumber || "Required field"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">{user?.phoneNumber || 'Not specified'}</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AlumniProfile;