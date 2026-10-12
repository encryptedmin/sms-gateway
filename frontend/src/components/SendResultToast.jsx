import { Link } from "react-router-dom";
import { formatScheduleTime } from "../utils/schedule";

// Toast body for a successful send. `logsPath` is the role's SMS logs route.
export default function SendResultToast({ result, logsPath }) {
  if (result?.status === "scheduled") {
    return (
      <span>
        Scheduled {result.contacts} message(s) for {result.target} at{" "}
        {formatScheduleTime(result.scheduled_for)}.{" "}
        <Link
          to={`${logsPath}?status=SCHEDULED`}
          onClick={(event) => event.stopPropagation()}
          style={{ color: "var(--sg-signal-600)", fontWeight: 600 }}
        >
          View scheduled
        </Link>
      </span>
    );
  }

  return <span>Queued {result.contacts} message(s) for {result.target}.</span>;
}
