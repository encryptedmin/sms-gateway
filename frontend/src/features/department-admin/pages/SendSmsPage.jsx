import { useEffect, useState } from "react";
import { listContacts } from "../../../api/contactsService";
import { listContactGroups } from "../../../api/contactGroupsService";
import { listMessageTemplates } from "../../../api/messageTemplatesService";
import { sendDepartmentSms } from "../../../api/departmentSmsService";
import { useToast } from "../../../context/ToastContext";
import SendSmsForm from "../components/SendSmsForm";

function extractErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.error) return data.error;
  return "Couldn't send this message. Check your target and try again.";
}

export default function SendSmsPage() {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [contactData, groupData, templateData] = await Promise.all([
        listContacts({ active: true }),
        listContactGroups(),
        listMessageTemplates(),
      ]);
      setContacts(contactData);
      setGroups(groupData);
      setTemplates(templateData);
    } catch {
      showToast("Couldn't load contacts, groups, or templates.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(payload) {
    setIsSubmitting(true);
    try {
      const result = await sendDepartmentSms(payload);
      showToast(`Queued ${result.contacts} message(s) for ${result.target}.`);
      return true;
    } catch (error) {
      showToast(extractErrorMessage(error), "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="sg-panel">
          <div className="sg-panel-header">
            <div>
              <h2 className="sg-panel-title">Send SMS</h2>
              <div className="sg-panel-subtitle">
                Message a single contact, or an entire contact group.
              </div>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Loading…</span>
                </div>
              </div>
            ) : (
              <SendSmsForm
                contacts={contacts}
                groups={groups}
                templates={templates}
                onSend={handleSend}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-5">
        <div className="sg-panel p-4" style={{ fontSize: "0.88rem", color: "var(--sg-text-500)" }}>
          <i className="bi bi-info-circle me-2" style={{ color: "var(--sg-signal-600)" }}></i>
          Only active contacts receive messages. Inactive contacts are skipped
          automatically by the gateway.
          <hr />
          Messages are queued immediately and processed by the gateway in the
          background — check the <strong>SMS Logs</strong> page to confirm delivery.
        </div>
      </div>
    </div>
  );
}