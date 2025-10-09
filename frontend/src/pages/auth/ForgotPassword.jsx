import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', pin: '' });
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!/^\d{4}$/.test(form.pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.identifier.trim(), pin: form.pin })
      });
      const data = await res.json();
      if (res.ok && data?.resetToken) {
        setSuccess('PIN verified. Redirecting to reset…');
        // pass token via query param
        setTimeout(() => navigate(`/reset-password?token=${encodeURIComponent(data.resetToken)}`), 600);
      } else if (res.status === 429) {
        setError(data?.error || 'Too many attempts. Try again later.');
      } else {
        setError(data?.error || 'Invalid credentials or PIN');
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
                <KeyRound className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center text-white">Forgot Password</CardTitle>
            <p className="text-gray-400 text-center">Enter your email or username and your 4-digit PIN</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}
              {success && <div className="bg-green-500/20 border border-green-500 text-green-300 px-4 py-2 rounded-lg text-sm">{success}</div>}

              <div className="space-y-2">
                <Label className="text-gray-300">Email or Username</Label>
                <Input type="text" required value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} className="bg-slate-800 border-slate-700 text-white" placeholder="your@email.com or username" />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300">4-digit PIN</Label>
                <div className="relative">
                  <Input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={4}
                    value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                    className="bg-slate-800 border-slate-700 text-white pr-10" placeholder="e.g. 1234" required />
                  <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                {loading ? 'Verifying…' : 'Verify PIN'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
