import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../services/api';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();

    const next = {};
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      toast.success('Account created. Welcome aboard!');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-bold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Start automating your QA workflow.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Full name"
          name="name"
          icon={User}
          placeholder="Nihar Sawant"
          autoComplete="name"
          value={form.name}
          onChange={onChange}
          required
        />
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

        <div className="relative">
          <Input
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            placeholder="At least 8 characters, with a number"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            className="absolute right-3 top-[34px] text-muted hover:text-brand"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        <div className="relative">
          <Input
            label="Confirm password"
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            icon={Lock}
            placeholder="Repeat your password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={onChange}
            error={errors.confirm}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            className={`absolute right-3 text-muted hover:text-brand ${errors.confirm ? 'top-[34px]' : 'top-[34px]'}`}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}