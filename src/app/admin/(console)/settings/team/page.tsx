"use client";
import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminEmpty,
  AdminSelect,
  AdminTable,
  AdminTextField,
} from "@/components/admin/data-table";
import { roleOptions } from "@/lib/roles";
import { ageLabel, formatDate, plural } from "@/lib/format";
import type { AdminRole } from "@/lib/types";
const roleSelectOptions = roleOptions.map((role) => ({
  value: role,
  label: role,
}));
const statusOptions = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "suspended", label: "Suspended" },
];
type MemberStatus = "active" | "invited" | "suspended";
/**
 * Console team roster. Role and status edits apply per row; the add form
 * creates an invited member. Roles are enforced by the server for verified active accounts.
 */
export default function AdminTeamSettingsPage() {
  const { state, actions } = useDemo();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("Support");
  const [error, setError] = useState("");
  const members = state.team;
  const activeCount = members.filter(
    (member) => member.status === "active",
  ).length;
  const invitedCount = members.filter(
    (member) => member.status === "invited",
  ).length;
  async function changeRole(id: string, memberName: string, value: string) {
    try {
      const nextRole = value as AdminRole;
      await actions.updateTeamMember(id, { role: nextRole });
      actions.notify(`${memberName} is now recorded as ${nextRole}`);
    } catch (error) {}
  }
  async function changeStatus(id: string, memberName: string, value: string) {
    try {
      const nextStatus = value as MemberStatus;
      await actions.updateTeamMember(id, { status: nextStatus });
      actions.notify(`${memberName} set to ${nextStatus}`);
    } catch (error) {}
  }
  async function handleAdd(event: React.FormEvent) {
    try {
      event.preventDefault();
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      if (!trimmedName) {
        setError("Enter the team member's name.");
        return;
      }
      if (!trimmedEmail.includes("@")) {
        setError("Enter a valid email address.");
        return;
      }
      await actions.addTeamMember({
        name: trimmedName,
        email: trimmedEmail,
        role,
        status: "invited",
        lastActive: "",
      });
      actions.notify(`${trimmedName} added to the team`);
      setName("");
      setEmail("");
      setRole("Support");
      setError("");
    } catch (error) {}
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Settings · Team"
        title="Team & access"
        description={`${plural(members.length, "member")} · ${activeCount} active · ${invitedCount} invited · authorized operators`}
        action={
          <Link className="admin-btn ghost" href="/admin/settings">
            All settings
          </Link>
        }
      />

      <div className="admin-notice">
        Roles are enforced by the server. Invite a member, ask them to verify
        their account, then activate their access. Only super administrators can
        change team access.
      </div>

      <div
        className="admin-panels"
        style={{ marginTop: "1rem", alignItems: "start" }}
      >
        <section className="admin-card">
          <h3>Roster</h3>
          <p>Role and status changes apply immediately to this roster.</p>

          {members.length === 0 ? (
            <AdminEmpty
              title="No team members"
              hint="Invite a verified operator below."
            />
          ) : (
            <AdminTable
              template="1.1fr 1.3fr 1.1fr .9fr .9fr"
              head={["Name", "Email", "Role", "Status", "Last active"]}
              caption="Console team members with editable role and status"
            >
              {members.map((member) => (
                <div className="table-row" key={member.id}>
                  <span style={{ fontWeight: 700 }}>{member.name}</span>
                  <span
                    style={{ color: "var(--muted)", overflowWrap: "anywhere" }}
                  >
                    {member.email}
                  </span>
                  <AdminSelect
                    label={`Role for ${member.name}`}
                    value={member.role}
                    options={roleSelectOptions}
                    onChange={(value) =>
                      changeRole(member.id, member.name, value)
                    }
                  />
                  <AdminSelect
                    label={`Status for ${member.name}`}
                    value={member.status}
                    options={statusOptions}
                    onChange={(value) =>
                      changeStatus(member.id, member.name, value)
                    }
                  />
                  <span style={{ color: "var(--muted)" }}>
                    {member.lastActive
                      ? `${formatDate(member.lastActive, false)} · ${ageLabel(member.lastActive)}`
                      : "Invited"}
                  </span>
                </div>
              ))}
            </AdminTable>
          )}
        </section>

        <section className="admin-card">
          <h2>Add team member</h2>
          <p>
            New operators are created with an invited status and no last-active
            date.
          </p>

          <form onSubmit={handleAdd} noValidate>
            <div className="form-grid" style={{ marginTop: "1rem" }}>
              <AdminTextField
                label="Full name"
                value={name}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Bola Adebayo"
              />
              <AdminTextField
                label="Email"
                type="email"
                value={email}
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
              <label className="admin-field wide">
                Role
                <AdminSelect
                  label="Role"
                  value={role}
                  options={roleSelectOptions}
                  onChange={(value) => setRole(value as AdminRole)}
                />
                <small>Controls access to store operations.</small>
              </label>
            </div>

            {error ? (
              <div
                className="admin-note"
                style={{ marginTop: ".8rem" }}
                role="alert"
              >
                {error}
              </div>
            ) : null}

            <div className="form-actions">
              <button type="submit" className="primary">
                Add team member
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
