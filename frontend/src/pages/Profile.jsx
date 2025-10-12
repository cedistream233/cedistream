import React, { useEffect, useRef, useState } from 'react';
import ProfilePin from './profile/ProfilePin.jsx';
import ImagePreviewModal from '@/components/ui/ImagePreviewModal';
import CropperModal from '@/components/ui/CropperModal';
import { useImageViewer } from '@/contexts/ImageViewerContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ProfilePage() {
  const { open: openViewer } = useImageViewer();
  const { token, user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
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

  // Local state for credential change forms
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [emailForm, setEmailForm] = useState({ currentPassword: '', newEmail: '' });
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!pwdForm.currentPassword || !pwdForm.newPassword || !pwdForm.confirmNewPassword) {
      setPwdMsg({ type: 'error', text: 'Please fill all fields' });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmNewPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setPwdLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(pwdForm)
      });
      const data = await res.json();
      if (res.ok) {
        setPwdMsg({ type: 'success', text: data.message || 'Password changed successfully' });
        setPwdForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      } else {
        setPwdMsg({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch {
      setPwdMsg({ type: 'error', text: 'Network error' });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setEmailMsg(null);
    if (!emailForm.currentPassword || !emailForm.newEmail) {
      setEmailMsg({ type: 'error', text: 'Please fill all fields' });
      return;
    }
    if (!/.+@.+\..+/.test(String(emailForm.newEmail))) {
      setEmailMsg({ type: 'error', text: 'Enter a valid email address' });
      return;
    }
    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify(emailForm)
      });
      const data = await res.json();
      if (res.ok) {
        setEmailMsg({ type: 'success', text: data.message || 'Email changed successfully' });
        // refresh profile to reflect new email
        await refreshProfile();
        setEmailForm({ currentPassword: '', newEmail: '' });
      } else {
        setEmailMsg({ type: 'error', text: data.error || 'Failed to change email' });
      }
    } catch {
      setEmailMsg({ type: 'error', text: 'Network error' });
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold text-white mb-4">Profile Settings</h2>
        {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-600 rounded p-2">{error}</div>}
        {success && <div className="mb-4 text-sm text-green-300 bg-green-500/10 border border-green-600 rounded p-2">{success}</div>}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-900/20 flex gap-6 items-center">
          {/* Profile image */}
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-slate-800 border border-slate-700 cursor-pointer" onClick={() => {
              if (profile?.profile_image) openViewer(profile.profile_image);
              else fileInputRef.current?.click();
            }}>
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
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setSelectedFile(f);
                  setShowCropper(true);
                }}
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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 p-6 rounded-lg border border-purple-900/20">
            <h3 className="text-lg text-white mb-3">Change Password</h3>
            {pwdMsg && (
              <div className={`p-2 mb-3 rounded ${pwdMsg.type === 'error' ? 'bg-red-700/20 border border-red-600 text-red-200' : 'bg-green-700/10 border border-green-600 text-green-200'}`}>
                {pwdMsg.text}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Current Password</label>
                <Input type="password" value={pwdForm.currentPassword} onChange={e=>setPwdForm(f=>({...f, currentPassword: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">New Password</label>
                <Input type="password" value={pwdForm.newPassword} onChange={e=>setPwdForm(f=>({...f, newPassword: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Confirm New Password</label>
                <Input type="password" value={pwdForm.confirmNewPassword} onChange={e=>setPwdForm(f=>({...f, confirmNewPassword: e.target.value}))} className={`bg-slate-800 border-slate-700 text-white ${pwdForm.confirmNewPassword && pwdForm.confirmNewPassword !== pwdForm.newPassword ? 'border-red-500' : ''}`} required />
                {pwdForm.confirmNewPassword && pwdForm.confirmNewPassword !== pwdForm.newPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={pwdLoading} className="bg-purple-600 hover:bg-purple-700">{pwdLoading ? 'Updating...' : 'Update Password'}</Button>
              </div>
            </form>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-lg border border-purple-900/20">
            <h3 className="text-lg text-white mb-3">Change Email</h3>
            {emailMsg && (
              <div className={`p-2 mb-3 rounded ${emailMsg.type === 'error' ? 'bg-red-700/20 border border-red-600 text-red-200' : 'bg-green-700/10 border border-green-600 text-green-200'}`}>
                {emailMsg.text}
              </div>
            )}
            <form onSubmit={handleChangeEmail} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Current Password</label>
                <Input type="password" value={emailForm.currentPassword} onChange={e=>setEmailForm(f=>({...f, currentPassword: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">New Email</label>
                <Input type="email" value={emailForm.newEmail} onChange={e=>setEmailForm(f=>({...f, newEmail: e.target.value}))} className="bg-slate-800 border-slate-700 text-white" required />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={emailLoading} className="bg-purple-600 hover:bg-purple-700">{emailLoading ? 'Updating...' : 'Update Email'}</Button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-6">
          <ProfilePin />
        </div>
      
      <ImagePreviewModal
        isOpen={showPreview}
        onClose={() => { setShowPreview(false); setSelectedFile(null); fileInputRef.current && (fileInputRef.current.value = ''); }}
        file={selectedFile}
        onConfirm={async (file) => {
          await onUploadImage(file);
        }}
      />
      
      <CropperModal
        isOpen={showCropper}
        onClose={() => { setShowCropper(false); setSelectedFile(null); fileInputRef.current && (fileInputRef.current.value = ''); }}
        file={selectedFile}
        onConfirm={async (blob) => {
          const fileToUpload = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          await onUploadImage(fileToUpload);
        }}
      />

    </div>
  );
}
