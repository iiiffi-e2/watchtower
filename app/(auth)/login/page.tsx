import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 420, margin: "80px auto" }}>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to manage your monitors.</p>
        <LoginForm />
        <p className="muted" style={{ marginTop: 16 }}>
          New here? <Link href="/register">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
