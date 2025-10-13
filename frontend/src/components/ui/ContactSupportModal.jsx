import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export default function ContactSupportModal({ open, onOpenChange }) {
  const { user, token } = useAuth();
  const { toast, toasts, removeToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const defaults = useMemo(() => {
    const nameParts = [
      user?.firstName || user?.first_name || '',
      user?.lastName || user?.last_name || '',
    ].filter(Boolean);
    return {
      name: nameParts.join(' ').trim(),
      email: user?.email || '',
      phone: user?.phone || user?.phone_number || '',
    };
  }, [user]);

  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, ...defaults }));
      setErrors({});
    }
  }, [open, defaults]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Please enter your name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.message.trim() || form.message.trim().length < 10) e.message = 'Please describe your issue (min 10 chars)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!validate()) return;
    try {
      setSubmitting(true);
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          message: form.message.trim(),
          subject: 'User Support Request',
        }),
      }).catch(() => null);

      if (res && res.ok) {
        // show inline success view (no toast)
        setForm({ ...defaults, message: '' });
        setSent(true);
      } else {
        toast.error('Could not send right now. Saved locally, we\'ll retry.');
        // Simple local fallback so user doesn\'t lose message
        const key = 'cedistream_support_drafts';
        const drafts = JSON.parse(localStorage.getItem(key) || '[]');
        drafts.push({ ...form, created_at: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(drafts));
      }
    } catch (err) {
      console.error(err);
      toast.error('Unexpected error sending message');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900/95 border border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription className="text-slate-300">
            Send us a message and we will respond as soon as possible through Email.
          </DialogDescription>
        </DialogHeader>
        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cs-name" className="text-slate-200">Your name</Label>
              <Input id="cs-name" value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} placeholder="John Doe" className="bg-slate-800 border-slate-700 text-white mt-1" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label htmlFor="cs-email" className="text-slate-200">Email</Label>
              <Input id="cs-email" type="email" value={form.email} onChange={(e)=>setForm(f=>({...f,email:e.target.value}))} placeholder="you@example.com" className="bg-slate-800 border-slate-700 text-white mt-1" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="cs-phone" className="text-slate-200">Phone (optional)</Label>
            <Input id="cs-phone" value={form.phone} onChange={(e)=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+233 ..." className="bg-slate-800 border-slate-700 text-white mt-1" />
          </div>

          <div>
            <Label htmlFor="cs-message" className="text-slate-200">Your message</Label>
            <Textarea id="cs-message" rows={5} value={form.message} onChange={(e)=>setForm(f=>({...f,message:e.target.value}))} placeholder="Describe your issue or feedback" className="bg-slate-800 border-slate-700 text-white mt-1" />
            {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message}</p>}
          </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="border-slate-700" onClick={() => onOpenChange?.(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-purple-600 to-pink-600">
                {submitting ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-4 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Message sent</h3>
            <p className="text-sm text-slate-300 mt-2">Thanks — we received your message and will respond as soon as possible.</p>
            <div className="mt-4">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600" onClick={() => { setSent(false); onOpenChange?.(false); }}>Close</Button>
            </div>
          </div>
        )}

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </DialogContent>
    </Dialog>
  );
}
