import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Calendar, AlertTriangle, Download, Trash2, Search, User, Upload, File, Image, Eye, Users, Pencil } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useSeasonGuard } from "@/hooks/use-season-guard";

interface DocumentsSectionProps {
  categoryId: string;
}

interface AdminDocument {
  id: string;
  player_id: string | null;
  document_type: string;
  title: string;
  file_url: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  created_by_role: string | null;
  original_filename: string | null;
  players?: { name: string; first_name?: string | null } | null;
}

import i18n from "@/i18n";

function getRoleLabel(): Record<string, string> {
  return {
    athlete: i18n.t("adminRecruitDocs.documents.roleLabels.athlete"),
    staff: i18n.t("adminRecruitDocs.documents.roleLabels.staff"),
    coach: i18n.t("adminRecruitDocs.documents.roleLabels.coach"),
    admin: i18n.t("adminRecruitDocs.documents.roleLabels.admin"),
    legacy: i18n.t("adminRecruitDocs.documents.roleLabels.legacy"),
  };
}

function getDocumentTypes() {
  return [
    { value: "license", label: i18n.t("adminRecruitDocs.documents.types.license") },
    { value: "medical_certificate", label: i18n.t("adminRecruitDocs.documents.types.medicalCertificate") },
    { value: "medical_return_training", label: i18n.t("adminRecruitDocs.documents.types.medicalReturnTraining") },
    { value: "medical_return_competition", label: i18n.t("adminRecruitDocs.documents.types.medicalReturnCompetition") },
    { value: "identity", label: i18n.t("adminRecruitDocs.documents.types.identity") },
    { value: "contract", label: i18n.t("adminRecruitDocs.documents.types.contract") },
    { value: "insurance", label: i18n.t("adminRecruitDocs.documents.types.insurance") },
    { value: "parental_authorization", label: i18n.t("adminRecruitDocs.documents.types.parentalAuthorization") },
    { value: "image_rights", label: i18n.t("adminRecruitDocs.documents.types.imageRights") },
    { value: "custom", label: i18n.t("adminRecruitDocs.documents.types.custom") },
  ];
}

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.bmp,.tiff,.tif";
const MAX_FILE_SIZE_MB = 10;

const STATUS_COLORS: Record<string, string> = {
  valid: "bg-green-100 text-green-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  pending: "bg-blue-100 text-blue-700",
};

function getStatusLabels(): Record<string, string> {
  return {
    valid: i18n.t("adminRecruitDocs.documents.statusLabels.valid"),
    expiring_soon: i18n.t("adminRecruitDocs.documents.statusLabels.expiringSoon"),
    expired: i18n.t("adminRecruitDocs.documents.statusLabels.expired"),
    pending: i18n.t("adminRecruitDocs.documents.statusLabels.pending"),
  };
}

function getFileIcon(url: string | null) {
  if (!url) return <FileText className="h-5 w-5 text-muted-foreground" />;
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <File className="h-5 w-5 text-red-500" />;
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "heic"].includes(ext || ""))
    return <Image className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function DocumentsSection({ categoryId }: DocumentsSectionProps) {
  const { t } = useTranslation();
  const ROLE_LABEL = getRoleLabel();
  const DOCUMENT_TYPES = getDocumentTypes();
  const STATUS_LABELS = getStatusLabels();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const guard = useSeasonGuard(categoryId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState<AdminDocument | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Assignee for the new document dialog ("team" or player id)
  const [assignee, setAssignee] = useState<string>("team");

  const [customDocumentType, setCustomDocumentType] = useState("");
  const [formData, setFormData] = useState({
    document_type: "license",
    title: "",
    expiry_date: "",
    notes: "",
  });

  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["admin-documents", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_documents" as any)
        .select("*, players(name, first_name)")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data as unknown as AdminDocument[]).map((doc) => {
        if (!doc.expiry_date) return { ...doc, status: "valid" };
        const daysUntilExpiry = differenceInDays(new Date(doc.expiry_date), new Date());
        if (daysUntilExpiry < 0) return { ...doc, status: "expired" };
        if (daysUntilExpiry <= 30) return { ...doc, status: "expiring_soon" };
        return { ...doc, status: "valid" };
      });
    },
  });

  const authorIds = Array.from(
    new Set((documents || []).map((d) => d.created_by).filter(Boolean) as string[]),
  );
  const { data: authors } = useQuery({
    queryKey: ["doc-authors", categoryId, authorIds.sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const [profilesRes, playersRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", authorIds),
        supabase
          .from("players")
          .select("user_id, first_name, name")
          .eq("category_id", categoryId)
          .in("user_id", authorIds),
      ]);
      const map = new Map<string, { id: string; full_name: string | null; email: string | null }>();
      (profilesRes.data || []).forEach((p: any) => map.set(p.id, p));
      (playersRes.data || []).forEach((pl: any) => {
        if (!pl.user_id) return;
        const display = [pl.first_name, pl.name].filter(Boolean).join(" ").trim();
        if (!display) return;
        const existing = map.get(pl.user_id);
        map.set(pl.user_id, {
          id: pl.user_id,
          full_name: display,
          email: existing?.email ?? null,
        });
      });
      return Array.from(map.values());
    },
  });
  const authorMap = new Map((authors || []).map((a) => [a.id, a]));

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileName = `${categoryId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("admin-documents")
      .upload(fileName, file, { upsert: false });

    if (error) throw error;
    return fileName;
  };

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("admin-documents")
      .createSignedUrl(filePath, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  };

  const addDocumentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const playerId = assignee === "team" ? null : assignee;
      if (playerId && !guard.assertPlayer(playerId)) throw new Error("guard:player");
      setIsUploading(true);
      let fileUrl: string | null = null;

      if (selectedFile) {
        fileUrl = await uploadFile(selectedFile);
      }


      const { error } = await supabase.from("admin_documents" as any).insert({
        category_id: categoryId,
        created_by: user?.id,
        created_by_role: "staff",
        player_id: playerId,
        document_type: data.document_type === "custom" ? customDocumentType : data.document_type,
        title: data.title,
        file_url: fileUrl,
        original_filename: selectedFile?.name ?? null,
        expiry_date: data.expiry_date || null,
        notes: data.notes || null,
        status: "valid",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents", categoryId] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: t("adminRecruitDocs.documents.toasts.documentAdded") });
    },
    onError: (error: any) => {
      if (typeof error?.message === "string" && error.message.startsWith("guard:")) return;
      toast({ title: t("adminRecruitDocs.documents.toasts.error"), description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (doc: AdminDocument) => {
      if (doc.file_url && !doc.file_url.startsWith("http")) {
        await supabase.storage.from("admin-documents").remove([doc.file_url]);
      }
      const { error } = await supabase.from("admin_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents", categoryId] });
      toast({ title: t("adminRecruitDocs.documents.toasts.documentDeleted") });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!editingDoc) throw new Error("Document introuvable");
      if (!formData.title.trim()) throw new Error("Titre requis");
      if (formData.document_type === "custom" && !customDocumentType.trim()) {
        throw new Error("Nom du type requis");
      }

      const { error } = await supabase
        .from("admin_documents" as any)
        .update({
          document_type: formData.document_type === "custom" ? customDocumentType.trim() : formData.document_type,
          title: formData.title.trim(),
          expiry_date: formData.expiry_date || null,
          notes: formData.notes || null,
        })
        .eq("id", editingDoc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-documents", categoryId] });
      setEditingDoc(null);
      resetForm();
      toast({ title: t("adminRecruitDocs.documents.toasts.documentUpdated") });
    },
    onError: (error: any) => {
      toast({ title: t("adminRecruitDocs.documents.toasts.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleViewFile = async (doc: AdminDocument) => {
    if (!doc.file_url) return;
    if (doc.file_url.startsWith("http")) {
      window.open(doc.file_url, "_blank");
      return;
    }
    const url = await getSignedUrl(doc.file_url);
    if (url) {
      window.open(url, "_blank");
    } else {
      toast({ title: t("adminRecruitDocs.documents.toasts.error"), description: t("adminRecruitDocs.documents.toasts.cannotAccessFile"), variant: "destructive" });
    }
  };

  const handleDownloadFile = async (doc: AdminDocument) => {
    if (!doc.file_url) return;

    try {
      let url: string;
      if (doc.file_url.startsWith("http")) {
        url = doc.file_url;
      } else {
        const signedUrl = await getSignedUrl(doc.file_url);
        if (!signedUrl) {
          toast({ title: t("adminRecruitDocs.documents.toasts.error"), description: t("adminRecruitDocs.documents.toasts.cannotDownloadFile"), variant: "destructive" });
          return;
        }
        url = signedUrl;
      }

      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = doc.file_url.split(".").pop() || "bin";
      a.download = `${doc.title}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast({ title: t("adminRecruitDocs.documents.toasts.error"), description: t("adminRecruitDocs.documents.toasts.downloadFailed"), variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      document_type: "license",
      title: "",
      expiry_date: "",
      notes: "",
    });
    setCustomDocumentType("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openEditDialog = (doc: AdminDocument) => {
    setEditingDoc(doc);
    const knownType = DOCUMENT_TYPES.some((t) => t.value === doc.document_type);
    setFormData({
      document_type: knownType ? doc.document_type : "custom",
      title: doc.title || "",
      expiry_date: doc.expiry_date || "",
      notes: doc.notes || "",
    });
    setCustomDocumentType(knownType ? "" : doc.document_type || "");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: t("adminRecruitDocs.documents.toasts.fileTooLarge"), description: t("adminRecruitDocs.documents.toasts.maxSize", { max: MAX_FILE_SIZE_MB }), variant: "destructive" });
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const filteredDocuments = documents?.filter((doc) => {
    const matchesType = typeFilter === "all" || doc.document_type === typeFilter;
    return matchesType;
  });

  const expiredDocs = documents?.filter((d) => d.status === "expired") || [];
  const expiringSoonDocs = documents?.filter((d) => d.status === "expiring_soon") || [];




  return (
    <div className="space-y-6">
      {/* Alertes documents expirés */}
      {(expiredDocs.length > 0 || expiringSoonDocs.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {expiredDocs.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("adminRecruitDocs.documents.expiredDocuments", { count: expiredDocs.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <ul className="space-y-1">
                  {expiredDocs.slice(0, 5).map((doc) => (
                    <li key={doc.id} className="text-red-600">
                      {doc.players?.name ? `${[doc.players.first_name, doc.players.name].filter(Boolean).join(" ")} - ` : ""}
                      {doc.title}
                    </li>
                  ))}
                  {expiredDocs.length > 5 && (
                    <li className="text-red-500 italic">{t("adminRecruitDocs.documents.othersCount", { count: expiredDocs.length - 5 })}</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
          {expiringSoonDocs.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t("adminRecruitDocs.documents.expireSoon", { count: expiringSoonDocs.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <ul className="space-y-1">
                  {expiringSoonDocs.slice(0, 5).map((doc) => (
                    <li key={doc.id} className="text-amber-600">
                      {doc.players?.name ? `${[doc.players.first_name, doc.players.name].filter(Boolean).join(" ")} - ` : ""}
                      {doc.title}
                      {doc.expiry_date && (
                        <span className="ml-1 text-xs">
                          {t("adminRecruitDocs.documents.daysCount", { count: differenceInDays(new Date(doc.expiry_date), new Date()) })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Liste & ajout */}
      <div className="space-y-4">

        {/* Header avec filtre et bouton ajouter */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("adminRecruitDocs.documents.typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminRecruitDocs.documents.allTypes")}</SelectItem>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => { resetForm(); setAssignee("team"); setShowAddDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            {t("adminRecruitDocs.documents.addDocument")}
          </Button>
        </div>

        {/* Dialog ajout document */}
        <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminRecruitDocs.documents.newDocument")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Assignee selection */}
              <div>
                <Label>{t("adminRecruitDocs.documents.assignTo")}</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4" />{t("adminRecruitDocs.documents.wholeTeam")}</span>
                    </SelectItem>
                    {players?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {[p.first_name, p.name].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload */}
              <div>
                <Label>{t("adminRecruitDocs.documents.fileLabel")}</Label>
                <div
                  className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      {getFileIcon(selectedFile.name)}
                      <div className="text-left">
                        <p className="text-sm font-medium truncate max-w-[250px]">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminRecruitDocs.documents.sizeInMo", { size: (selectedFile.size / (1024 * 1024)).toFixed(2) })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{t("adminRecruitDocs.documents.clickToSelect")}</p>
                      <p className="text-xs text-muted-foreground">{t("adminRecruitDocs.documents.fileHint", { max: MAX_FILE_SIZE_MB })}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>{t("adminRecruitDocs.documents.documentType")}</Label>
                <Select value={formData.document_type} onValueChange={(v) => { setFormData({ ...formData, document_type: v }); if (v !== "custom") setCustomDocumentType(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.document_type === "custom" && (
                  <div className="mt-2">
                    <Label className="text-xs">{t("adminRecruitDocs.documents.customTypeLabel")}</Label>
                    <Input
                      value={customDocumentType}
                      onChange={(e) => setCustomDocumentType(e.target.value)}
                      placeholder={t("adminRecruitDocs.documents.customTypePlaceholder")}
                      autoFocus
                    />
                  </div>
                )}
              </div>
              <div>
                <Label>{t("adminRecruitDocs.documents.titleDescription")}</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t("adminRecruitDocs.documents.titlePlaceholder")}
                />
              </div>
              <div>
                <Label>{t("adminRecruitDocs.documents.expiryDate")}</Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("adminRecruitDocs.documents.notes")}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t("adminRecruitDocs.documents.notesPlaceholder")}
                  rows={2}
                />
              </div>
              <Button
                onClick={() => addDocumentMutation.mutate(formData)}
                disabled={!formData.title || !selectedFile || addDocumentMutation.isPending || isUploading || (formData.document_type === "custom" && !customDocumentType.trim())}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-pulse" />
                    {t("adminRecruitDocs.documents.sending")}
                  </>
                ) : (
                  t("adminRecruitDocs.documents.add")
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingDoc} onOpenChange={(open) => { if (!open) { setEditingDoc(null); resetForm(); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminRecruitDocs.documents.editDocument")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("adminRecruitDocs.documents.documentType")}</Label>
                <Select value={formData.document_type} onValueChange={(v) => { setFormData({ ...formData, document_type: v }); if (v !== "custom") setCustomDocumentType(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.document_type === "custom" && (
                  <div className="mt-2">
                    <Label className="text-xs">{t("adminRecruitDocs.documents.customTypeLabel")}</Label>
                    <Input
                      value={customDocumentType}
                      onChange={(e) => setCustomDocumentType(e.target.value)}
                      placeholder={t("adminRecruitDocs.documents.customTypePlaceholder")}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label>{t("adminRecruitDocs.documents.titleDescription")}</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("adminRecruitDocs.documents.expiryDate")}</Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <Button
                onClick={() => updateDocumentMutation.mutate()}
                className="w-full"
              >
                {updateDocumentMutation.isPending ? t("adminRecruitDocs.documents.saving") : t("adminRecruitDocs.documents.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Liste des documents */}
        <div className="grid gap-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("adminRecruitDocs.documents.loading")}</div>
          ) : filteredDocuments?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>{t("adminRecruitDocs.documents.noDocument")}</p>
              </CardContent>
            </Card>
          ) : (
            filteredDocuments?.map((doc) => (
              <Card
                key={doc.id}
                className={doc.status === "expired" ? "border-red-200" : doc.status === "expiring_soon" ? "border-amber-200" : ""}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {getFileIcon(doc.file_url)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium truncate">{doc.title}</h4>
                        <Badge variant="outline" className="text-xs gap-1">
                          {doc.player_id ? (
                            <><User className="h-3 w-3" />{doc.players ? [doc.players.first_name, doc.players.name].filter(Boolean).join(" ") : t("adminRecruitDocs.documents.player")}</>
                          ) : (
                            <><Users className="h-3 w-3" />{t("adminRecruitDocs.documents.team")}</>
                          )}
                        </Badge>
                        <Badge className={STATUS_COLORS[doc.status]}>
                          {STATUS_LABELS[doc.status]}
                        </Badge>
                        {doc.file_url && (
                          <Badge variant="outline" className="text-xs">
                            {doc.file_url.split(".").pop()?.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span>{DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label || doc.document_type}</span>
                        {doc.expiry_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t("adminRecruitDocs.documents.expireOn", { date: format(new Date(doc.expiry_date), "d MMM yyyy", { locale: getDateLocale() }) })}
                          </span>
                        )}
                        {(() => {
                          const author = doc.created_by ? authorMap.get(doc.created_by) : null;
                          const name = author?.full_name || author?.email || null;
                          const role = doc.created_by_role || (doc.created_by ? null : "legacy");
                          const roleLabel = role ? ROLE_LABEL[role] || role : null;
                          const date = format(new Date(doc.created_at), "dd/MM/yyyy", { locale: getDateLocale() });
                          if (!name && role === "legacy") {
                            return <span className="text-xs">{t("adminRecruitDocs.documents.authorUnknown", { date })}</span>;
                          }
                          return (
                            <span className="text-xs">
                              {t("adminRecruitDocs.documents.addedBy", { name: name || t("adminRecruitDocs.documents.user"), role: roleLabel ? ` (${roleLabel})` : "", date })}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.file_url && (
                      <>
                        <Button variant="ghost" size="icon" title={t("adminRecruitDocs.documents.viewFile")} onClick={() => handleViewFile(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t("adminRecruitDocs.documents.download")} onClick={() => handleDownloadFile(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" title={t("adminRecruitDocs.documents.edit")} onClick={() => openEditDialog(doc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteDocumentMutation.mutate(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
