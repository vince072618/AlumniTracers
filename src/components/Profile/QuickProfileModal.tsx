import React from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Props contract
// - open: controls visibility
// - initial: seed values (scope/region/specificLocation)
// - onApplied: called after successful apply (passes selected values)
// - onCancel: called when user cancels (to optionally exit edit mode)

export type LocationScope = 'Philippines' | 'International' | '';

interface QuickProfileModalProps {
  open: boolean;
  initial: {
    locationScope: LocationScope;
    region: string;
    specificLocation: string;
  };
  required?: boolean; // when true, user cannot dismiss without applying
  onApplied: (values: {
    locationScope: LocationScope;
    region: string;
    specificLocation: string;
  }) => void;
  onCancel: () => void;
}

export const QuickProfileModal: React.FC<QuickProfileModalProps> = ({ open, initial, required = false, onApplied, onCancel }) => {
  const { user, refreshUser, setShowQuickProfileModal } = useAuth();

  const [locationScope, setLocationScope] = React.useState<LocationScope>(initial.locationScope ?? '');
  const [region, setRegion] = React.useState<string>(initial.region || '');
  const [specificLocation, setSpecificLocation] = React.useState<string>(initial.specificLocation || '');
  const [skills, setSkills] = React.useState<string>('');
  const [employmentStatus, setEmploymentStatus] = React.useState<'employed' | 'unemployed' | ''>('');

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  // Prevent background scroll while open
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset when opened with new initial values
  React.useEffect(() => {
    if (!open) return;
    setLocationScope(initial.locationScope ?? '');
    setRegion(initial.region || '');
    setSpecificLocation(initial.specificLocation || '');
    setSkills('');
    setEmploymentStatus('');
    setError(null);
    setTouched({});
  }, [open, initial]);

  const isValid = React.useMemo(() => {
    const hasScope = locationScope === 'Philippines' || locationScope === 'International';
    const hasRegion = hasScope && locationScope === 'Philippines' ? region.trim().length > 0 : true;
    const hasSpecific = specificLocation.trim().length > 0;
    const hasSkills = skills.trim().length > 0;
    const hasEmployment = employmentStatus === 'employed' || employmentStatus === 'unemployed';
    return hasScope && hasRegion && hasSpecific && hasSkills && hasEmployment;
  }, [locationScope, region, specificLocation, skills, employmentStatus]);

  const submit = async () => {
    setError(null);
    setTouched({ region: true, specificLocation: true, skills: true, employmentStatus: true });
    if (!isValid) return;

    try {
      setSubmitting(true);
      if (!user?.id) throw new Error('Not authenticated');

      const payload: Record<string, any> = {
        user_id: user.id,
        country: locationScope === 'International' ? specificLocation : 'Philippines',
        region: locationScope === 'Philippines' ? region : (locationScope === 'International' ? 'International' : null),
        province: locationScope === 'Philippines' ? specificLocation : null,
        skills: skills,
        employment_status: employmentStatus === 'employed' ? 'Employed' : 'Unemployed',
        created_at: new Date().toISOString(),
      };

      // Check if existing
      const { data: existingRow, error: checkErr } = await supabase
        .from('user_profile_questions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (checkErr && (checkErr as any).code !== 'PGRST116') throw checkErr;

      if (existingRow && existingRow.id) {
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
        const { error: insertErr } = await supabase
          .from('user_profile_questions')
          .insert(payload);
        if (insertErr) throw insertErr;
      }

      // Update legacy profiles.location
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

      // Refresh and notify
      try { setShowQuickProfileModal && setShowQuickProfileModal(false); } catch {}
      if (refreshUser) await refreshUser();

      onApplied({ locationScope, region, specificLocation });
    } catch (e: any) {
      console.error('Error submitting quick profile answers:', e);
      setError(e?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop without click-to-close to enforce required behavior */}
      <div className="absolute inset-0 bg-black opacity-40" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">Quick Profile Questions</h3>
          {/* Only show cancel when not required */}
          {!required && (
            <button onClick={onCancel} aria-label="Cancel" className="text-gray-500 hover:text-gray-700">
              <X />
            </button>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Select country <span className="text-red-500">*</span></label>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={locationScope} onChange={(e) => setLocationScope(e.target.value as LocationScope)} className={`col-span-1 border rounded px-3 py-2 ${!locationScope && touched.scope ? 'border-red-500' : ''}`} onBlur={() => setTouched((t) => ({ ...t, scope: true }))}>
                <option value="" disabled>Select country</option>
                <option value="Philippines">Philippines</option>
                <option value="International">International</option>
              </select>
              {locationScope === 'Philippines' && (
                <div className="col-span-1">
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={`w-full border rounded px-3 py-2 ${touched.region && !region ? 'border-red-500' : ''}`} onBlur={() => setTouched((t) => ({ ...t, region: true }))}>
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
                <input value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, specificLocation: true }))} placeholder={locationScope === 'International' ? 'Country / City (e.g. Singapore)' : 'City / Province (e.g. Quezon City)'} className={`w-full border rounded px-3 py-2 ${touched.specificLocation && !specificLocation ? 'border-red-500' : ''}`} />
                {touched.specificLocation && !specificLocation && (
                  <p className="mt-1 text-sm text-red-600">Specific location is required</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">What skills did you gain from the course you completed? <span className="text-red-500">*</span></label>
            <textarea value={skills} onChange={(e) => setSkills(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, skills: true }))} rows={3} className={`w-full mt-2 border rounded px-3 py-2 ${touched.skills && !skills ? 'border-red-500' : ''}`} placeholder="e.g. data analysis, teaching strategies, UI design" />
            {touched.skills && !skills && (
              <p className="mt-1 text-sm text-red-600">This field is required</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Are you currently employed or unemployed? <span className="text-red-500">*</span></label>
            <div className="mt-2 flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input type="radio" name="employment" value="employed" checked={employmentStatus === 'employed'} onChange={() => setEmploymentStatus('employed')} className="form-radio" />
                <span className="ml-2">Employed</span>
              </label>
              <label className="inline-flex items-center">
                <input type="radio" name="employment" value="unemployed" checked={employmentStatus === 'unemployed'} onChange={() => setEmploymentStatus('unemployed')} className="form-radio" />
                <span className="ml-2">Unemployed</span>
              </label>
            </div>
            {touched.employmentStatus && !employmentStatus && (
              <p className="mt-1 text-sm text-red-600">Please select one</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          {/* No Skip button to enforce requirement */}
          {!required && (
            <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">
              Cancel
            </button>
          )}
          <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting || !isValid} aria-disabled={submitting || !isValid}>
            {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            {submitting ? 'Submitting...' : 'Apply'}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>,
    document.body
  );
};

export default QuickProfileModal;
