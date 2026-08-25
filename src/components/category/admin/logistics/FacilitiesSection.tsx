import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Clock, Calendar, MapPin, Users, Trash2 } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface FacilitiesSectionProps {
  categoryId: string;
}

interface Facility {
  id: string;
  name: string;
  type: string;
  capacity: number | null;
  location: string | null;
}

interface Booking {
  id: string;
  facility_id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  facilities?: Facility;
}

const getFacilityTypes = () => [
  { value: "field", label: i18n.t("adminRecruitDocs.logistics.facilities.types.field") },
  { value: "gym", label: i18n.t("adminRecruitDocs.logistics.facilities.types.gym") },
  { value: "pool", label: i18n.t("adminRecruitDocs.logistics.facilities.types.pool") },
  { value: "meeting_room", label: i18n.t("adminRecruitDocs.logistics.facilities.types.meetingRoom") },
  { value: "video_room", label: i18n.t("adminRecruitDocs.logistics.facilities.types.videoRoom") },
  { value: "medical_room", label: i18n.t("adminRecruitDocs.logistics.facilities.types.medicalRoom") },
  { value: "other", label: i18n.t("adminRecruitDocs.logistics.facilities.types.other") },
];

export function FacilitiesSection({ categoryId }: FacilitiesSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddFacilityDialog, setShowAddFacilityDialog] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const [facilityForm, setFacilityForm] = useState({
    name: "",
    type: "field",
    capacity: "",
    location: "",
  });

  const [bookingForm, setBookingForm] = useState({
    facility_id: "",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00",
    end_time: "10:00",
    title: "",
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facilities" as any)
        .select("*")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data as unknown as Facility[];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["facility-bookings", categoryId, format(currentWeekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const { data, error } = await supabase
        .from("facility_bookings" as any)
        .select("*, facilities(*)")
        .eq("category_id", categoryId)
        .gte("date", format(currentWeekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date")
        .order("start_time");
      if (error) throw error;
      return data as unknown as Booking[];
    },
  });

  const addFacilityMutation = useMutation({
    mutationFn: async (data: typeof facilityForm) => {
      const { error } = await supabase.from("facilities" as any).insert({
        category_id: categoryId,
        name: data.name,
        type: data.type,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        location: data.location || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities", categoryId] });
      setShowAddFacilityDialog(false);
      setFacilityForm({ name: "", type: "field", capacity: "", location: "" });
      toast({ title: t("adminRecruitDocs.logistics.facilities.toasts.facilityAdded") });
    },
  });

  const addBookingMutation = useMutation({
    mutationFn: async (data: typeof bookingForm) => {
      const { error } = await supabase.from("facility_bookings" as any).insert({
        category_id: categoryId,
        created_by: user?.id,
        facility_id: data.facility_id,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        title: data.title,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facility-bookings"] });
      setShowBookingDialog(false);
      setBookingForm({ facility_id: "", date: format(new Date(), "yyyy-MM-dd"), start_time: "09:00", end_time: "10:00", title: "" });
      toast({ title: t("adminRecruitDocs.logistics.facilities.toasts.bookingCreated") });
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facility_bookings" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facility-bookings"] });
      toast({ title: t("adminRecruitDocs.logistics.facilities.toasts.bookingDeleted") });
    },
  });

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  const getBookingsForDay = (date: Date) =>
    bookings?.filter((b) => isSameDay(new Date(b.date), date)) || [];

  return (
    <div className="space-y-6">
      {/* Liste des infrastructures */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("adminRecruitDocs.logistics.facilities.title")}</h3>
        <div className="flex gap-2">
          <Dialog open={showAddFacilityDialog} onOpenChange={setShowAddFacilityDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("adminRecruitDocs.logistics.facilities.addFacility")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("adminRecruitDocs.logistics.facilities.newFacility")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("adminRecruitDocs.logistics.facilities.name")}</Label>
                  <Input
                    value={facilityForm.name}
                    onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                    placeholder={t("adminRecruitDocs.logistics.facilities.namePlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("adminRecruitDocs.logistics.facilities.type")}</Label>
                  <Select value={facilityForm.type} onValueChange={(v) => setFacilityForm({ ...facilityForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getFacilityTypes().map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("adminRecruitDocs.logistics.facilities.capacity")}</Label>
                    <Input
                      type="number"
                      value={facilityForm.capacity}
                      onChange={(e) => setFacilityForm({ ...facilityForm, capacity: e.target.value })}
                      placeholder={t("adminRecruitDocs.logistics.facilities.capacityPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label>{t("adminRecruitDocs.logistics.facilities.localisation")}</Label>
                    <Input
                      value={facilityForm.location}
                      onChange={(e) => setFacilityForm({ ...facilityForm, location: e.target.value })}
                      placeholder={t("adminRecruitDocs.logistics.facilities.localisationPlaceholder")}
                    />
                  </div>
                </div>
                <Button onClick={() => addFacilityMutation.mutate(facilityForm)} disabled={!facilityForm.name} className="w-full">
                  {t("adminRecruitDocs.logistics.facilities.add")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                {t("adminRecruitDocs.logistics.facilities.book")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("adminRecruitDocs.logistics.facilities.newBooking")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("adminRecruitDocs.logistics.facilities.facility")}</Label>
                  <Select value={bookingForm.facility_id} onValueChange={(v) => setBookingForm({ ...bookingForm, facility_id: v })}>
                    <SelectTrigger><SelectValue placeholder={t("adminRecruitDocs.logistics.facilities.selectPlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      {facilities?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("adminRecruitDocs.logistics.facilities.date")}</Label>
                  <Input
                    type="date"
                    value={bookingForm.date}
                    onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("adminRecruitDocs.logistics.facilities.start")}</Label>
                    <Input
                      type="time"
                      value={bookingForm.start_time}
                      onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("adminRecruitDocs.logistics.facilities.end")}</Label>
                    <Input
                      type="time"
                      value={bookingForm.end_time}
                      onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("adminRecruitDocs.logistics.facilities.reason")}</Label>
                  <Input
                    value={bookingForm.title}
                    onChange={(e) => setBookingForm({ ...bookingForm, title: e.target.value })}
                    placeholder={t("adminRecruitDocs.logistics.facilities.reasonPlaceholder")}
                  />
                </div>
                <Button
                  onClick={() => addBookingMutation.mutate(bookingForm)}
                  disabled={!bookingForm.facility_id || !bookingForm.title}
                  className="w-full"
                >
                  {t("adminRecruitDocs.logistics.facilities.book")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grille des infrastructures */}
      {facilities && facilities.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((facility) => (
            <Card key={facility.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{facility.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {getFacilityTypes().find((t) => t.value === facility.type)?.label}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                  {facility.capacity && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {facility.capacity}
                    </span>
                  )}
                  {facility.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {facility.location}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("adminRecruitDocs.logistics.facilities.noFacility")}</p>
            <Button variant="link" onClick={() => setShowAddFacilityDialog(true)}>
              {t("adminRecruitDocs.logistics.facilities.addFacilityLink")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Calendrier des réservations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t("adminRecruitDocs.logistics.facilities.weekPlanning")}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
              {t("adminRecruitDocs.logistics.facilities.previousWeek")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
              {t("adminRecruitDocs.logistics.facilities.nextWeek")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="min-h-[120px]">
              <div className={`text-center p-2 rounded-t-lg font-medium text-sm ${isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div>{format(day, "EEE", { locale: getDateLocale() })}</div>
                <div className="text-xs">{format(day, "d MMM", { locale: getDateLocale() })}</div>
              </div>
              <div className="border rounded-b-lg p-1 space-y-1 min-h-[80px]">
                {getBookingsForDay(day).map((booking) => (
                  <div
                    key={booking.id}
                    className="text-xs p-1.5 rounded bg-primary/10 border border-primary/20 group relative"
                  >
                    <div className="font-medium truncate">{booking.title}</div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                    </div>
                    <div className="text-muted-foreground truncate">{booking.facilities?.name}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteBookingMutation.mutate(booking.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
