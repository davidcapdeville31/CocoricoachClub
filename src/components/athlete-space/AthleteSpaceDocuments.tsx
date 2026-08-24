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
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { useTranslation } from "react-i18next";

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

  const { data: teamDocuments, isLoading: teamLoading } = useQuery({
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

  const { data: personalDocuments, isLoading: personalLoading } = useQuery({
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
    const date = format(new Date(doc.created_at), "dd/MM/yyyy", { locale: fr });

    if (!name && role === "legacy") {
      return (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <UserCircle className="h-3 w-3" />
          {t("athleteSpace.documents.unspecifiedAuthor", { date })}
        </p>
      );
    }
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
        <UserCircle className="h-3 w-3" />
        {t("athleteSpace.documents.addedBy", { name: name || t("athleteSpace.documents.addedByFallbackUser") })}
        {roleLabel ? ` (${roleLabel})` : ""} le {date}
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
    emptyMessage: string,
  ) => {
    if (isLoading) return <Skeleton className="h-32 w-full" />;
    if (!documents || documents.length === 0) {
      return <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>;
    }

    return (
      <div className="space-y-3">
        {documents.map((doc: any) => (
          <Card key={doc.id} className="bg-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {getFileIcon(doc.file_url)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {getDocTypeLabel(doc.document_type)}
                      </Badge>
                      {doc.original_filename && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {doc.original_filename}
                        </span>
                      )}
                      {doc.expiry_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t("athleteSpace.documents.expiresOn", { date: format(new Date(doc.expiry_date), "dd MMM yyyy", { locale: fr }) })}
                        </span>
                      )}
                    </div>
                    {doc.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.notes}</p>
                    )}
                    {renderAuthorLine(doc)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {doc.file_url && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(doc.file_url)}
                        title={t("athleteSpace.documents.view")}
                      >
                        <Eye className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">{t("athleteSpace.documents.view")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc.file_url, doc.title)}
                      >
                        <Download className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">{t("athleteSpace.documents.download")}</span>
                      </Button>
                    </>
                  )}
                  {canEdit(doc) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(doc)}
                      title={t("athleteSpace.documents.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete(doc) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
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
    <div className="space-y-4">
      <Tabs defaultValue="personal" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList
            className="grid grid-cols-2 bg-muted/40 rounded-xl p-1 sm:w-auto"
            style={{ ["--tab-accent" as any]: NAV_COLORS.admin.base }}
          >
            <TabsTrigger
              value="personal"
              className="gap-1.5 rounded-lg font-semibold transition-all data-[state=active]:bg-[var(--tab-accent)] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <User className="h-3.5 w-3.5" />
              {t("athleteSpace.documents.myDocuments", { count: personalDocuments?.length || 0 })}
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="gap-1.5 rounded-lg font-semibold transition-all data-[state=active]:bg-[var(--tab-accent)] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Users className="h-3.5 w-3.5" />
              {t("athleteSpace.documents.teamDocuments", { count: teamDocuments?.length || 0 })}
            </TabsTrigger>
          </TabsList>

          <Button
            onClick={() => {
              resetForm();
              setShowAddDialog(true);
            }}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("athleteSpace.documents.addDocument")}
          </Button>
        </div>

        <TabsContent value="personal" className="mt-4">
          {renderDocumentList(personalDocuments, personalLoading, t("athleteSpace.documents.noPersonalDocuments"))}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {renderDocumentList(teamDocuments, teamLoading, t("athleteSpace.documents.noTeamDocuments"))}
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
                  <SelectItem value="personal">{t("athleteSpace.documents.visibilityPersonal")}</SelectItem>
                  <SelectItem value="team">{t("athleteSpace.documents.visibilityTeam")}</SelectItem>
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
