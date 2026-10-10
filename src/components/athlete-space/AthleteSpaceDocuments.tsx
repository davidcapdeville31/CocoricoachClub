import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, File, Image, Download, Eye, Users, User, Calendar, Plus, Upload, Trash2, UserCircle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { canAddAthleteDocument } from "@/lib/athleteDocumentAccess";
import "@/styles/athlete-documents.css";

interface AthleteSpaceDocumentsProps {
  playerId: string;
  categoryId: string;
  /** "athlete" when used in the athlete portal, "staff" when used in the coach view of a player profile */
  viewerMode?: "athlete" | "staff";
}

// DOCUMENT_TYPES labels are built inside the component via t()

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.bmp,.tiff,.tif";
const MAX_FILE_SIZE_MB = 10;

// ROLE_LABEL is built inside the component via t()

function getFileIcon(url: string | null) {
  if (!url) return <FileText className="h-5 w-5 text-muted-foreground" />;
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <File className="h-5 w-5 text-destructive" />;
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "heic"].includes(ext || ""))
    return <Image className="h-5 w-5 text-primary" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function AthleteSpaceDocuments({ playerId, categoryId, viewerMode = "athlete" }: AthleteSpaceDocumentsProps) {
  const { t } = useTranslation();
  const DOCUMENT_TYPES: { value: string; label: string }[] = [
    { value: "license", label: t("athleteSpace.documents.types.license") },
    { value: "medical_certificate", label: t("athleteSpace.documents.types.medicalCertificate") },
    { value: "medical_return_training", label: t("athleteSpace.documents.types.medicalReturnTraining") },
    { value: "medical_return_competition", label: t("athleteSpace.documents.types.medicalReturnCompetition") },
    { value: "identity", label: t("athleteSpace.documents.types.identity") },
    { value: "contract", label: t("athleteSpace.documents.types.contract") },
    { value: "insurance", label: t("athleteSpace.documents.types.insurance") },
    { value: "parental_authorization", label: t("athleteSpace.documents.types.parentalAuthorization") },
    { value: "image_rights", label: t("athleteSpace.documents.types.imageRights") },
    { value: "custom", label: t("athleteSpace.documents.types.custom") },
  ];
  const ROLE_LABEL: Record<string, string> = {
    athlete: t("athleteSpace.documents.role.athlete"),
    staff: t("athleteSpace.documents.role.staff"),
    coach: t("athleteSpace.documents.role.coach"),
    admin: t("athleteSpace.documents.role.admin"),
    legacy: t("athleteSpace.documents.role.legacy"),
  };
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeScope, setActiveScope] = useState<"personal" | "team">("personal");
  const { data: documentAccess } = useQuery({
    queryKey: ["athlete-document-access", user?.id, categoryId, playerId],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return { ownsPlayer: false, managesCategory: false };
      const [owner, manager] = await Promise.all([
        supabase.rpc("is_player_owner", { _user_id: user.id, _player_id: playerId }),
        supabase.rpc("can_manage_category_documents", { _user_id: user.id, _category_id: categoryId }),
      ]);
      if (owner.error || manager.error) throw owner.error || manager.error;
      return { ownsPlayer: owner.data === true, managesCategory: manager.data === true };
    },
  });
  const canAdd = (scope: "personal" | "team") => canAddAthleteDocument(scope, documentAccess?.ownsPlayer === true, documentAccess?.managesCategory === true);
  const openAddDialog = () => {
    if (!canAdd(activeScope)) return;
    resetForm();
    setFormData((prev) => ({ ...prev, scope: activeScope }));
    setShowAddDialog(true);
  };
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customDocumentType, setCustomDocumentType] = useState("");
  const [formData, setFormData] = useState({
    document_type: "license",
    title: "",
    expiry_date: "",
    notes: "",
    scope: "personal" as "personal" | "team",
  });

  const { data: teamDocuments, isLoading: teamLoading, isError: teamError, refetch: refetchTeam } = useQuery({
    queryKey: ["athlete-team-documents", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_documents" as any)
        .select("*")
        .eq("category_id", categoryId)
        .is("player_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: personalDocuments, isLoading: personalLoading, isError: personalError, refetch: refetchPersonal } = useQuery({
    queryKey: ["athlete-personal-documents", categoryId, playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_documents" as any)
        .select("*")
        .eq("category_id", categoryId)
        .eq("player_id", playerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Resolve author display names for all visible docs
  const allDocs = [...(personalDocuments || []), ...(teamDocuments || [])];
  const authorIds = Array.from(new Set(allDocs.map((d: any) => d.created_by).filter(Boolean)));
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
      // Prefer player display name (matches the roster) when available.
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

  const uploadFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const fileName = `${categoryId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("admin-documents")
      .upload(fileName, file, { upsert: false });
    if (error) throw error;
    return fileName;
  };

  const addDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error(t("athleteSpace.documents.notAuthenticated"));
      if (!selectedFile) throw new Error(t("athleteSpace.documents.fileRequired"));
      if (!formData.title.trim()) throw new Error(t("athleteSpace.documents.titleRequired"));
      if (formData.document_type === "custom" && !customDocumentType.trim())
        throw new Error(t("athleteSpace.documents.customTypeRequired"));

      setIsUploading(true);
      const fileUrl = await uploadFile(selectedFile);

      const isTeam = formData.scope === "team";
      const { error } = await supabase.from("admin_documents" as any).insert({
        category_id: categoryId,
        player_id: isTeam ? null : playerId,
        created_by: user.id,
        created_by_role: viewerMode === "athlete" ? "athlete" : "staff",
        document_type:
          formData.document_type === "custom" ? customDocumentType : formData.document_type,
        title: formData.title.trim(),
        file_url: fileUrl,
        original_filename: selectedFile.name,
        expiry_date: formData.expiry_date || null,
        notes: formData.notes || null,
        status: "valid",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-documents", categoryId, playerId] });
      queryClient.invalidateQueries({ queryKey: ["athlete-team-documents", categoryId] });
      setShowAddDialog(false);
      resetForm();
      toast.success(t("athleteSpace.documents.documentAdded"));
    },
    onError: (e: any) => toast.error(e.message || t("athleteSpace.documents.addError")),
    onSettled: () => setIsUploading(false),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (doc: any) => {
      if (doc.file_url && !doc.file_url.startsWith("http")) {
        await supabase.storage.from("admin-documents").remove([doc.file_url]);
      }
      const { error } = await supabase.from("admin_documents" as any).delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-documents", categoryId, playerId] });
      queryClient.invalidateQueries({ queryKey: ["athlete-team-documents", categoryId] });
      toast.success(t("athleteSpace.documents.documentDeleted"));
    },
    onError: (e: any) => toast.error(e.message || t("athleteSpace.documents.deleteError")),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!editingDoc) throw new Error(t("athleteSpace.documents.documentNotFound"));
      if (viewerMode !== "staff") throw new Error(t("athleteSpace.documents.editReservedToStaff"));
      if (!formData.title.trim()) throw new Error(t("athleteSpace.documents.titleRequired"));
      if (formData.document_type === "custom" && !customDocumentType.trim()) {
        throw new Error(t("athleteSpace.documents.customTypeRequired"));
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
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-documents", categoryId, playerId] });
      queryClient.invalidateQueries({ queryKey: ["athlete-team-documents", categoryId] });
      setEditingDoc(null);
      resetForm();
      toast.success(t("athleteSpace.documents.documentUpdated"));
    },
    onError: (e: any) => toast.error(e.message || t("athleteSpace.documents.updateError")),
  });

  const resetForm = () => {
    setFormData({ document_type: "license", title: "", expiry_date: "", notes: "", scope: "personal" });
    setCustomDocumentType("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(t("athleteSpace.documents.fileTooLarge", { maxSize: MAX_FILE_SIZE_MB }));
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setFormData((prev) => ({ ...prev, title: nameWithoutExt }));
    }
  };

  const handleDownload = async (fileUrl: string, title: string) => {
    if (!fileUrl) return;
    try {
      let url: string;
      if (fileUrl.startsWith("http")) {
        url = fileUrl;
      } else {
        const { data, error } = await supabase.storage
          .from("admin-documents")
          .createSignedUrl(fileUrl, 60 * 60);
        if (error) throw error;
        url = data.signedUrl;
      }
      const ext = fileUrl.split(".").pop()?.toLowerCase() || "";
      const safeTitle = (title || "document").replace(/[\\/:*?"<>|]+/g, "_").trim();
      const filename = ext && !safeTitle.toLowerCase().endsWith(`.${ext}`)
        ? `${safeTitle}.${ext}`
        : safeTitle;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error(t("athleteSpace.documents.downloadError"));
    }
  };

  const handleView = async (fileUrl: string) => {
    if (!fileUrl) return;
    try {
      let url: string;
      if (fileUrl.startsWith("http")) {
        url = fileUrl;
      } else {
        const { data, error } = await supabase.storage
          .from("admin-documents")
          .createSignedUrl(fileUrl, 60 * 60);
        if (error) throw error;
        url = data.signedUrl;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("athleteSpace.documents.viewError"));
    }
  };

  const getDocTypeLabel = (docType: string) =>
    DOCUMENT_TYPES.find((t) => t.value === docType)?.label || docType;

  const openEditDialog = (doc: any) => {
    setEditingDoc(doc);
    const knownType = DOCUMENT_TYPES.some((t) => t.value === doc.document_type);
    setFormData({
      document_type: knownType ? doc.document_type : "custom",
      title: doc.title || "",
      expiry_date: doc.expiry_date || "",
      notes: doc.notes || "",
      scope: doc.player_id ? "personal" : "team",
    });
    setCustomDocumentType(knownType ? "" : doc.document_type || "");
  };

  const renderAuthorLine = (doc: any) => {
    const author = doc.created_by ? authorMap.get(doc.created_by) : null;
    const name = author?.full_name || author?.email || null;
    const role = doc.created_by_role || (doc.created_by ? null : "legacy");
    const roleLabel = role ? ROLE_LABEL[role] || role : null;
    const addedAt = doc.created_at ? new Date(doc.created_at) : null;
    const date = addedAt && !Number.isNaN(addedAt.getTime()) ? format(addedAt, "dd/MM/yyyy", { locale: getDateLocale() }) : null;

    if (!name && role === "legacy") {
      return (
        <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1 break-words">
          <UserCircle className="h-3 w-3 shrink-0 mt-0.5" />
          {date ? t("athleteSpace.documents.unspecifiedAuthor", { date }) : t("athleteSpace.documents.role.legacy")}
        </p>
      );
    }
    return (
      <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1 break-words">
        <UserCircle className="h-3 w-3 shrink-0 mt-0.5" />
        {t("athleteSpace.documents.addedBy", { name: name || t("athleteSpace.documents.addedByFallbackUser") })}
        {roleLabel ? ` (${roleLabel})` : ""}{date ? ` · ${date}` : ""}
      </p>
    );
  };

  const canDelete = (doc: any) => {
    if (!user?.id) return false;
    return viewerMode === "staff" && (!doc.player_id || doc.player_id === playerId);
  };

  const canEdit = (doc: any) => canDelete(doc);

  const renderDocumentList = (
    documents: any[] | undefined,
    isLoading: boolean,
    scope: "personal" | "team",
    isError: boolean,
    retry: () => void,
  ) => {
    if (isLoading) return <div role="status" aria-label={t("athleteSpace.documents.loading")} className="space-y-3"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
    if (isError) return <div role="alert" className="py-8 text-center space-y-3"><FileText className="h-7 w-7 mx-auto text-muted-foreground" /><p className="text-sm text-foreground">{t("athleteSpace.documents.loadError")}</p><Button variant="outline" onClick={retry}>{t("athleteSpace.documents.retry")}</Button></div>;
    if (!documents || documents.length === 0) {
      return <div className="py-8 px-4 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" /></div>
        <h3 className="text-base font-semibold text-foreground">{t("athleteSpace.documents.emptyTitle")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{t(scope === "personal" ? "athleteSpace.documents.emptyPersonalDescription" : "athleteSpace.documents.emptyTeamDescription")}</p>
        {canAdd(scope) && <Button onClick={openAddDialog} className="min-h-11 h-auto whitespace-normal"><Plus className="h-4 w-4 mr-2 shrink-0" />{t(scope === "personal" ? "athleteSpace.documents.addFirstDocument" : "athleteSpace.documents.addDocument")}</Button>}
      </div>;
    }

    return (
      <div className="space-y-3">
        {documents.map((doc: any) => (
          <Card key={doc.id} className="bg-card rounded-xl shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.file_url)}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm break-words [overflow-wrap:anywhere]">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {getDocTypeLabel(doc.document_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{t(doc.player_id ? "athleteSpace.documents.personalOrigin" : "athleteSpace.documents.teamOrigin")}</span>
                      {doc.original_filename && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {doc.original_filename}
                        </span>
                      )}
                      {doc.expiry_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t("athleteSpace.documents.expiresOn", { date: format(new Date(doc.expiry_date), "dd MMM yyyy", { locale: getDateLocale() }) })}
                        </span>
                      )}
                    </div>
                    {doc.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.notes}</p>
                    )}
                    {renderAuthorLine(doc)}
                  </div>
                </div>
                <div className="document-actions flex items-center gap-1 shrink-0 self-end sm:self-start">
                  {doc.file_url && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(doc.file_url)}
                        title={t("athleteSpace.documents.view")}
                        aria-label={`${t("athleteSpace.documents.view")} : ${doc.title}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc.file_url, doc.title)}
                        title={t("athleteSpace.documents.download")}
                        aria-label={`${t("athleteSpace.documents.download")} : ${doc.title}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {canEdit(doc) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(doc)}
                      title={t("athleteSpace.documents.edit")}
                      aria-label={`${t("athleteSpace.documents.edit")} : ${doc.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete(doc) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      title={t("athleteSpace.documents.delete")}
                      aria-label={`${t("athleteSpace.documents.delete")} : ${doc.title}`}
                      onClick={() => {
                        if (confirm(t("athleteSpace.documents.confirmDelete"))) deleteDocumentMutation.mutate(doc);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="athlete-documents space-y-4">
      <Tabs value={activeScope} onValueChange={(value) => setActiveScope(value === "team" ? "team" : "personal")} className="w-full">
        <div className="space-y-4">
          <TabsList
            className="document-tabs grid grid-cols-2 w-full bg-muted rounded-xl p-1 gap-1"
            aria-label={t("athleteSpace.documents.tabsLabel")}
          >
            <TabsTrigger
              value="personal"
              className="document-tab gap-1 rounded-lg px-1.5 font-semibold"
            >
              <User className="h-3.5 w-3.5 shrink-0 hidden min-[360px]:block" />
              <span>{t("athleteSpace.documents.personalTab")}</span>
              <span className="document-tab-count">{personalLoading || personalError ? "—" : personalDocuments?.length || 0}</span>
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="document-tab gap-1 rounded-lg px-1.5 font-semibold"
            >
              <Users className="h-3.5 w-3.5 shrink-0 hidden min-[360px]:block" />
              <span>{t("athleteSpace.documents.teamTab")}</span>
              <span className="document-tab-count">{teamLoading || teamError ? "—" : teamDocuments?.length || 0}</span>
            </TabsTrigger>
          </TabsList>

          {canAdd(activeScope) && (activeScope === "personal" ? (personalDocuments?.length || 0) > 0 : (teamDocuments?.length || 0) > 0) && <Button
            onClick={openAddDialog}
            size="sm" variant="outline" className="min-h-11"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("athleteSpace.documents.addDocument")}
          </Button>}
        </div>

        <TabsContent value="personal" className="mt-4">
          {renderDocumentList(personalDocuments, personalLoading, "personal", personalError, () => { void refetchPersonal(); })}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {renderDocumentList(teamDocuments, teamLoading, "team", teamError, () => { void refetchTeam(); })}
        </TabsContent>
      </Tabs>

      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("athleteSpace.documents.newDocument")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("athleteSpace.documents.fileLabel")}</Label>
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
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} Mo
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("athleteSpace.documents.clickToSelectFile")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("athleteSpace.documents.acceptedFormats", { maxSize: MAX_FILE_SIZE_MB })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>{t("athleteSpace.documents.visibility")}</Label>
              <Select
                value={formData.scope}
                onValueChange={(v: "personal" | "team") => setFormData({ ...formData, scope: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canAdd("personal") && <SelectItem value="personal">{t("athleteSpace.documents.visibilityPersonal")}</SelectItem>}
                  {canAdd("team") && <SelectItem value="team">{t("athleteSpace.documents.visibilityTeam")}</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("athleteSpace.documents.documentType")}</Label>
              <Select
                value={formData.document_type}
                onValueChange={(v) => {
                  setFormData({ ...formData, document_type: v });
                  if (v !== "custom") setCustomDocumentType("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((docType) => (
                    <SelectItem key={docType.value} value={docType.value}>
                      {docType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.document_type === "custom" && (
                <Input
                  className="mt-2"
                  value={customDocumentType}
                  onChange={(e) => setCustomDocumentType(e.target.value)}
                  placeholder={t("athleteSpace.documents.customTypePlaceholder")}
                />
              )}
            </div>

            <div>
              <Label>{t("athleteSpace.documents.titleLabel")}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t("athleteSpace.documents.titlePlaceholder")}
              />
            </div>

            <div>
              <Label>{t("athleteSpace.documents.expiryDate")}</Label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("athleteSpace.documents.notes")}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t("athleteSpace.documents.notesPlaceholder")}
                rows={2}
              />
            </div>

            <Button
              onClick={() => addDocumentMutation.mutate()}
              disabled={isUploading || addDocumentMutation.isPending}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  {t("athleteSpace.documents.uploading")}
                </>
              ) : (
                t("athleteSpace.documents.submit")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingDoc}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDoc(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("athleteSpace.documents.editDocument")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("athleteSpace.documents.documentType")}</Label>
              <Select
                value={formData.document_type}
                onValueChange={(v) => {
                  setFormData({ ...formData, document_type: v });
                  if (v !== "custom") setCustomDocumentType("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((docType) => (
                    <SelectItem key={docType.value} value={docType.value}>{docType.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.document_type === "custom" && (
                <Input
                  className="mt-2"
                  value={customDocumentType}
                  onChange={(e) => setCustomDocumentType(e.target.value)}
                  placeholder={t("athleteSpace.documents.customTypePlaceholder")}
                />
              )}
            </div>

            <div>
              <Label>{t("athleteSpace.documents.titleLabel")}</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("athleteSpace.documents.expiryDate")}</Label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>

            <div>
              <Label>{t("athleteSpace.documents.notes")}</Label>
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
              {updateDocumentMutation.isPending ? t("athleteSpace.documents.saving") : t("athleteSpace.documents.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
