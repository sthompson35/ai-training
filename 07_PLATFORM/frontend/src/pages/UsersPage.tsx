import React, { useEffect, useState } from "react";
import {
  USER_ROLES,
  User,
  UserInput,
  UserRole,
  bulkDeleteUsers,
  bulkUpdateUserRole,
  createUser,
  deleteUser,
  exportUsersCsv,
  getStoredUsername,
  importUsersCsv,
  linkUserIdentity,
  listUsers,
  resetUserPassword,
  updateUserRole,
} from "../lib/api";
import { UserForm } from "../components/UserForm";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { BulkEditButton } from "../components/BulkEditButton";
import { IdentityPicker } from "../components/IdentityPicker";
import { useSelection } from "../hooks/useSelection";
import { usePendingDeletes } from "../hooks/usePendingDeletes";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

const ROLE_OPTIONS = USER_ROLES.map((role) => ({ value: role, label: role }));

export function UsersPage(): React.ReactElement {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selection = useSelection<number>();
  const pending = usePendingDeletes<number>();
  const toast = useToast();
  const [linkingUserId, setLinkingUserId] = useState<number | null>(null);
  const [linkIdentifier, setLinkIdentifier] = useState("");
  const [linking, setLinking] = useState(false);

  function refresh(): void {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }

  useEffect(refresh, []);

  async function handleCreate(payload: UserInput): Promise<void> {
    try {
      await createUser(payload);
      refresh();
      toast.success("User created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  async function handleRoleChange(userId: number, role: UserRole): Promise<void> {
    try {
      await updateUserRole(userId, role);
      refresh();
      toast.success("Role updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  function handleDelete(userId: number): void {
    if (!window.confirm("Delete this user?")) return;
    pending.add(userId);
    const timeoutId = setTimeout(async () => {
      try {
        await deleteUser(userId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete user");
      } finally {
        pending.remove(userId);
      }
    }, UNDO_WINDOW_MS);
    toast.success("User deleted.", {
      label: "Undo",
      onClick: () => {
        clearTimeout(timeoutId);
        pending.remove(userId);
      },
    });
  }

  async function handleLinkIdentity(userId: number): Promise<void> {
    if (!linkIdentifier.trim()) return;
    setLinking(true);
    try {
      await linkUserIdentity(userId, linkIdentifier.trim());
      refresh();
      toast.success("Identity linked.");
      setLinkingUserId(null);
      setLinkIdentifier("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link identity");
    } finally {
      setLinking(false);
    }
  }

  async function handleResetPassword(username: string, userId: number): Promise<void> {
    const newPassword = window.prompt(`New password for ${username}:`);
    if (!newPassword) return;
    try {
      await resetUserPassword(userId, newPassword);
      toast.success("Password reset.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    }
  }

  if (error) return <p role="alert">{error}</p>;
  if (!users) return <p>Loading users…</p>;

  const currentUsername = getStoredUsername();
  const visibleUsers = users.filter((user) => !pending.isPending(user.id));

  return (
    <>
      <h1>Users</h1>
      <p>Admin-only: create accounts, change roles, and remove access.</p>
      <button onClick={() => exportUsersCsv()}>Export CSV</button>
      <ImportCsvButton onImport={importUsersCsv} onComplete={refresh} />
      <BulkDeleteButton
        selectedIds={[...selection.selected]}
        onBulkDelete={bulkDeleteUsers}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />
      <BulkEditButton
        selectedIds={[...selection.selected]}
        options={ROLE_OPTIONS}
        fieldLabel="role"
        onBulkUpdate={bulkUpdateUserRole}
        onComplete={() => {
          selection.clear();
          refresh();
        }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
            <th scope="col">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={visibleUsers.every((user) => selection.isSelected(user.id))}
                onChange={(e) =>
                  e.target.checked ? selection.selectAll(visibleUsers.map((user) => user.id)) : selection.clear()
                }
              />
            </th>
            <th scope="col">Username</th>
            <th scope="col">Role</th>
            <th scope="col">Identity</th>
            <th scope="col">Created</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          {visibleUsers.map((user) => (
            <tr key={user.id} style={{ borderBottom: "1px solid var(--color-border-faint)" }}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Select ${user.username}`}
                  checked={selection.isSelected(user.id)}
                  onChange={() => selection.toggle(user.id)}
                />
              </td>
              <td>
                {user.username}
                {user.username === currentUsername && " (you)"}
              </td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {user.service_member_id ?? "—"}
                {linkingUserId === user.id ? (
                  <div style={{ marginTop: 4 }}>
                    <IdentityPicker label="Identifier" value={linkIdentifier} onChange={setLinkIdentifier} />
                    <button onClick={() => handleLinkIdentity(user.id)} disabled={linking} style={{ marginRight: 8 }}>
                      {linking ? "Linking…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkingUserId(null);
                        setLinkIdentifier("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => {
                      setLinkingUserId(user.id);
                      setLinkIdentifier("");
                    }}
                  >
                    Link identity
                  </button>
                )}
              </td>
              <td>{new Date(user.created_at).toLocaleString()}</td>
              <td>
                <button onClick={() => handleResetPassword(user.username, user.id)}>Reset Password</button>
                <button onClick={() => handleDelete(user.id)} style={{ marginLeft: 8 }}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add user</h2>
      <UserForm submitLabel="Create user" onSubmit={handleCreate} />
    </>
  );
}
