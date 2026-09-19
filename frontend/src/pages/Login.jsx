import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to continue to your dashboard.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          icon={Mail}
          placeholder="you@company.com"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          icon={Lock}
          placeholder="Your password"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
          required
        />
        <Button type="submit" size="lg" loading={loading} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}