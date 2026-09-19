import { useState } from 'react';
import { Lock, Mail, User } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';
import { getErrorMessage } from '../services/api';
import { formatRole } from '../utils/formatters';

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      setUser(await authService.updateProfile({ name }));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <Badge>{formatRole(user.role)}</Badge>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          name="name"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input label="Email" name="email" icon={Mail} value={user.email} disabled />
        <Button type="submit" loading={saving} disabled={name.trim() === user.name}>
          Save changes
        </Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError('Passwords do not match');
    setError('');
    setSaving(true);
    try {
      await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Current password"
          name="currentPassword"
          type="password"
          icon={Lock}
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={onChange}
          required
        />
        <Input
          label="New password"
          name="newPassword"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          value={form.newPassword}
          onChange={onChange}
          required
        />
        <Input
          label="Confirm new password"
          name="confirm"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          value={form.confirm}
          onChange={onChange}
          error={error}
          required
        />
        <Button type="submit" loading={saving}>
          Update password
        </Button>
      </form>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted">Manage your profile and security.</p>
      </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}