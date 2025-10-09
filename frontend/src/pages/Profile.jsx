import React, { useEffect, useRef, useState } from 'react';
import Layout from '../Layout.jsx';
import ProfilePin from './profile/ProfilePin.jsx';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ProfilePage() {
  const { token, user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', bio: '', phone: '', country: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/profile', {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          if (updateUser) updateUser(data);
          setForm({
            firstName: data.first_name || data.firstName || '',
            lastName: data.last_name || data.lastName || '',
            bio: data.bio || '',
            phone: data.phone || '',
            country: data.country || ''
          });
        }
      } catch (e) {
        // ignore
      }
    };
    fetchProfile();
  }, []);

  const refreshProfile = async () => {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        updateUser?.(data);
        setForm({
          firstName: data.first_name || data.firstName || '',
          lastName: data.last_name || data.lastName || '',
          bio: data.bio || '',
          phone: data.phone || '',
          country: data.country || ''
        });
      }
    } catch {}
  };

  const onPickImage = () => fileInputRef.current?.click();

  const onUploadImage = async (file) => {
    if (!file) return;
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/auth/profile/image', {
        method: 'POST',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await refreshProfile();
      setSuccess('Profile image updated');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onRemoveImage = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile/image', {
        method: 'DELETE',
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Remove failed');
      await refreshProfile();
      setSuccess('Profile image removed');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onSubmitDetails = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await refreshProfile();
      setSuccess('Profile details updated');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout currentPageName="Profile">
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Profile Settings</h2>
        {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-600 rounded p-2">{error}</div>}
        {success && <div className="mb-4 text-sm text-green-300 bg-green-500/10 border border-green-600 rounded p-2">{success}</div>}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-900/20 flex gap-6 items-center">
          {/* Profile image */}
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
              {profile?.profile_image ? (
                <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={onPickImage} disabled={saving} className="bg-purple-600 hover:bg-purple-700">{profile?.profile_image ? 'Change' : 'Upload'}</Button>
              {profile?.profile_image && (
                <Button size="sm" variant="outline" onClick={onRemoveImage} disabled={saving} className="border-slate-600 text-white hover:bg-slate-800">Remove</Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUploadImage(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="flex-1">
            <form onSubmit={onSubmitDetails} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">First Name</label>
                  <Input value={form.firstName} onChange={e=>setForm(f=>({...f, firstName: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Last Name</label>
                  <Input value={form.lastName} onChange={e=>setForm(f=>({...f, lastName: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Bio</label>
                <Textarea value={form.bio} onChange={e=>setForm(f=>({...f, bio: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone</label>
                  <Input value={form.phone} onChange={e=>setForm(f=>({...f, phone: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Country</label>
                  <Input value={form.country} onChange={e=>setForm(f=>({...f, country: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700">{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
              <p className="text-xs text-gray-500">Email and username are not editable here.</p>
            </form>
          </div>
        </div>

        <div className="mt-6">
          <ProfilePin />
        </div>
      </div>
    </Layout>
  );
}
