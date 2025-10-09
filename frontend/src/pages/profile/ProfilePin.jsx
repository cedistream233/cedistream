import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePin() {
  const { token } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPin: '', confirmPin: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (form.newPin !== form.confirmPin) {
      setMessage({ type: 'error', text: 'New PINs do not match' });
      return;
    }
    if (!/^\d{4}$/.test(form.newPin)) {
      setMessage({ type: 'error', text: 'PIN must be exactly 4 digits' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPin: form.newPin, confirmPin: form.confirmPin })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'PIN updated' });
        setForm({ currentPassword: '', newPin: '', confirmPin: '' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update PIN' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 p-6 rounded-lg border border-purple-900/20 max-w-md">
      <h3 className="text-lg text-white mb-3">Update PIN</h3>
      {message && (
        <div className={`p-2 mb-3 rounded ${message.type === 'error' ? 'bg-red-700/20 border border-red-600 text-red-200' : 'bg-green-700/10 border border-green-600 text-green-200'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-gray-300">Current Password</Label>
          <div className="relative">
            <Input name="currentPassword" type={showCurrent ? 'text' : 'password'} value={form.currentPassword} onChange={handleChange} required className="bg-slate-800 border-slate-700 text-white pr-10" />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">New PIN</Label>
          <div className="relative">
            <Input name="newPin" type={showNew ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={form.newPin} onChange={(e) => setForm({ ...form, newPin: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} required className="bg-slate-800 border-slate-700 text-white pr-10" />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Confirm New PIN</Label>
          <div className="relative">
            <Input name="confirmPin" type={showConfirm ? 'text' : 'password'} inputMode="numeric" maxLength={4} value={form.confirmPin} onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })} required className={`bg-slate-800 border-slate-700 text-white pr-10 ${form.confirmPin && form.confirmPin !== form.newPin ? 'border-red-500' : ''}`} />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.confirmPin && form.confirmPin !== form.newPin && <p className="text-xs text-red-400">PINs do not match</p>}
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
          {loading ? 'Updating...' : 'Update PIN'}
        </Button>
      </form>
    </div>
  );
}
