import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, Phone, Mail, Trash2 } from "lucide-react";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  async function loadCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setCustomers(data || []);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    const { error } = await supabase.from("customers").insert([
      {
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setForm({
      name: "",
      phone: "",
      email: "",
      notes: "",
    });

    setShowForm(false);
    loadCustomers();
  }

  async function deleteCustomer(id) {
    const confirmDelete = confirm("Deseja excluir este cliente?");

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCustomers();
  }

  const filteredCustomers = customers.filter((customer) => {
    const term = search.toLowerCase();

    return (
      customer.name?.toLowerCase().includes(term) ||
      customer.phone?.includes(term) ||
      customer.email?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Clientes
          </h1>

          <p className="text-zinc-400 mt-2">
            Gerencie os contatos da sua operação.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-yellow-500 text-black font-bold px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-yellow-400 transition"
        >
          <Plus size={18} />
          Novo Cliente
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="glass-card-gold rounded-2xl p-6 grid grid-cols-2 gap-4"
        >
          <input
            placeholder="Nome do cliente"
            className="bg-black border border-zinc-800 rounded-xl p-4 outline-none"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            required
          />

          <input
            placeholder="Telefone"
            className="bg-black border border-zinc-800 rounded-xl p-4 outline-none"
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value })
            }
          />

          <input
            placeholder="Email"
            type="email"
            className="bg-black border border-zinc-800 rounded-xl p-4 outline-none"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            placeholder="Observações"
            className="bg-black border border-zinc-800 rounded-xl p-4 outline-none"
            value={form.notes}
            onChange={(e) =>
              setForm({ ...form, notes: e.target.value })
            }
          />

          <button
            type="submit"
            className="col-span-2 bg-yellow-500 text-black font-bold p-4 rounded-xl hover:bg-yellow-400 transition"
          >
            Salvar Cliente
          </button>
        </form>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />

        <input
          placeholder="Buscar cliente..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="glass-card-gold rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-black/40">
            <tr>
              <th className="text-left text-xs text-zinc-500 uppercase p-4">
                Nome
              </th>
              <th className="text-left text-xs text-zinc-500 uppercase p-4">
                Telefone
              </th>
              <th className="text-left text-xs text-zinc-500 uppercase p-4">
                Email
              </th>
              <th className="text-left text-xs text-zinc-500 uppercase p-4">
                Observações
              </th>
              <th className="text-right text-xs text-zinc-500 uppercase p-4">
                Ações
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="text-center text-zinc-500 py-10"
                >
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}

            {filteredCustomers.map((customer) => (
              <tr
                key={customer.id}
                className="border-t border-zinc-900 hover:bg-white/5 transition"
              >
                <td className="p-4 font-semibold">
                  {customer.name}
                </td>

                <td className="p-4 text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Phone size={14} />
                    {customer.phone || "-"}
                  </div>
                </td>

                <td className="p-4 text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Mail size={14} />
                    {customer.email || "-"}
                  </div>
                </td>

                <td className="p-4 text-zinc-400">
                  {customer.notes || "-"}
                </td>

                <td className="p-4 text-right">
                  <button
                    onClick={() => deleteCustomer(customer.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}