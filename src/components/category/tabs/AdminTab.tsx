import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardCheck, Users, UserSearch, FolderOpen, BarChart3, Trophy } from "lucide-react";
import { AttendanceTab } from "@/components/category/attendance/AttendanceTab";
import { MatchAttendanceTab } from "@/components/category/attendance/MatchAttendanceTab";
import { CategoryCollaborationTab } from "@/components/category/CategoryCollaborationTab";


import { RecruitmentSection } from "@/components/category/admin/RecruitmentSection";
import { DocumentsSection } from "@/components/category/admin/DocumentsSection";

import { ReportsTab } from "@/components/category/ReportsTab";
import { ColoredSubTabsList, ColoredSubTabsTrigger } from "@/components/ui/colored-subtabs";
import { SeasonRosterFilterToggle } from "@/components/category/SeasonRosterFilterToggle";

interface AdminTabProps {
  categoryId: string;
}

export function AdminTab({ categoryId }: AdminTabProps) {
  return (
    <Tabs defaultValue="attendance" className="space-y-4">
      <div className="flex justify-end">
        <SeasonRosterFilterToggle />
      </div>

      <div className="flex justify-center overflow-x-auto -mx-4 px-4 pb-2">
        <ColoredSubTabsList colorKey="admin" className="inline-flex w-max">
          <ColoredSubTabsTrigger 
            value="attendance" 
            colorKey="admin"
            icon={<ClipboardCheck className="h-4 w-4" />}
            tooltip={t("subnav.admin.attendanceTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.admin.attendance")}</span>
            <span className="sm:hidden">{t("subnav.admin.attendanceShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger
            value="match_attendance"
            colorKey="admin"
            icon={<Trophy className="h-4 w-4" />}
            tooltip={t("subnav.admin.matchAttendanceTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.admin.matchAttendance")}</span>
            <span className="sm:hidden">{t("subnav.admin.matchAttendanceShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 

            value="recruitment" 
            colorKey="admin"
            icon={<UserSearch className="h-4 w-4" />}
            tooltip={t("subnav.admin.recruitmentTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.admin.recruitment")}</span>
            <span className="sm:hidden">{t("subnav.admin.recruitmentShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="documents" 
            colorKey="admin"
            icon={<FolderOpen className="h-4 w-4" />}
            tooltip={t("subnav.admin.documentsTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.admin.documents")}</span>
            <span className="sm:hidden">{t("subnav.admin.documentsShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="reports" 
            colorKey="admin"
            icon={<BarChart3 className="h-4 w-4" />}
            tooltip={t("subnav.admin.reportsTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.admin.reports")}</span>
            <span className="sm:hidden">{t("subnav.admin.reportsShort")}</span>
          </ColoredSubTabsTrigger>
          <ColoredSubTabsTrigger 
            value="staff" 
            colorKey="admin"
            icon={<Users className="h-4 w-4" />}
            tooltip={t("subnav.admin.staffTooltip")}
          >
            <span className="hidden sm:inline">{t("subnav.admin.staff")}</span>
            <span className="sm:hidden">{t("subnav.admin.staffShort")}</span>
          </ColoredSubTabsTrigger>
        </ColoredSubTabsList>
      </div>

      <TabsContent value="attendance">
        <AttendanceTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="match_attendance">
        <MatchAttendanceTab categoryId={categoryId} />
      </TabsContent>



      <TabsContent value="recruitment">
        <RecruitmentSection categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="documents">
        <DocumentsSection categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="reports">
        <ReportsTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="staff">
        <CategoryCollaborationTab categoryId={categoryId} />
      </TabsContent>
    </Tabs>
  );
}