import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard as Edit3, Save, X, User, GraduationCap, Briefcase, Building, MapPin, Phone, Mail, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileUpdateData } from '../../types';
import { supabase } from '../../lib/supabase';
import { ActivityLogger } from '../../lib/activityLogger';

const AlumniProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { showQuickProfileModal, setShowQuickProfileModal } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // parse existing location into locationScope + region + specificLocation when possible
  const parseLocation = (loc?: string) => {
    const knownRegions = [
      'Region I','Region 2','Region 3','Region 4A','Region 4B','Region 5','Region 6','Region 7','Region 8','Region 9','Region 10','Region 11','Region 12','NCR','CAR','ARMM'
    ];

    if (!loc) return { locationScope: 'Philippines', region: '', specificLocation: '' };
    const parts = loc.split(' - ').map(p => p.trim()).filter(Boolean);

    // Explicit International format: "International - Country"
    if (parts[0] === 'International') {
      return { locationScope: 'International' as const, region: 'International', specificLocation: parts.slice(1).join(' - ') };
    }

    // If first part matches a known PH region, treat as Philippines
    if (parts.length >= 2 && knownRegions.includes(parts[0])) {
      return { locationScope: 'Philippines' as const, region: parts[0], specificLocation: parts.slice(1).join(' - ') };
    }

    // Fallback: treat as International (user likely stored a free-text country/city)
    return { locationScope: 'International' as const, region: '', specificLocation: loc };
  };

  const existingLocation = parseLocation(user?.location);

  const [formData, setFormData] = useState<ProfileUpdateData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    graduationYear: user?.graduationYear || new Date().getFullYear(),
    course: user?.course || '',
    currentJob: user?.currentJob || '',
    company: user?.company || '',
    // store legacy combined location here as well
    location: user?.location || '',
    // new structured fields for UI
    locationScope: (existingLocation.locationScope as any) || 'Philippines',
    region: existingLocation.region || '',
    specificLocation: existingLocation.specificLocation || '',
    phoneNumber: user?.phoneNumber || '',
  });
  // modal to collect quick profile questions when entering edit mode
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalLocationScope, setModalLocationScope] = useState<any>(existingLocation.locationScope || 'Philippines');
  const [modalRegion, setModalRegion] = useState<string>(existingLocation.region || '');
  const [modalSpecificLocation, setModalSpecificLocation] = useState<string>(existingLocation.specificLocation || '');
  const [modalSkills, setModalSkills] = useState<string>('');
  const [modalEmploymentStatus, setModalEmploymentStatus] = useState<'employed' | 'unemployed'>((user?.currentJob && user.currentJob.length > 0) ? 'employed' : 'unemployed');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleEditClick = () => {
    // open the edit form and show the modal to collect quick info
    setIsEditing(true);
    setShowEditModal(true);
    setModalLocationScope(formData.locationScope || 'Philippines');
    setModalRegion(formData.region || '');
    setModalSpecificLocation(formData.specificLocation || '');
    setModalSkills('');
    setModalEmploymentStatus((formData.currentJob && formData.currentJob.length > 0) ? 'employed' : 'unemployed');
  };

  const handleModalSubmit = async () => {
    setModalError(null);
    setModalSubmitting(true);

    try {
      if (!user?.id) throw new Error('Not authenticated');

      // merge modal answers into the main form data (location fields)
      setFormData(prev => ({
        ...prev,
        locationScope: modalLocationScope,
        region: modalRegion,
        specificLocation: modalSpecificLocation,
      }));

      // build payload for user_profile_questions
      const payload: Record<string, any> = {
        user_id: user.id,
        country: modalLocationScope === 'International' ? modalSpecificLocation : 'Philippines',
        region: modalLocationScope === 'Philippines' ? modalRegion : (modalLocationScope === 'International' ? 'International' : null),
        province: modalLocationScope === 'Philippines' ? modalSpecificLocation : null,
        skills: modalSkills || null,
        employment_status: modalEmploymentStatus === 'employed' ? 'Employed' : 'Unemployed',
        created_at: new Date().toISOString(),
      };

      // Check if a row already exists for this user
      const { data: existingRow, error: checkErr } = await supabase
        .from('user_profile_questions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (checkErr && (checkErr as any).code !== 'PGRST116') {
        // Unexpected error (RLS or network), surface it
        throw checkErr;
      }

      if (existingRow && existingRow.id) {
        // update existing
        const { error: updateErr } = await supabase
          .from('user_profile_questions')
          .update({
            country: payload.country,
            region: payload.region,
            province: payload.province,
            skills: payload.skills,
            employment_status: payload.employment_status,
          })
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;
      } else {
        // insert new row
        const { error: insertErr } = await supabase
          .from('user_profile_questions')
          .insert(payload);

        if (insertErr) throw insertErr;
      }

      // update profiles.location to keep legacy data in sync
      let combinedLocation = '';
      if (modalLocationScope === 'Philippines') {
        combinedLocation = modalRegion ? `${modalRegion} - ${modalSpecificLocation}` : (formData.location || '');
      } else {
        combinedLocation = `International - ${modalSpecificLocation}`;
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ location: combinedLocation || null })
        .eq('id', user.id);

      if (profileErr) {
        // Non-fatal for the modal, but surface to user
        console.warn('Failed to update profiles.location:', profileErr);
      }

      // close modal and prevent it from showing again
      setShowEditModal(false);
      try { setShowQuickProfileModal && setShowQuickProfileModal(false); } catch {}

      // refresh user context so UI shows updated data
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      console.error('Error submitting quick profile answers:', err);
      setModalError(err?.message || JSON.stringify(err));
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleModalSkip = () => {
    // user skipped; just close modal and keep editing
    setShowEditModal(false);
    try { setShowQuickProfileModal && setShowQuickProfileModal(false); } catch {}
  };

  // Prevent background scrolling when modal is open
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (showEditModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev;
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showEditModal]);

  // If AuthContext requested the quick-profile modal (post-login), open it once
  React.useEffect(() => {
    if (showQuickProfileModal) {
      setIsEditing(true);
      setShowEditModal(true);
      // clear the flag so it doesn't show again repeatedly
      setShowQuickProfileModal(false);
      // initialize modal fields from current formData
      setModalLocationScope(formData.locationScope || 'Philippines');
      setModalRegion(formData.region || '');
      setModalSpecificLocation(formData.specificLocation || '');
      setModalSkills('');
      setModalEmploymentStatus((formData.currentJob && formData.currentJob.length > 0) ? 'employed' : 'unemployed');
    }
    // Only run when the flag changes
  }, [showQuickProfileModal]);
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
  // If in Philippines require region; always require specific location
  if (formData.locationScope === 'Philippines' && !formData.region) newErrors.region = 'Region is required';
  if (!formData.specificLocation) newErrors.specificLocation = 'Please specify your city/province or country';
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
      // region only required when in the Philippines
      (formData.locationScope === 'Philippines' ? formData.region : true) &&
      formData.specificLocation &&
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
      // compute combined location string for storage
      let combinedLocation = '';
      if (formData.locationScope === 'Philippines') {
        combinedLocation = formData.region ? `${formData.region} - ${formData.specificLocation}` : (formData.location || '');
      } else {
        // International: store with explicit prefix for clarity
        combinedLocation = `International - ${formData.specificLocation}`;
      }

      if (user.location !== combinedLocation) {
        changes.location = { old: user.location || '', new: combinedLocation || '' };
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
            location: combinedLocation || null,
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
          location: combinedLocation || null,
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
      locationScope: (existingLocation.locationScope as any) || 'Philippines',
      region: existingLocation.region || '',
      specificLocation: existingLocation.specificLocation || '',
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
    // If user switches scope to International clear region
    if (name === 'locationScope' && value === 'International') {
      setFormData(prev => ({ ...prev, region: '' }));
    }
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
                onClick={handleEditClick}
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

  {showEditModal && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black opacity-40" onClick={handleModalSkip} />
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">Quick Profile Questions</h3>
              <button onClick={handleModalSkip} aria-label="Close" className="text-gray-500 hover:text-gray-700">
                <X />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">What is your current location?</label>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select value={modalLocationScope} onChange={(e) => setModalLocationScope(e.target.value)} className="col-span-1 border rounded px-3 py-2">
                    <option value="Philippines">Philippines</option>
                    <option value="International">Outside the country (International)</option>
                  </select>
                  {modalLocationScope === 'Philippines' && (
                    <select value={modalRegion} onChange={(e) => setModalRegion(e.target.value)} className="col-span-1 border rounded px-3 py-2">
                      <option value="">Select region</option>
                      <option value="Region I">Region I</option>
                      <option value="Region 2">Region 2</option>
                      <option value="Region 3">Region 3</option>
                      <option value="Region 4A">Region 4A</option>
                      <option value="Region 4B">Region 4B</option>
                      <option value="Region 5">Region 5</option>
                      <option value="Region 6">Region 6</option>
                      <option value="Region 7">Region 7</option>
                      <option value="Region 8">Region 8</option>
                      <option value="Region 9">Region 9</option>
                      <option value="Region 10">Region 10</option>
                      <option value="Region 11">Region 11</option>
                      <option value="Region 12">Region 12</option>
                      <option value="NCR">NCR</option>
                      <option value="CAR">CAR</option>
                      <option value="ARMM">ARMM</option>
                    </select>
                  )}
                  <input value={modalSpecificLocation} onChange={(e) => setModalSpecificLocation(e.target.value)} placeholder={modalLocationScope === 'International' ? 'Country / City (e.g. Singapore)' : 'City / Province (e.g. Quezon City)'} className="col-span-2 md:col-span-1 border rounded px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">What skills did you gain from the course you completed?</label>
                <textarea value={modalSkills} onChange={(e) => setModalSkills(e.target.value)} rows={3} className="w-full mt-2 border rounded px-3 py-2" placeholder="e.g. data analysis, teaching strategies, UI design" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Are you currently employed or unemployed?</label>
                <div className="mt-2 flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" name="employment" value="employed" checked={modalEmploymentStatus === 'employed'} onChange={() => setModalEmploymentStatus('employed')} className="form-radio" />
                    <span className="ml-2">Employed</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" name="employment" value="unemployed" checked={modalEmploymentStatus === 'unemployed'} onChange={() => setModalEmploymentStatus('unemployed')} className="form-radio" />
                    <span className="ml-2">Unemployed</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={handleModalSkip} className="px-4 py-2 bg-gray-200 rounded" disabled={modalSubmitting}>Skip</button>
              <button onClick={handleModalSubmit} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center" disabled={modalSubmitting} aria-disabled={modalSubmitting}>
                {modalSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {modalSubmitting ? 'Submitting...' : 'Apply'}
              </button>
            </div>
            {modalError && (
              <p className="mt-3 text-sm text-red-600">{modalError}</p>
            )}
          </div>
        </div>,
        document.body
      ) : null}

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
                <>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <select
                      name="locationScope"
                      value={formData.locationScope as any}
                      onChange={handleChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        errors.region ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="Philippines">In the Philippines</option>
                      <option value="International">Outside the country (International)</option>
                    </select>
                  </div>

                  {formData.locationScope === 'Philippines' && (
                    <div className="relative mt-3">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <select
                        name="region"
                        value={formData.region}
                        onChange={handleChange}
                        className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                          errors.region || !formData.region ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select your region</option>
                        <option value="Region I">Region I</option>
                        <option value="Region 2">Region 2</option>
                        <option value="Region 3">Region 3</option>
                        <option value="Region 5">Region 5</option>
                        <option value="Region 6">Region 6</option>
                        <option value="Region 7">Region 7</option>
                        <option value="Region 8">Region 8</option>
                        <option value="Region 9">Region 9</option>
                        <option value="Region 10">Region 10</option>
                        <option value="Region 11">Region 11</option>
                        <option value="Region 12">Region 12</option>
                        <option value="NCR">NCR</option>
                        <option value="CAR">CAR</option>
                        <option value="ARMM">ARMM</option>
                      </select>
                      {(errors.region || !formData.region) && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.region || "Required field"}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Specific location <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="specificLocation"
                      value={formData.specificLocation}
                      onChange={handleChange}
                      className={`w-full pl-3 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        errors.specificLocation || !formData.specificLocation ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={formData.locationScope === 'International' ? 'Country / City (e.g. Singapore)' : 'City / Province (e.g. Quezon City)'}
                    />
                    {(errors.specificLocation || !formData.specificLocation) && (
                      <p className="mt-1 text-sm text-red-600">{errors.specificLocation || 'Required field'}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="py-3 px-4 bg-gray-50 rounded-lg text-gray-900">
                  {formData.locationScope === 'Philippines'
                    ? (formData.region ? `${formData.region} - ${formData.specificLocation || 'Not specified'}` : (user?.location || 'Not specified'))
                    : (user?.location || formData.specificLocation || 'Not specified')}
                </p>
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