import React, { useEffect, useState } from 'react';
import Layout from '../Layout.jsx';
import ProfilePin from './profile/ProfilePin.jsx';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const { token, user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);

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
        }
      } catch (e) {
        // ignore
      }
    };
    fetchProfile();
  }, []);

  return (
    <Layout currentPageName="Profile">
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-2xl font-semibold text-white mb-4">Profile Settings</h2>
        <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-900/20">
          <p className="text-sm text-gray-300">Name: {profile ? `${profile.first_name} ${profile.last_name}` : user?.firstName}</p>
          <p className="text-sm text-gray-300">Email: {profile ? profile.email : user?.email}</p>
          <p className="text-sm text-gray-300">Username: {profile ? profile.username : user?.username}</p>
        </div>

        <div className="mt-6">
          <ProfilePin />
        </div>
      </div>
    </Layout>
  );
}
