import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";
import { BookingsTab } from "./tabs/BookingsTab";
import { PackagesTab } from "./tabs/PackagesTab";
import { GalleryTab } from "./tabs/GalleryTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { UsersTab } from "./tabs/UsersTab";

export function AdminDashboard() {
  const { lang } = useLang();
  const [tab, setTab] = useState("bookings");
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold gold-text">{t(lang, "admin_dashboard")}</h1>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()} className="gap-2">
          <LogOut className="h-4 w-4" /> {t(lang, "sign_out")}
        </Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="bookings">{t(lang, "tab_bookings")}</TabsTrigger>
          <TabsTrigger value="packages">{t(lang, "tab_packages")}</TabsTrigger>
          <TabsTrigger value="gallery">{t(lang, "tab_gallery")}</TabsTrigger>
          <TabsTrigger value="settings">{t(lang, "tab_settings")}</TabsTrigger>
          <TabsTrigger value="users">{t(lang, "tab_users")}</TabsTrigger>
        </TabsList>
        <TabsContent value="bookings"><BookingsTab /></TabsContent>
        <TabsContent value="packages"><PackagesTab /></TabsContent>
        <TabsContent value="gallery"><GalleryTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
