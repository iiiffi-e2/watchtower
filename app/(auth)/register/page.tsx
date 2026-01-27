import Link from "next/link";
import RegisterForm from "./register-form";

export default function RegisterPage() {
  return (
    <main className="container">
      <div className="card" style={{ maxWidth: 460, margin: "80px auto" }}>
        <h1>Create your Watchtower account</h1>
        <p className="muted">Start tracking website changes in minutes.</p>
        <RegisterForm />
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
