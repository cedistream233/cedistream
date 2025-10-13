import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Music2, User, Eye, EyeOff } from 'lucide-react';
import { consumePostAuthIntent, addItemToLocalCarts } from '@/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext.jsx';

export default function Signup() {
  const navigate = useNavigate();
  const { login, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: '',
    stageName: '',
    pin: '',
    genreSpecialties: []
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRoleChange = (value) => {
    setFormData({
      ...formData,
      role: value,
      stageName: value === 'supporter' ? '' : formData.stageName
    });
  };

  // Optional: username availability check with debounce
  useEffect(() => {
    const value = formData.username?.trim();
    // reset availability while typing
    setUsernameAvailable(null);
    if (!value) {
      setCheckingUsername(false);
      return;
    }
    // skip very short usernames
    if (value.length < 3) {
      setCheckingUsername(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setCheckingUsername(true);
        const resp = await fetch(`/api/auth/username-available?username=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await resp.json();
        setUsernameAvailable(Boolean(data?.available));
      } catch (_) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400);
    return () => { clearTimeout(t); controller.abort(); };
  }, [formData.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.pin !== formData.confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.role) {
      setError('Please select your role');
      return;
    }

    if (!/^\d{4}$/.test(formData.pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          pin: formData.pin,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          stageName: formData.stageName || null,
          genreSpecialties: formData.genreSpecialties
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        // Update auth context immediately so protected routes allow access
        try { login?.(data.user, data.token); } catch {}

        // If there is a pending post-auth intent (e.g., add-to-cart), perform it then redirect accordingly
        try {
          const intent = consumePostAuthIntent();
          if (intent && intent.action === 'add-to-cart' && intent.item) {
            addItemToLocalCarts(intent.item);
            // ensure user in localStorage reflects added cart for UI
            try {
              const u = JSON.parse(localStorage.getItem('user') || 'null') || {};
              const cart = Array.isArray(u.cart) ? u.cart : [];
              const exists = cart.some(ci => ci.item_id === intent.item.item_id && ci.item_type === intent.item.item_type);
              if (!exists) {
                u.cart = [...cart, intent.item];
                localStorage.setItem('user', JSON.stringify(u));
                try { updateUser?.(u); } catch {}
              }
            } catch {}
            // go to intended destination (default to /cart)
            const next = intent.redirect || '/cart';
            navigate(next, { replace: true });
            return;
          }
        } catch {}

        // Otherwise, redirect based on role
        navigate(data.user.role === 'creator' ? '/dashboard' : '/');
      } else {
        setError(data.error || 'Registration failed');
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
            <CardTitle className="text-2xl text-center text-white">Join CediStream</CardTitle>
            <p className="text-gray-400 text-center">Create your account to get started</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-300">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className={`bg-slate-800 border-slate-700 text-white ${usernameAvailable === false ? 'border-red-500' : ''}`}
                  placeholder="john_doe"
                />
                {formData.username && (
                  <p className="text-xs">
                    {checkingUsername ? (
                      <span className="text-gray-400">Checking availability…</span>
                    ) : usernameAvailable === true ? (
                      <span className="text-green-400">Username is available</span>
                    ) : usernameAvailable === false ? (
                      <span className="text-red-400">Username is taken</span>
                    ) : null}
                  </p>
                )}
              </div>

              <div className="space-y-2 relative">
                <Label className="text-gray-300">I want to join as</Label>
                <div>
                  <div onClick={() => setRoleOpen(!roleOpen)}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue value={formData.role === 'creator' ? 'Creator - Sell your music & videos' : formData.role === 'supporter' ? 'Supporter - Buy and enjoy content' : ''} placeholder="Select your role" />
                    </SelectTrigger>
                  </div>

                  {roleOpen && (
                    <div className="absolute z-50 mt-2 w-full">
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="supporter" onClick={() => { handleRoleChange('supporter'); setRoleOpen(false); }}>
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4" />
                            <span>Supporter - Buy and enjoy content</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="creator" onClick={() => { handleRoleChange('creator'); setRoleOpen(false); }}>
                          <div className="flex items-center space-x-2">
                            <Music2 className="w-4 h-4" />
                            <span>Creator - Sell your music & videos</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </div>
                  )}
                </div>
              </div>

              {formData.role === 'creator' && (
                <div className="space-y-2">
                  <Label htmlFor="stageName" className="text-gray-300">Stage Name (Optional)</Label>
                  <Input
                    id="stageName"
                    name="stageName"
                    type="text"
                    value={formData.stageName}
                    onChange={handleInputChange}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="Your artist name"
                  />
                </div>
              )}

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
                    className={`bg-slate-800 border-slate-700 text-white pr-10 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Min 6 characters"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-300">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`bg-slate-800 border-slate-700 text-white pr-10 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin" className="text-gray-300">4-digit PIN (for password reset)</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    name="pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    value={formData.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                      setFormData({ ...formData, pin: value });
                    }}
                    className={`bg-slate-800 border-slate-700 text-white pr-10 ${formData.pin && formData.pin.length < 4 ? 'border-red-500' : ''}`}
                    placeholder="e.g. 1234"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.pin && !/^\d{4}$/.test(formData.pin) && (
                  <p className="text-xs text-red-400">PIN must be exactly 4 digits</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPin" className="text-gray-300">Confirm PIN</Label>
                <div className="relative">
                  <Input
                    id="confirmPin"
                    name="confirmPin"
                    type={showConfirmPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    value={formData.confirmPin || ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                      setFormData({ ...formData, confirmPin: value });
                    }}
                    className={`bg-slate-800 border-slate-700 text-white pr-10 ${formData.confirmPin && formData.confirmPin !== formData.pin ? 'border-red-500' : ''}`}
                    placeholder="Confirm your PIN"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.confirmPin && formData.confirmPin !== formData.pin && (
                  <p className="text-xs text-red-400">PINs do not match</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-400 hover:text-purple-300">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}