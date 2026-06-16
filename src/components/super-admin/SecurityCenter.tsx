import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, Lock, Eye, Activity,
  KeyRound, Clock, Database, FileText, UserCheck, Cookie, Ban, CheckCircle2,
  Fingerprint, BookLock, Server, Network, AlertCircle, Users, User, Briefcase, Stethoscope
} from "lucide-react";
import { AuditLogsTab } from "@/components/admin/AuditLogsTab";
import { CompetitionRoundsAuditTab } from "@/components/admin/CompetitionRoundsAuditTab";

interface SecurityStats {
  total_events: number;
  critical_events: number;
  warning_events: number;
  failed_logins: number;
  mfa_enabled_users: number;
  total_users: number;
  sensitive_access_count: number;
  unique_accessors: number;
  most_accessed_tables: Array<{ accessed_table: string; count: number }> | null;
}

interface SecurityEvent {
  id: string;
  user_email: string | null;
  event_type: string;
  severity: string;
  ip_address: string | null;
  device_fingerprint: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface SensitiveAccessLog {
  id: string;
  accessor_email: string | null;
  accessor_role: string | null;
  accessed_table: string;
  access_action: string;
  justification: string | null;
  created_at: string;
}

const SEVERITY_BADGE: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const EVENT_LABELS: Record<string, string> = {
  login_success: "Connexion réussie",
  login_failed: "Échec connexion",
  logout: "Déconnexion",
  password_changed: "Mot de passe modifié",
  password_reset_requested: "Reset mot de passe",
  mfa_enabled: "2FA activé",
  mfa_disabled: "2FA désactivé",
  mfa_verified: "2FA vérifié",
  mfa_failed: "Échec 2FA",
  new_device_login: "Nouveau device",
  session_timeout: "Session expirée",
  suspicious_access: "Accès suspect",
  data_export_requested: "Export RGPD",
  account_deletion_requested: "Suppression compte",
  consent_given: "Consentement donné",
  consent_revoked: "Consentement retiré",
  permission_denied: "Permission refusée",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Consultation",
  export: "Export",
  modify: "Modification",
  delete: "Suppression",
  decrypt: "Déchiffrement",
};

function StatCard({ icon: Icon, label, value, hint, color = "text-primary" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-xl bg-muted/50 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MeasureCard({ icon: Icon, title, description, status, details }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status: "active" | "partial" | "inactive";
  details?: string;
}) {
  const statusConfig = {
    active: { label: "✓ Actif", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900" },
    partial: { label: "Partiel", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", border: "border-amber-200 dark:border-amber-900" },
    inactive: { label: "Inactif", color: "bg-muted text-muted-foreground", border: "border-border" },
  }[status];

  return (
    <Card className={`rounded-2xl border ${statusConfig.border}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-muted/40">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm">{title}</h4>
              <Badge variant="outline" className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            {details && <p className="text-xs text-muted-foreground/80 mt-2 italic">{details}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SecurityCenter() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["security-stats", 30],
    queryFn: async (): Promise<SecurityStats | null> => {
      const { data, error } = await supabase.rpc("get_security_stats", { _days: 30 });
      if (error) throw error;
      return data as unknown as SecurityStats;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["security-events-recent"],
    queryFn: async (): Promise<SecurityEvent[]> => {
      const { data, error } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SecurityEvent[];
    },
  });

  const { data: sensitiveAccess } = useQuery({
    queryKey: ["sensitive-access-recent"],
    queryFn: async (): Promise<SensitiveAccessLog[]> => {
      const { data, error } = await supabase
        .from("sensitive_data_access_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SensitiveAccessLog[];
    },
  });

  const mfaPercent = stats && stats.total_users > 0
    ? Math.round((stats.mfa_enabled_users / stats.total_users) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border">
        <div className="p-3 rounded-2xl bg-primary/10">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Centre de sécurité</h2>
          <p className="text-muted-foreground">
            Vue d'ensemble des mesures de sécurité, audit des accès sensibles et journal des événements.
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="measures" className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Mesures actives
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Événements sécurité
          </TabsTrigger>
          <TabsTrigger value="sensitive" className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Accès sensibles
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Par rôle
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Logs d'audit
          </TabsTrigger>
          <TabsTrigger value="rounds-audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Parties (audit)
          </TabsTrigger>
        </TabsList>

        {/* === VUE D'ENSEMBLE === */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Activity} label="Événements (30j)"
              value={statsLoading ? "…" : stats?.total_events ?? 0}
              hint={`${stats?.warning_events ?? 0} warnings, ${stats?.critical_events ?? 0} critiques`}
              color="text-blue-600"
            />
            <StatCard
              icon={Ban} label="Connexions échouées"
              value={statsLoading ? "…" : stats?.failed_logins ?? 0}
              hint="Sur 30 jours"
              color="text-red-600"
            />
            <StatCard
              icon={KeyRound} label="2FA activé"
              value={statsLoading ? "…" : `${mfaPercent}%`}
              hint={`${stats?.mfa_enabled_users ?? 0} / ${stats?.total_users ?? 0} users`}
              color="text-emerald-600"
            />
            <StatCard
              icon={Eye} label="Accès données sensibles"
              value={statsLoading ? "…" : stats?.sensitive_access_count ?? 0}
              hint={`${stats?.unique_accessors ?? 0} utilisateurs distincts`}
              color="text-purple-600"
            />
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Adoption du 2FA (Two-Factor Authentication)
              </CardTitle>
              <CardDescription>
                Pourcentage d'utilisateurs ayant activé l'authentification à deux facteurs (optionnel pour tous).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Adoption</span>
                  <span className="font-semibold">{mfaPercent}%</span>
                </div>
                <Progress value={mfaPercent} className="h-3" />
              </div>
            </CardContent>
          </Card>

          {stats?.most_accessed_tables && stats.most_accessed_tables.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  Données sensibles les plus consultées (30j)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.most_accessed_tables.map((t) => (
                    <div key={t.accessed_table} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                      <span className="text-sm font-mono">{t.accessed_table}</span>
                      <Badge variant="secondary">{t.count} accès</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === MESURES ACTIVES === */}
        <TabsContent value="measures" className="space-y-6">
          {/* Authentification */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Authentification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MeasureCard
                icon={KeyRound} title="2FA / MFA (TOTP)" status="active"
                description="Authentification à deux facteurs disponible pour tous les utilisateurs (optionnel)."
                details="Activable via Paramètres → Sécurité. Compatible Google Authenticator, Authy, 1Password."
              />
              <MeasureCard
                icon={Shield} title="Protection mots de passe fuités (HIBP)" status="active"
                description="Vérification automatique contre la base Have I Been Pwned au signup et au changement de mot de passe."
                details="Bloque l'usage de mots de passe connus comme compromis."
              />
              <MeasureCard
                icon={Clock} title="Session timeout" status="active"
                description="Déconnexion automatique après 30 minutes d'inactivité."
                details="Configurable par utilisateur (5 à 480 min). Synchronisé entre onglets."
              />
              <MeasureCard
                icon={Fingerprint} title="Détection device" status="active"
                description="Empreinte d'appareil enregistrée à chaque connexion."
                details="Permet de détecter les connexions depuis un nouvel appareil."
              />
            </div>
          </div>

          {/* Données */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" /> Données & Stockage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MeasureCard
                icon={Lock} title="Row-Level Security (RLS)" status="active"
                description="Chaque table a des règles d'accès strictes au niveau base de données."
                details="Aucun accès cross-club, isolation totale des données par catégorie."
              />
              <MeasureCard
                icon={BookLock} title="Chiffrement champs médicaux (pgcrypto)" status="active"
                description="Champs ultra-sensibles (n° sécu, allergies graves) chiffrés en base."
                details="Déchiffrement uniquement par médecin/kiné/admin du club. Chaque déchiffrement est tracé."
              />
              <MeasureCard
                icon={Eye} title="Vue masquée (players_safe)" status="active"
                description="Données personnelles (téléphone, adresse) masquées selon le rôle."
                details="Seuls les staff autorisés voient les coordonnées complètes."
              />
              <MeasureCard
                icon={Server} title="Backup chiffré quotidien" status="active"
                description="Sauvegardes automatiques chiffrées par Lovable Cloud."
                details="Conservation 30 jours, restauration possible point-in-time."
              />
            </div>
          </div>

          {/* Audit & Traçabilité */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Audit & Traçabilité
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MeasureCard
                icon={Activity} title="Journal d'événements de sécurité" status="active"
                description="Toutes les connexions, échecs, changements de mot de passe sont tracés."
                details="Conservation illimitée, insert-only (impossible de modifier/supprimer)."
              />
              <MeasureCard
                icon={Eye} title="Audit accès données sensibles" status="active"
                description="Chaque consultation/export de dossier médical est journalisé."
                details="Qui a vu quoi, quand, depuis quel device. Visible par Admin Club et Super Admin."
              />
              <MeasureCard
                icon={AlertCircle} title="Audit modifications critiques" status="active"
                description="Création/modification/suppression de blessures, transferts, approbations."
                details="Logs complets dans audit_logs avec metadata détaillée."
              />
              <MeasureCard
                icon={UserCheck} title="Notification de l'utilisateur" status="active"
                description="Chaque athlète peut voir qui a accédé à ses propres données."
                details="Transparence totale conforme au RGPD."
              />
            </div>
          </div>

          {/* Front-end */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <Network className="h-4 w-4" /> Application & API
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MeasureCard
                icon={Lock} title="Validation Zod" status="active"
                description="Toutes les entrées utilisateur validées côté client ET serveur."
                details="Schémas stricts, longueurs max, types contrôlés."
              />
              <MeasureCard
                icon={Shield} title="Sanitization HTML (DOMPurify)" status="active"
                description="Tout contenu HTML utilisateur est nettoyé avant rendu."
                details="Whitelist stricte de tags autorisés, anti-XSS."
              />
              <MeasureCard
                icon={KeyRound} title="JWT vérification edge functions" status="active"
                description="Chaque edge function sensible vérifie le JWT côté serveur."
                details="getClaims() utilisé sur toutes les actions athlète/staff."
              />
              <MeasureCard
                icon={Cookie} title="Consentement cookies (RGPD)" status="active"
                description="Bandeau de consentement granulaire (essentiels / analytics / marketing)."
                details="OneSignal et autres trackers conditionnés au consentement explicite."
              />
            </div>
          </div>

          {/* RGPD */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <BookLock className="h-4 w-4" /> Conformité RGPD
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MeasureCard
                icon={FileText} title="Pages légales" status="active"
                description="Mentions légales, politique de confidentialité, CGU, politique cookies."
                details="Accessibles depuis le footer global."
              />
              <MeasureCard
                icon={CheckCircle2} title="Consentements explicites" status="active"
                description="CGU + Politique acceptés à l'inscription. Consentement spécifique données santé pour mineurs."
                details="Horodatage + IP + version conservés pour preuve."
              />
              <MeasureCard
                icon={Database} title="Droit à la portabilité" status="active"
                description="Export complet des données utilisateur (JSON) à la demande."
                details="Disponible depuis Paramètres et fiche joueur."
              />
              <MeasureCard
                icon={Ban} title="Droit à l'oubli" status="active"
                description="Suppression de compte avec délai légal de 30 jours."
                details="Possibilité d'annuler la demande pendant 30 jours."
              />
            </div>
          </div>
        </TabsContent>

        {/* === ÉVÉNEMENTS === */}
        <TabsContent value="events">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Journal des événements de sécurité
              </CardTitle>
              <CardDescription>
                100 derniers événements (connexions, MFA, sessions, accès suspects).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Événement</TableHead>
                      <TableHead>Sévérité</TableHead>
                      <TableHead>Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events?.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-xs">{ev.user_email ?? "—"}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                        </TableCell>
                        <TableCell>
                          <Badge className={SEVERITY_BADGE[ev.severity] ?? ""}>{ev.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {ev.device_fingerprint?.slice(0, 12) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!events || events.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucun événement enregistré pour le moment.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ACCÈS SENSIBLES === */}
        <TabsContent value="sensitive">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Audit des accès aux données sensibles
              </CardTitle>
              <CardDescription>
                Chaque consultation, export ou déchiffrement de données médicales/personnelles est tracé.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Accédé par</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Donnée</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Justification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensitiveAccess?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-xs">{log.accessor_email ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">{log.accessor_role ?? "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.accessed_table}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ACTION_LABELS[log.access_action] ?? log.access_action}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground italic max-w-[200px] truncate">
                          {log.justification ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!sensitiveAccess || sensitiveAccess.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Aucun accès sensible enregistré pour le moment.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PAR RÔLE === */}
        <TabsContent value="roles" className="space-y-6">
          <Card className="rounded-2xl bg-gradient-to-br from-muted/40 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mesures de sécurité par rôle
              </CardTitle>
              <CardDescription>
                Détail des protections appliquées selon le profil utilisateur (Staff vs Athlètes).
              </CardDescription>
            </CardHeader>
          </Card>

          {/* STAFF */}
          <div>
            <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                <Briefcase className="h-6 w-6 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Staff (Admin Club, Coach, Préparateur, Médecin, Kiné, Administratif)</h3>
                <p className="text-sm text-muted-foreground">
                  Accès opérationnel élevé → contrôles renforcés, audit systématique.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Authentification & Session
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={KeyRound} title="2FA optionnel (recommandé)" status="active"
                    description="Activable depuis Paramètres → Sécurité. Fortement recommandé pour Admin et Médecin."
                  />
                  <MeasureCard
                    icon={Shield} title="HIBP au signup/changement MDP" status="active"
                    description="Mots de passe vérifiés contre la base Have I Been Pwned."
                  />
                  <MeasureCard
                    icon={Clock} title="Session 30 min d'inactivité" status="active"
                    description="Déconnexion auto, configurable par utilisateur (5–480 min)."
                  />
                  <MeasureCard
                    icon={Fingerprint} title="Empreinte device" status="active"
                    description="Détection des connexions depuis un nouvel appareil."
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Permissions & Accès
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={Lock} title="Matrice de permissions par rôle" status="active"
                    description="Chaque rôle voit uniquement les menus autorisés (table role_menu_permissions)."
                    details="Configurée par le Super Admin."
                  />
                  <MeasureCard
                    icon={Database} title="Cloisonnement par catégorie" status="active"
                    description="Un coach ne voit que les catégories qui lui sont assignées (assigned_categories)."
                  />
                  <MeasureCard
                    icon={Stethoscope} title="Accès médical restreint" status="active"
                    description="Dossiers médicaux et déchiffrement réservés à Admin / Médecin / Kiné via has_medical_access()."
                  />
                  <MeasureCard
                    icon={Eye} title="Vue masquée players_safe" status="active"
                    description="Données personnelles (téléphone, adresse) visibles uniquement par rôles autorisés."
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Audit & Traçabilité
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={Activity} title="Toutes les actions tracées" status="active"
                    description="Création/modif/suppression blessures, transferts, exports → audit_logs."
                  />
                  <MeasureCard
                    icon={Eye} title="Log obligatoire des accès médicaux" status="active"
                    description="Chaque consultation/déchiffrement de dossier médical est journalisé avec justification."
                    details="Visible dans l'onglet 'Accès sensibles'."
                  />
                  <MeasureCard
                    icon={BookLock} title="Déchiffrement avec justification" status="active"
                    description="Champs ultra-sensibles (n° sécu, allergies) demandent une justification écrite."
                  />
                  <MeasureCard
                    icon={AlertCircle} title="Alertes accès suspect" status="active"
                    description="Tentatives de connexion échouées et nouveaux devices remontés au Super Admin."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ATHLÈTES */}
          <div>
            <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                <User className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Athlètes (Espace Athlète)</h3>
                <p className="text-sm text-muted-foreground">
                  Accès à leurs propres données uniquement → maximum de transparence et contrôle utilisateur.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Authentification & Session
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={KeyRound} title="2FA optionnel" status="active"
                    description="Disponible dans l'espace athlète → Paramètres."
                  />
                  <MeasureCard
                    icon={Shield} title="HIBP activé" status="active"
                    description="Protection contre les mots de passe compromis."
                  />
                  <MeasureCard
                    icon={Clock} title="Session 30 min d'inactivité" status="active"
                    description="Déconnexion auto identique au staff."
                  />
                  <MeasureCard
                    icon={Lock} title="Tokens d'invitation à usage unique" status="active"
                    description="Lien d'invitation athlète signé, à usage unique, expirable."
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4" /> Isolation des données
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={Lock} title="RLS strict — données personnelles uniquement" status="active"
                    description="Un athlète ne peut JAMAIS voir les données d'un autre athlète."
                    details="Enforced au niveau base via auth.uid() = player.user_id."
                  />
                  <MeasureCard
                    icon={Eye} title="Sessions privées par défaut" status="active"
                    description="Les sessions auto-planifiées par l'athlète restent privées (non visibles staff)."
                  />
                  <MeasureCard
                    icon={KeyRound} title="Edge Functions JWT-vérifiées" status="active"
                    description="Toutes les actions athlète (création session, RPE, wellness) passent par des edge functions sécurisées."
                  />
                  <MeasureCard
                    icon={Server} title="Multi-catégorie consenti" status="active"
                    description="Ajout dans une nouvelle catégorie nécessite un consentement explicite de l'athlète."
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <BookLock className="h-4 w-4" /> RGPD & Droits utilisateur
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={CheckCircle2} title="Consentement données santé" status="active"
                    description="Consentement explicite requis (mineurs : par représentant légal). Horodaté + versioning."
                  />
                  <MeasureCard
                    icon={Database} title="Export complet des données" status="active"
                    description="Bouton 'Télécharger mes données' (JSON) dans l'espace athlète + fiche joueur staff."
                  />
                  <MeasureCard
                    icon={Ban} title="Demande de suppression" status="active"
                    description="Suppression de compte avec délai légal de 30 jours, annulable."
                  />
                  <MeasureCard
                    icon={Cookie} title="Consentement cookies granulaire" status="active"
                    description="Bandeau RGPD séparant essentiels / analytics / marketing."
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" /> Données de santé
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MeasureCard
                    icon={BookLock} title="Champs médicaux chiffrés" status="active"
                    description="Allergies graves, n° sécu, antécédents → chiffrés via pgcrypto."
                    details="Inaccessibles à l'athlète lui-même sans déchiffrement médical."
                  />
                  <MeasureCard
                    icon={Eye} title="Transparence sur les accès" status="active"
                    description="L'athlète peut consulter qui a accédé à ses données médicales (à venir dans son espace)."
                  />
                  <MeasureCard
                    icon={ShieldAlert} title="Protocole commotion sécurisé" status="active"
                    description="Validation médicale obligatoire pour le retour au jeu (Rugby/Judo/Ski/Snowboard)."
                  />
                  <MeasureCard
                    icon={UserCheck} title="Auto-saisie RPE/Wellness" status="active"
                    description="L'athlète saisit lui-même son ressenti — données non modifiables par le staff sans audit."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SUPER ADMIN */}
          <div>
            <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50">
                <Shield className="h-6 w-6 text-purple-700 dark:text-purple-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Super Admin (Plateforme)</h3>
                <p className="text-sm text-muted-foreground">
                  Accès global → contrôles ultimes et toutes actions auditées.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MeasureCard
                icon={KeyRound} title="2FA fortement recommandé" status="active"
                description="Compte sensible : activation du MFA très conseillée."
              />
              <MeasureCard
                icon={Activity} title="Toutes les actions tracées" status="active"
                description="Aucune exception : chaque action super admin est journalisée."
              />
              <MeasureCard
                icon={Eye} title="Accès complet via vue dédiée" status="active"
                description="is_super_admin() vérifié à chaque RPC sensible."
              />
              <MeasureCard
                icon={ShieldAlert} title="Alertes critiques en temps réel" status="active"
                description="Échecs de connexion répétés, accès suspects remontés."
              />
            </div>
          </div>
        </TabsContent>

        {/* === LOGS AUDIT === */}
        <TabsContent value="audit">
          <AuditLogsTab />
        </TabsContent>

        <TabsContent value="rounds-audit">
          <CompetitionRoundsAuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
