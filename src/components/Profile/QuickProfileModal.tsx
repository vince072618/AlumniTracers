import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export type LocationScope = 'Philippines' | 'International' | '';

interface QuickProfileModalProps {
  open: boolean;
  initial: {
    locationScope: LocationScope;
    region: string;
    specificLocation: string;
  };
  required?: boolean;
  onApplied: (values: {
    locationScope: LocationScope;
    region: string;
    specificLocation: string;
  }) => void;
  onCancel: () => void;
}

export const QuickProfileModal: React.FC<QuickProfileModalProps> = ({
  open,
  initial,
  required = false,
  onApplied,
  onCancel,
}) => {
  const { user, refreshUser, setShowQuickProfileModal } = useAuth();

  const [locationScope, setLocationScope] = React.useState<LocationScope>(initial.locationScope ?? '');
  const [region, setRegion] = React.useState<string>(initial.region || '');
  const [specificLocation, setSpecificLocation] = React.useState<string>(initial.specificLocation || '');
  const [skills, setSkills] = React.useState<string>('');
  const [employmentStatus, setEmploymentStatus] = React.useState<'employed' | 'unemployed' | ''>('');

  // New fields
  const [jobRelatedCourse, setJobRelatedCourse] = React.useState<boolean | null>(null);
  const [receivedAward, setReceivedAward] = React.useState<boolean | null>(null);
  const [awardDetails, setAwardDetails] = React.useState<string>('');
  const [employmentType, setEmploymentType] = React.useState<'Private' | 'Government' | ''>('');
  const [contractType, setContractType] = React.useState<string>('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setLocationScope(initial.locationScope ?? '');
    setRegion(initial.region || '');
    setSpecificLocation(initial.specificLocation || '');
    setSkills('');
    setEmploymentStatus('');
    setJobRelatedCourse(null);
    setReceivedAward(null);
    setAwardDetails('');
    setEmploymentType('');
    setContractType('');
    setError(null);
    setTouched({});
  }, [open, initial]);

  const isValid = React.useMemo(() => {
    const hasScope = locationScope === 'Philippines' || locationScope === 'International';
    const hasRegion = hasScope && locationScope === 'Philippines' ? region.trim().length > 0 : true;
    const hasSpecific = specificLocation.trim().length > 0;
    const hasSkills = skills.trim().length > 0;
    const hasEmployment = employmentStatus === 'employed' || employmentStatus === 'unemployed';

    const ifEmployedValid =
      employmentStatus === 'unemployed' ||
      (jobRelatedCourse !== null &&
        receivedAward !== null &&
        employmentType !== '' &&
        (employmentType === 'Private'
          ? ['Regular', 'Contractual'].includes(contractType)
          : ['Regular', 'Job Order', 'Contractual', 'Casual'].includes(contractType)));

    return hasScope && hasRegion && hasSpecific && hasSkills && hasEmployment && ifEmployedValid;
  }, [locationScope, region, specificLocation, skills, employmentStatus, jobRelatedCourse, receivedAward, employmentType, contractType]);

  const submit = async () => {
    setError(null);
    setTouched({
      region: true,
      specificLocation: true,
      skills: true,
      employmentStatus: true,
    });
    if (!isValid) return;

    try {
      setSubmitting(true);
      if (!user?.id) throw new Error('Not authenticated');

      const payload: Record<string, any> = {
        user_id: user.id,
        country: locationScope === 'International' ? specificLocation : 'Philippines',
        region: locationScope === 'Philippines' ? region : locationScope === 'International' ? 'International' : null,
        province: locationScope === 'Philippines' ? specificLocation : null,
        skills,
        employment_status: employmentStatus === 'employed' ? 'Employed' : 'Unemployed',
        job_related_course: jobRelatedCourse,
        received_award: receivedAward,
        award_details: receivedAward ? awardDetails || null : null,
        employment_type: employmentType || null,
        contract_type: contractType || null,
        created_at: new Date().toISOString(),
      };

      // Check existing record
      const { data: existingRow, error: checkErr } = await supabase
        .from('user_profile_questions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (checkErr && (checkErr as any).code !== 'PGRST116') throw checkErr;

      if (existingRow && existingRow.id) {
        const { error: updateErr } = await supabase
          .from('user_profile_questions')
          .update(payload)
          .eq('user_id', user.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('user_profile_questions').insert(payload);
        if (insertErr) throw insertErr;
      }

      // Update profile location
      let combinedLocation = '';
      if (locationScope === 'Philippines') {
        combinedLocation = region ? `${region} - ${specificLocation}` : '';
      } else {
        combinedLocation = `International - ${specificLocation}`;
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ location: combinedLocation || null })
        .eq('id', user.id);
      if (profileErr) console.warn('Failed to update profiles.location:', profileErr);

      try {
        setShowQuickProfileModal && setShowQuickProfileModal(false);
      } catch {}
      if (refreshUser) await refreshUser();

      onApplied({ locationScope, region, specificLocation });
      // Mark questionnaire as completed so it won't pop up again on future logins
      try { if (typeof window !== 'undefined') localStorage.setItem(`gap_completed_${user.id}`, '1'); } catch {}
    } catch (e: any) {
      console.error('Error submitting quick profile answers:', e);
      setError(e?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-md sm:max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Quick Profile Questions</h3>
          {!required && (
            <button onClick={onCancel} aria-label="Cancel" className="text-gray-500 hover:text-gray-700">
              <X />
            </button>
          )}
        </div>

        {/* Scrollable content */}
  <div className="flex-1 min-h-0 px-6 pt-4 pb-2 space-y-4 overflow-y-auto overscroll-contain">
          {/* Country / Region / Specific Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select country <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={locationScope}
                onChange={(e) => setLocationScope(e.target.value as LocationScope)}
                className={`col-span-1 border rounded px-3 py-2 ${!locationScope && touched.scope ? 'border-red-500' : ''}`}
                onBlur={() => setTouched((t) => ({ ...t, scope: true }))}
              >
                <option value="" disabled>
                  Select country
                </option>
                <option value="Philippines">Philippines</option>
                <option value="International">International</option>
              </select>

              {locationScope === 'Philippines' && (
                <div className="col-span-1">
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className={`w-full border rounded px-3 py-2 ${touched.region && !region ? 'border-red-500' : ''}`}
                    onBlur={() => setTouched((t) => ({ ...t, region: true }))}
                  >
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
                  {touched.region && !region && (
                    <p className="mt-1 text-sm text-red-600">Region is required</p>
                  )}
                </div>
              )}

              <div className="col-span-2 md:col-span-1">
                <input
                  value={specificLocation}
                  onChange={(e) => setSpecificLocation(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, specificLocation: true }))}
                  placeholder={locationScope === 'International' ? 'Country / City (e.g. Singapore)' : 'City / Province (e.g. Quezon City)'}
                  className={`w-full border rounded px-3 py-2 ${touched.specificLocation && !specificLocation ? 'border-red-500' : ''}`}
                />
                {touched.specificLocation && !specificLocation && (
                  <p className="mt-1 text-sm text-red-600">Specific location is required</p>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              What skills did you gain from the course you completed? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, skills: true }))}
              rows={3}
              className={`w-full mt-2 border rounded px-3 py-2 ${touched.skills && !skills ? 'border-red-500' : ''}`}
              placeholder="e.g. data analysis, teaching strategies, UI design"
            />
          </div>

          {/* Employment Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Are you currently employed or unemployed? <span className="text-red-500">*</span>
            </label>
            <div className="mt-2 flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input type="radio" name="employment" value="employed" checked={employmentStatus === 'employed'} onChange={() => setEmploymentStatus('employed')} />
                <span className="ml-2">Employed</span>
              </label>
              <label className="inline-flex items-center">
                <input type="radio" name="employment" value="unemployed" checked={employmentStatus === 'unemployed'} onChange={() => setEmploymentStatus('unemployed')} />
                <span className="ml-2">Unemployed</span>
              </label>
            </div>
          </div>

          {/* Conditional questions for employed users */}
          {employmentStatus === 'employed' && (
            <>
              {/* Job Related */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Is your current job related to the course you completed? <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" checked={jobRelatedCourse === true} onChange={() => setJobRelatedCourse(true)} />
                    <span className="ml-2">Yes</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" checked={jobRelatedCourse === false} onChange={() => setJobRelatedCourse(false)} />
                    <span className="ml-2">No</span>
                  </label>
                </div>
              </div>

              {/* Awards */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Have you received any awards in your current job? <span className="text-red-500">*</span>
                </label>
                <div className="mt-2 flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" checked={receivedAward === true} onChange={() => setReceivedAward(true)} />
                    <span className="ml-2">Yes</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" checked={receivedAward === false} onChange={() => setReceivedAward(false)} />
                    <span className="ml-2">No</span>
                  </label>
                </div>
                {receivedAward && (
                  <input
                    type="text"
                    value={awardDetails}
                    onChange={(e) => setAwardDetails(e.target.value)}
                    placeholder="Please specify the award/s"
                    className="mt-2 w-full border rounded px-3 py-2"
                  />
                )}
              </div>

              {/* Employment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Are you a private or government employee? <span className="text-red-500">*</span>
                </label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value as 'Private' | 'Government')}
                  className="mt-2 w-full border rounded px-3 py-2"
                >
                  <option value="">Select</option>
                  <option value="Private">Private</option>
                  <option value="Government">Government</option>
                </select>
              </div>

              {/* Contract Type */}
              {employmentType === 'Private' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    What is your employment status? <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="mt-2 w-full border rounded px-3 py-2"
                  >
                    <option value="">Select</option>
                    <option value="Regular">Regular</option>
                    <option value="Contractual">Contractual</option>
                  </select>
                </div>
              )}

              {employmentType === 'Government' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    What is your employment status? <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value)}
                    className="mt-2 w-full border rounded px-3 py-2"
                  >
                    <option value="">Select</option>
                    <option value="Regular">Regular</option>
                    <option value="Job Order">Job Order</option>
                    <option value="Contractual">Contractual</option>
                    <option value="Casual">Casual</option>
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer buttons - pinned at bottom */}
        <div className="p-6 border-t flex justify-end space-x-3">
          {!required && (
            <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">
              Cancel
            </button>
          )}
          <button
            onClick={submit}
            className="px-4 py-2 bg-blue-600 text-white rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting || !isValid}
          >
            {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
            {submitting ? 'Submitting...' : 'Apply'}
          </button>
        </div>
        {error && <p className="px-6 pb-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>,
    document.body
  );
};

export default QuickProfileModal;
