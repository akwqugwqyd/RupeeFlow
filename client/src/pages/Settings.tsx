import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { Empty, Input, PageTitle, Panel, Select } from "../components/ui";
import { api } from "../lib/api";
import { getCategories } from "../lib/data";
import { money } from "../lib/format";
import { useAuth } from "../state/AuthContext";

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: "", type: "expense", color: "#4f46e5" });
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    monthlyIncomeTarget: user?.monthlyIncomeTarget || 0
  });

  async function load() {
    setCategories(await getCategories());
  }

  useEffect(() => {
    load().catch(() => toast.error("Could not load settings"));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await api.put("/auth/me", profileForm);
    updateUser(data.user);
    toast.success("Profile updated");
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/categories", categoryForm);
    setCategoryForm({ name: "", type: "expense", color: "#4f46e5" });
    toast.success("Category added");
    await load();
  }

  async function remove(id: string) {
    await api.delete(`/categories/${id}`);
    toast.success("Category removed");
    await load();
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <PageTitle title="Settings" subtitle="Manage profile income, user-defined categories, and session controls." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Panel title="Profile">
            <form onSubmit={saveProfile} className="grid gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-[#6b7280]">Name</span>
                <Input required value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-[#6b7280]">Monthly income target</span>
                <Input required type="number" min="0" value={profileForm.monthlyIncomeTarget} onChange={(e) => setProfileForm({ ...profileForm, monthlyIncomeTarget: Number(e.target.value) })} />
              </label>
              <div className="rounded border border-[#e5e7eb] bg-[#ffffff] p-3 text-sm text-[#374151]">
                <p><span className="text-[#6b7280]">Email:</span> {user?.email}</p>
                <p><span className="text-[#6b7280]">Currency:</span> INR</p>
                <p><span className="text-[#6b7280]">Saved income:</span> {money(user?.monthlyIncomeTarget, "INR")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded bg-[#4f46e5] px-4 py-2 font-medium text-white">Save profile</button>
                <button type="button" onClick={logout} className="rounded bg-[#111827] px-4 py-2 text-white">Logout</button>
              </div>
            </form>
          </Panel>

          <Panel title="Add category">
            <form onSubmit={addCategory} className="grid gap-3">
              <Input required placeholder="Category name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
              <Select value={categoryForm.type} onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}>
                <option>expense</option>
                <option>income</option>
                <option>both</option>
              </Select>
              <Input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} />
              <button className="rounded bg-[#4f46e5] px-4 py-2 font-medium text-white">Add category</button>
            </form>
          </Panel>
        </div>

        <Panel title="Categories">
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((category) => (
              <div key={category._id} className="flex items-center justify-between rounded border border-[#e5e7eb] p-3">
                <div className="flex items-center gap-3">
                  <span className="size-4 rounded" style={{ background: category.color }} />
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-[#6b7280]">{category.type}{category.isDefault ? " · default" : ""}</p>
                  </div>
                </div>
                {!category.isDefault && (
                  <button type="button" onClick={() => remove(category._id)} className="grid size-8 place-items-center rounded hover:bg-[#f3e7e7]" title="Delete category">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!categories.length && <Empty text="No categories yet." />}
        </Panel>
      </div>
    </div>
  );
}
