import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem("saved_email");
    const savedPassword = localStorage.getItem("saved_password");

    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem("saved_email", email);
        localStorage.setItem("saved_password", password);
      } else {
        localStorage.removeItem("saved_email");
        localStorage.removeItem("saved_password");
      }

      await login({ email, password });
      const loggedUser = JSON.parse(localStorage.getItem("user") || "{}");
      navigate(loggedUser.is_master ? "/admin" : "/dashboard");
    } catch {
      setError("Email ou senha inválidos");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-apple-dark">
          Entrar
        </h1>
        <p className="text-sm text-apple-secondary">
          Acesse sua conta para continuar
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-apple-danger/15 bg-apple-danger/10/90 p-3 text-center text-sm text-apple-danger">
          {error}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        leftIcon={<Mail className="h-5 w-5" />}
        required
      />

      <Input
        label="Senha"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        leftIcon={<Lock className="h-5 w-5" />}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="focus:outline-none"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        }
        required
      />

      <div className="flex items-center justify-between">
        <label className="flex items-center text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[#bfd3c1] bg-white focus:ring-2 focus:ring-primary focus:ring-offset-0 transition duration-150 ease-in-out"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ accentColor: "var(--color-primary)" }}
          />
          <span className="ml-2 text-apple-secondary">Lembrar-me</span>
        </label>
        <span className="text-sm text-primary">Acesso seguro</span>
      </div>

      <Button type="submit" className="w-full rounded-xl" isLoading={isLoading}>
        Entrar
      </Button>
    </form>
  );
}
