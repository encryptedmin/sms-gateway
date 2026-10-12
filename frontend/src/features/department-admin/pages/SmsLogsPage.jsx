import SmsLogsPageContent from "../../../components/SmsLogsPageContent";

export default function SmsLogsPage() {
  return (
    <SmsLogsPageContent
      autoRefreshId="dept-auto-refresh-toggle"
      description="Every SMS sent through the ITE Department — instructors, contacts, and groups."
    />
  );
}
