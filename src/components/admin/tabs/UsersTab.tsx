import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser } from "@/lib/admin.functions";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export function UsersTab() {
  const { lang } = useLang();
  const qc = useQueryClient();
  const list = useServerFn(listAdminUsers);
  const create = useServerFn(createAdminUser);
  const update = useServerFn(updateAdminUser);
  const del = useServerFn(deleteAdminUser);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => list({ data: undefined as any }),
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSuper, setIsSuper] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin_users"] });

  const onCreate = async () => {
    if (!username || password.length < 6) return toast.error(lang === "ar" ? "الرجاء إدخال اسم وكلمة مرور (6+ أحرف)" : "Username and 6+ char password required");
    try {
      await create({ data: { username, password, display_name: displayName || username, is_super: isSuper } });
      toast.success(lang === "ar" ? "تم الإنشاء" : "Created");
      setUsername(""); setPassword(""); setDisplayName(""); setIsSuper(false);
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (u: any) => {
    setEditingId(u.id); setEditUsername(u.username); setEditDisplayName(u.display_name ?? ""); setEditPassword("");
  };

  const onSave = async () => {
    if (!editingId) return;
    try {
      await update({ data: { id: editingId, username: editUsername, display_name: editDisplayName, password: editPassword || undefined } });
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      setEditingId(null); invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const onDelete = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف المستخدم؟" : "Delete user?")) return;
    try { await del({ data: { id } }); invalidate(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="card-elegant space-y-3 p-4">
        <h3 className="font-semibold">{t(lang, "create_user")}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>{t(lang, "new_username")}</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label>{t(lang, "display_name")}</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>{t(lang, "new_password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="flex items-end gap-2"><Switch checked={isSuper} onCheckedChange={setIsSuper} /><Label>Super admin</Label></div>
        </div>
        <Button onClick={onCreate} className="gap-1 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground"><Plus className="h-4 w-4" /> {t(lang, "add")}</Button>
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">{t(lang, "loading")}</div> : (
        <div className="space-y-2">
          {data?.users.map((u) => (
            <div key={u.id} className="card-elegant p-4">
              {editingId === u.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div><Label>{t(lang, "admin_username")}</Label><Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} /></div>
                    <div><Label>{t(lang, "display_name")}</Label><Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} /></div>
                    <div><Label>{t(lang, "change_password")}</Label><Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="—" /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={onSave} className="gap-1 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground"><Save className="h-4 w-4" />{t(lang, "save")}</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>{t(lang, "cancel")}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.display_name || u.username}</div>
                    <div className="text-xs text-muted-foreground">@{u.username} · {u.roles.join(", ")}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(u)}>{t(lang, "edit")}</Button>
                    <Button size="sm" variant="outline" onClick={() => onDelete(u.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
