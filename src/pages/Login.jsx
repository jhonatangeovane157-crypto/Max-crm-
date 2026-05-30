import { useAuth } from "@/context/useAuth";

export default function Login() {
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    const form = new FormData(e.target);
    const email = form.get("email");
    const password = form.get("password");

    const { error } = await login(email, password);

    if (error) {
      alert(error.message);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-zinc-900 bg-zinc-950 rounded-3xl p-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">
          MAX <span className="text-yellow-500">RCM</span>
        </h1>

        <p className="text-zinc-500 mb-8">CRM Multiatendimento Premium</p>

        <input
          name="email"
          type="email"
          placeholder="Seu email"
          className="w-full p-4 rounded-xl bg-zinc-900 text-white mb-4 outline-none"
        />

        <input
          name="password"
          type="password"
          placeholder="Sua senha"
          className="w-full p-4 rounded-xl bg-zinc-900 text-white mb-6 outline-none"
        />

        <button
          type="submit"
          className="w-full bg-yellow-500 hover:bg-yellow-400 transition text-black font-bold p-4 rounded-xl"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
