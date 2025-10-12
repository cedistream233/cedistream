import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Music2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { consumePostAuthIntent, addItemToLocalCarts } from '@/utils';

export default function Login() {
  const navigate = useNavigate();
  const { login, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Update auth context immediately
        login(data.user, data.token);

        // Optionally hydrate with full profile to ensure consistent fields
        try {
          const profRes = await fetch('/api/auth/profile', {
            headers: { Authorization: `Bearer ${data.token}` }
          });
          if (profRes.ok) {
            const prof = await profRes.json();
            updateUser?.(prof);
          }
        } catch {}

        // Honor any pending post-auth intent (e.g., add-to-cart)
        try {
          const intent = consumePostAuthIntent();
          if (intent && intent.action === 'add-to-cart' && intent.item) {
            addItemToLocalCarts(intent.item);
            const u = JSON.parse(localStorage.getItem('user') || 'null') || {};
            const cart = Array.isArray(u.cart) ? u.cart : [];
            const exists = cart.some(ci => ci.item_id === intent.item.item_id && ci.item_type === intent.item.item_type);
            if (!exists) {
              u.cart = [...cart, intent.item];
              localStorage.setItem('user', JSON.stringify(u));
            }
            navigate(intent.redirect || '/cart', { replace: true });
            return;
          }
        } catch {}

        // Redirect based on role
        navigate(data.user.role === 'creator' ? '/dashboard' : '/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-black flex flex-col items-center justify-center p-4">
      {/* Simple clickable logo header for auth pages */}
      <div className="w-full max-w-md mb-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-lg">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">CediStream</span>
        </Link>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="bg-slate-900/50 border-purple-900/20 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-xl">
                <Music2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center text-white">Welcome Back</CardTitle>
            <p className="text-gray-400 text-center">Sign in to your CediStream account</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-gray-300">Email or Username</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={formData.identifier}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="your@email.com or username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="bg-slate-800 border-slate-700 text-white pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Link to="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?{' '}
                <Link to="/signup" className="text-purple-400 hover:text-purple-300">
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}