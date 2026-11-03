import OrganizationProvider from "@/app/ui/dashboard/organization-context";
import PayslipRunProvider from "@/app/ui/dashboard/payslip-run-context";
import Sidebar from "@/app/ui/dashboard/sidebar";
import Topbar from "@/app/ui/dashboard/topbar";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <OrganizationProvider>
      <PayslipRunProvider>
        <div className="flex min-h-dvh flex-col bg-navy md:flex-row print:bg-white">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 bg-[#f5f7fa] p-4 print:bg-white print:p-0">
              {children}
            </main>
          </div>
        </div>
      </PayslipRunProvider>
    </OrganizationProvider>
  );
}
