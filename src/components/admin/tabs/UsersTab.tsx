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
import { KeyRound, Plus, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 12);

function PinInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={12}
      autoComplete="new-password"
      dir="ltr"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(onlyDigits(e.target.value))}
      className="text-center tracking-[0.4em]"
    />
  );
}

export function UsersTab() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const list = useServerFn(listAdminUsers);
  const create = useServerFn(createAdminUser);
  const update = useServerFn(updateAdminUser);
  const del = useServerFn(deleteAdminUser);

  const { data, isLoading } = useQuery({ queryKey: ["admin_users"], queryFn: () => list() });

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [isSuper, setIsSuper] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editSuper, setEditSuper] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin_users"] });
  const pinOk = (p: string) => /^\d{6,12}$/.test(p);
  const pinMsg = ar ? "الرقم السري من 6 إلى 12 رقماً" : "PIN must be 6–12 digits";

  const onCreate = async () => {
    if (name.trim().length < 2) return toast.error(ar ? "أدخل اسم المشرف" : "Enter a name");
    if (!pinOk(pin)) return toast.error(pinMsg);
    if (pin !== pin2) return toast.error(ar ? "الرقمان السريان غير متطابقين" : "PINs don't match");
    try {
      await create({ data: { display_name: name.trim(), pin, is_super: isSuper } });
      toast.success(ar ? "تمت إضافة المشرف" : "Supervisor added");
      setName(""); setPin(""); setPin2(""); setIsSuper(false);
      invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (u: { id: string; display_name: string; is_super: boolean }) => {
    setEditingId(u.id); setEditName(u.display_name); setEditPin(""); setEditSuper(u.is_super);
  };

  const onSave = async () => {
    if (!editingId) return;
    if (editPin && !pinOk(editPin)) return toast.error(pinMsg);
    try {
      await update({ data: { id: editingId, display_name: editName, pin: editPin || undefined, is_super: editSuper } });
      toast.success(ar ? "تم الحفظ" : "Saved");
      setEditingId(null); invalidate();
    } catch (e: any) { toast.error(e.message); }
  };

  const onDelete = async (id: string) => {
    if (!confirm(ar ? "حذف هذا المشرف؟" : "Delete this supervisor?")) return;
    try { await del({ data: { id } }); invalidate(); }
    catch (e: any) { toast.error(e.message); }
  };

  const roleLabel = (s: boolean) => (s ? (ar ? "المشرف العام" : "General supervisor") : (ar ? "مشرف" : "Supervisor"));

  return (
    <div className="space-y-6">
      <div className="ios-card space-y-3 p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-muted-foreground" /> {ar ? "إضافة مشرف" : "Add supervisor"}</h3>
        <p className="text-xs text-muted-foreground">
          {ar
            ? "الدخول بالرقم السري فقط. لكل مشرف رقم سري خاص به (6–12 رقماً) ولا يتكرر."
            : "Sign-in is by PIN only. Each supervisor has their own unique PIN (6–12 digits)."}
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>{ar ? "الاسم" : "Name"}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>{ar ? "الرقم السري" : "PIN"}</Label><PinInput value={pin} onChange={setPin} /></div>
          <div><Label>{ar ? "تأكيد الرقم السري" : "Confirm PIN"}</Label><PinInput value={pin2} onChange={setPin2} /></div>
          <div className="flex items-end gap-2 pb-2"><Switch checked={isSuper} onCheckedChange={setIsSuper} /><Label>{roleLabel(true)}</Label></div>
        </div>
        <Button onClick={onCreate} className="gap-1 bg-primary text-primary-foreground rounded-full">
          <Plus className="h-4 w-4" /> {t(lang, "add")}
        </Button>
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">{t(lang, "loading")}</div> : (
        <div className="space-y-2">
          {data?.users.map((u) => (
            <div key={u.id} className="ios-card p-4">
              {editingId === u.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div><Label>{ar ? "الاسم" : "Name"}</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
                    <div><Label>{ar ? "رقم سري جديد" : "New PIN"}</Label><PinInput value={editPin} onChange={setEditPin} placeholder={ar ? "اتركه فارغاً" : "leave empty"} /></div>
                    <div className="flex items-end gap-2 pb-2">
                      <Switch checked={editSuper} onCheckedChange={setEditSuper} disabled={u.id === data.me} />
                      <Label>{roleLabel(true)}</Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={onSave} className="gap-1 bg-primary text-primary-foreground rounded-full"><Save className="h-4 w-4" />{t(lang, "save")}</Button>
                    <Button variant="outline" onClick={() => setEditingId(null)}>{t(lang, "cancel")}</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-full ${u.is_super ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {u.is_super ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                    </span>
                    <div>
                      <div className="font-semibold">
                        {u.display_name} {u.id === data.me && <span className="text-xs text-muted-foreground">({ar ? "أنت" : "you"})</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground"><KeyRound className="h-3 w-3" /> {roleLabel(u.is_super)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(u)}>{t(lang, "edit")}</Button>
                    {u.id !== data.me && (
                      <Button size="sm" variant="outline" onClick={() => onDelete(u.id)} aria-label={ar ? "حذف" : "Delete"}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
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
