import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Phone, Mail, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

interface ContactsSectionProps {
  categoryId: string;
  players: { id: string; name: string }[] | undefined;
}

const CONTACT_TYPES = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Tuteur légal" },
  { value: "emergency", label: "Contact d'urgence" },
];

const RELATIONSHIPS = [
  { value: "pere", label: "Père" },
  { value: "mere", label: "Mère" },
  { value: "tuteur", label: "Tuteur" },
  { value: "grand_parent", label: "Grand-parent" },
  { value: "oncle_tante", label: "Oncle/Tante" },
  { value: "autre", label: "Autre" },
];

export function ContactsSection({ categoryId, players }: ContactsSectionProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [contactType, setContactType] = useState("parent");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: contacts } = useQuery({
    queryKey: ["player_contacts", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_contacts")
        .select("*, players(name)")
        .eq("category_id", categoryId)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addContact = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("player_contacts").insert({
        player_id: selectedPlayer,
        category_id: categoryId,
        contact_type: contactType,
        first_name: firstName,
        last_name: lastName,
        relationship: relationship || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        is_primary: isPrimary,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_contacts", categoryId] });
      toast.success("Contact ajouté");
      resetForm();
      setDialogOpen(false);
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("player_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player_contacts", categoryId] });
      toast.success("Contact supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const resetForm = () => {
    setSelectedPlayer("");
    setContactType("parent");
    setFirstName("");
    setLastName("");
    setRelationship("");
    setPhone("");
    setEmail("");
    setAddress("");
    setIsPrimary(false);
    setNotes("");
  };

  // Group contacts by player
  const contactsByPlayer = contacts?.reduce((acc, contact) => {
    const playerId = contact.player_id;
    if (!acc[playerId]) {
      acc[playerId] = { playerName: contact.players?.name || "", contacts: [] };
    }
    acc[playerId].contacts.push(contact);
    return acc;
  }, {} as Record<string, { playerName: string; contacts: typeof contacts }>);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contacts Parents / Tuteurs
              </CardTitle>
              <CardDescription>Informations de contact des familles et contacts d'urgence</CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!contacts || contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun contact enregistré.</p>
          ) : (
            <div className="space-y-6">
              {contactsByPlayer && Object.entries(contactsByPlayer).map(([playerId, { playerName, contacts: playerContacts }]) => (
                <div key={playerId} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-lg mb-3">{playerName}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playerContacts?.map((contact) => (
                      <div key={contact.id} className="border rounded-lg p-4 bg-muted/30 relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => deleteContact.mutate(contact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{contact.first_name} {contact.last_name}</span>
                          {contact.is_primary && <Badge className="bg-primary">Principal</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{RELATIONSHIPS.find((r) => r.value === contact.relationship)?.label || contact.relationship}</p>
                          {contact.phone && (
                            <p className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                            </p>
                          )}
                          {contact.email && (
                            <p className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
                            </p>
                          )}
                          {contact.address && (
                            <p className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              {contact.address}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Joueur</Label>
              <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un joueur" /></SelectTrigger>
                <SelectContent>
                  {players?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de contact</Label>
                <Select value={contactType} onValueChange={setContactType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Relation</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Téléphone</Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" />
              </div>
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 rue de la Paix, 75001 Paris" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="primary" checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} />
              <Label htmlFor="primary" className="cursor-pointer">Contact principal</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informations complémentaires..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => addContact.mutate()} disabled={!selectedPlayer || !firstName || !lastName}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}