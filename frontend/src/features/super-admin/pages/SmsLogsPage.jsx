import SmsLogsPageContent from "../../../components/SmsLogsPageContent";

export default function SmsLogsPage() {
  return (
    <SmsLogsPageContent
      autoRefreshId="super-admin-auto-refresh-toggle"
      description="Every SMS queued through the gateway, newest first."
    />
  );
}
