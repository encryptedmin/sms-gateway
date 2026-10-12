import SmsLogsPageContent from "../../../components/SmsLogsPageContent";

export default function SmsLogsPage() {
  return (
    <SmsLogsPageContent
      autoRefreshId="instructor-auto-refresh-toggle"
      description="Every SMS you've sent through the gateway."
    />
  );
}
