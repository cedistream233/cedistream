import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) setError('Missing or invalid reset token');
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: token, newPassword: form.password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Password updated. Redirecting to login…');
        setTimeout(() => navigate('/login'), 800);
      } else {
        setError(data?.error || 'Failed to reset password');
      }
    } catch (_) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center text-white">Reset Password</CardTitle>
            <p className="text-gray-400 text-center">Enter your new password</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-2 rounded-lg text-sm">{success}</div>}

              <div className="space-y-2">
                <Label className="text-gray-300">New Password</Label>
                <div className="relative">
                  <Input type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className={`bg-slate-800 border-slate-700 text-white pr-10 ${form.confirm && form.password !== form.confirm ? 'border-red-500' : ''}`} placeholder="Min 6 characters" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">Confirm Password</Label>
                <div className="relative">
                  <Input type={showConfirm ? 'text' : 'password'} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required className={`bg-slate-800 border-slate-700 text-white pr-10 ${form.confirm && form.password !== form.confirm ? 'border-red-500' : ''}`} placeholder="Confirm your password" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                {form.confirm && form.password !== form.confirm && <p className="text-xs text-red-400">Passwords do not match</p>}
              </div>

              <Button type="submit" disabled={loading || !token} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">{loading ? 'Updating…' : 'Update Password'}</Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
