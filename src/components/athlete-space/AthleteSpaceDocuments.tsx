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
import { FileText, File, Image, Download, Users, User, Calendar, Plus, Upload, Trash2, UserCircle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";

interface AthleteSpaceDocumentsProps {
  playerId: string;
  categoryId: string;
  /** "athlete" when used in the athlete portal, "staff" when used in the coach view of a player profile */
  viewerMode?: "athlete" | "staff";
}

const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "license", label: "Licence sportive" },
  { value: "medical_certificate", label: "Certificat médical" },
  { value: "medical_return_training", label: "Certificat de reprise à l'entraînement" },
  { value: "medical_return_competition", label: "Certificat de reprise à la compétition" },
  { value: "identity", label: "Pièce d'identité" },
  { value: "contract", label: "Contrat" },
  { value: "insurance", label: "Assurance" },
  { value: "parental_authorization", label: "Autorisation parentale" },
  { value: "image_rights", label: "Droit à l'image" },
  { value: "custom", label: "Autre (personnalisé)" },
];

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.bmp,.tiff,.tif";
const MAX_FILE_SIZE_MB = 10;

const ROLE_LABEL: Record<string, string> = {
  athlete: "Athlète",
  staff: "Coach",
  coach: "Coach",
  admin: "Admin",
  legacy: "Auteur non renseigné",
};

function getFileIcon(url: string | null) {
  if (!url) return <FileText className="h-5 w-5 text-muted-foreground" />;
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <File className="h-5 w-5 text-destructive" />;
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "heic"].includes(ext || ""))
    return <Image className="h-5 w-5 text-primary" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function AthleteSpaceDocuments({ playerId, categoryId, viewerMode = "athlete" }: AthleteSpaceDocumentsProps) {
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
      if (!user?.id) throw new Error("Non authentifié");
      if (!selectedFile) throw new Error("Fichier requis");
      if (!formData.title.trim()) throw new Error("Titre requis");
      if (formData.document_type === "custom" && !customDocumentType.trim())
        throw new Error("Nom du type requis");

      setIsUploading(true);
      const fileUrl = await uploadFile(selectedFile);

      const { error } = await supabase.from("admin_documents" as any).insert({
        category_id: categoryId,
        player_id: playerId,
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
      setShowAddDialog(false);
      resetForm();
      toast.success("Document ajouté");
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'ajout"),
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
      toast.success("Document supprimé");
    },
    onError: (e: any) => toast.error(e.message || "Suppression impossible"),
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async () => {
      if (!editingDoc) throw new Error("Document introuvable");
      if (viewerMode !== "staff") throw new Error("Modification réservée au staff");
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
      queryClient.invalidateQueries({ queryKey: ["athlete-personal-documents", categoryId, playerId] });
      queryClient.invalidateQueries({ queryKey: ["athlete-team-documents", categoryId] });
      setEditingDoc(null);
      resetForm();
      toast.success("Document modifié");
    },
    onError: (e: any) => toast.error(e.message || "Modification impossible"),
  });

  const resetForm = () => {
    setFormData({ document_type: "license", title: "", expiry_date: "", notes: "" });
    setCustomDocumentType("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)`);
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
      toast.error("Erreur lors du téléchargement");
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
          Auteur non renseigné · Ajouté le {date}
        </p>
      );
    }
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
        <UserCircle className="h-3 w-3" />
        Ajouté par {name || "Utilisateur"}
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
                          Expire le {format(new Date(doc.expiry_date), "dd MMM yyyy", { locale: fr })}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc.file_url, doc.title)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Télécharger</span>
                    </Button>
                  )}
                  {canEdit(doc) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(doc)}
                      title="Modifier"
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
                        if (confirm("Supprimer ce document ?")) deleteDocumentMutation.mutate(doc);
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
              Mes documents ({personalDocuments?.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="gap-1.5 rounded-lg font-semibold transition-all data-[state=active]:bg-[var(--tab-accent)] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Users className="h-3.5 w-3.5" />
              Documents d'équipe ({teamDocuments?.length || 0})
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
            Ajouter un document
          </Button>
        </div>

        <TabsContent value="personal" className="mt-4">
          {renderDocumentList(personalDocuments, personalLoading, "Aucun document personnel")}
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          {renderDocumentList(teamDocuments, teamLoading, "Aucun document d'équipe")}
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
            <DialogTitle>Nouveau document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fichier (PDF, image) *</Label>
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
                    <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier</p>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG, PNG, WEBP, GIF • Max {MAX_FILE_SIZE_MB} Mo
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label>Type de document *</Label>
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
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.document_type === "custom" && (
                <Input
                  className="mt-2"
                  value={customDocumentType}
                  onChange={(e) => setCustomDocumentType(e.target.value)}
                  placeholder="Nom du type personnalisé"
                />
              )}
            </div>

            <div>
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Licence 2024-2025"
              />
            </div>

            <div>
              <Label>Date d'expiration</Label>
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
                placeholder="Notes additionnelles..."
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
                  Envoi en cours...
                </>
              ) : (
                "Ajouter"
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
            <DialogTitle>Modifier le document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type de document *</Label>
              <Select
                value={formData.document_type}
                onValueChange={(v) => {
                  setFormData({ ...formData, document_type: v });
                  if (v !== "custom") setCustomDocumentType("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.document_type === "custom" && (
                <Input
                  className="mt-2"
                  value={customDocumentType}
                  onChange={(e) => setCustomDocumentType(e.target.value)}
                  placeholder="Nom du type personnalisé"
                />
              )}
            </div>

            <div>
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <Label>Date d'expiration</Label>
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
              {updateDocumentMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
