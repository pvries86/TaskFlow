import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { ApiToken, CreatedApiToken, createApiToken, createUser, deleteApiToken, deleteUser, listApiTokens, listUsers, updateUser } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';

type EditableUser = UserProfile & {
  dirty?: boolean;
  saving?: boolean;
  deleting?: boolean;
};

export function UserManagement() {
  const [users, setUsers] = useState<EditableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    role: 'user' as UserProfile['role'],
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [newTokenName, setNewTokenName] = useState('Integration token');
  const [creatingToken, setCreatingToken] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [deletingTokenId, setDeletingTokenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listUsers()
      .then((items) => {
        if (!cancelled) setUsers(items);
      })
      .catch((error) => {
        console.error('Failed to load users', error);
        toast.error('Failed to load users');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    listApiTokens()
      .then((items) => {
        if (!cancelled) setApiTokens(items);
      })
      .catch((error) => {
        console.error('Failed to load API tokens', error);
        toast.error('Failed to load API tokens');
      })
      .finally(() => {
        if (!cancelled) setLoadingTokens(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query),
    );
  }, [search, users]);

  const updateDraft = (uid: string, patch: Partial<EditableUser>) => {
    setUsers((current) =>
      current.map((user) => (user.uid === uid ? { ...user, ...patch, dirty: true } : user)),
    );
  };

  const saveUser = async (user: EditableUser) => {
    setUsers((current) =>
      current.map((item) => (item.uid === user.uid ? { ...item, saving: true } : item)),
    );
    try {
      const updated = await updateUser(user.uid, {
        displayName: user.displayName,
        role: user.role,
        photoURL: user.photoURL,
      });
      setUsers((current) =>
        current.map((item) =>
          item.uid === user.uid ? { ...updated, dirty: false, saving: false } : item,
        ),
      );
      toast.success(`Updated ${updated.displayName}`);
    } catch (error) {
      console.error('Failed to save user', error);
      setUsers((current) =>
        current.map((item) => (item.uid === user.uid ? { ...item, saving: false } : item)),
      );
      toast.error(`Failed to update ${user.displayName}`);
    }
  };

  const removeUser = async (user: EditableUser) => {
    const confirmed = window.confirm(`Delete ${user.displayName} (${user.email})?`);
    if (!confirmed) return;

    setUsers((current) =>
      current.map((item) => (item.uid === user.uid ? { ...item, deleting: true } : item)),
    );

    try {
      await deleteUser(user.uid);
      setUsers((current) => current.filter((item) => item.uid !== user.uid));
      toast.success(`Deleted ${user.displayName}`);
    } catch (error: any) {
      console.error('Failed to delete user', error);
      setUsers((current) =>
        current.map((item) => (item.uid === user.uid ? { ...item, deleting: false } : item)),
      );
      toast.error(error?.message || `Failed to delete ${user.displayName}`);
    }
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingUser(true);
    try {
      const created = await createUser(newUser);
      setUsers((current) =>
        [...current, created].sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email)),
      );
      setNewUser({ email: '', displayName: '', role: 'user' });
      toast.success(`Created ${created.displayName}`);
    } catch (error: any) {
      console.error('Failed to create user', error);
      toast.error(error?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreateToken = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingToken(true);
    try {
      const created = await createApiToken(newTokenName);
      setApiTokens((current) => [created, ...current]);
      setCreatedToken(created);
      setNewTokenName('Integration token');
      toast.success('API token created');
    } catch (error: any) {
      console.error('Failed to create API token', error);
      toast.error(error?.message || 'Failed to create API token');
    } finally {
      setCreatingToken(false);
    }
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success('API token copied');
    } catch {
      toast.error('Failed to copy API token');
    }
  };

  const revokeToken = async (token: ApiToken) => {
    const confirmed = window.confirm(`Revoke API token "${token.name}"?`);
    if (!confirmed) return;

    setDeletingTokenId(token.id);
    try {
      await deleteApiToken(token.id);
      setApiTokens((current) => current.filter((item) => item.id !== token.id));
      if (createdToken?.id === token.id) {
        setCreatedToken(null);
      }
      toast.success('API token revoked');
    } catch (error: any) {
      console.error('Failed to revoke API token', error);
      toast.error(error?.message || 'Failed to revoke API token');
    } finally {
      setDeletingTokenId(null);
    }
  };

  const formatTokenDate = (value?: string | null) => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d, yyyy HH:mm');
  };

  return (
    <div className="flex-1 overflow-hidden bg-white dark:bg-slate-950">
      <div className="h-16 bg-white border-b border-border-theme flex items-center justify-between px-6 shrink-0 dark:bg-slate-950">
        <div>
          <h1 className="text-lg font-bold text-text-dark">User Management</h1>
          <p className="text-sm text-text-light">Manage names and roles for local accounts.</p>
        </div>
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-[260px] bg-[#f1f5f9] border-border-theme h-9 text-sm dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="p-6 overflow-auto h-[calc(100vh-4rem)]">
        <form onSubmit={handleCreateUser} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border-theme bg-slate-50 p-4 dark:bg-slate-900">
          <div className="min-w-[240px] flex-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-light">Email</div>
            <Input
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              placeholder="new.user@example.com"
              required
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-light">Name</div>
            <Input
              value={newUser.displayName}
              onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="Display name"
            />
          </div>
          <div className="w-[160px]">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-light">Role</div>
            <Select value={newUser.role} onValueChange={(value: UserProfile['role']) => setNewUser((current) => ({ ...current, role: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={creatingUser}>
            {creatingUser ? 'Creating...' : 'Create User'}
          </Button>
        </form>

        {loading ? (
          <div className="p-8 text-center text-text-light animate-pulse font-mono text-xs">
            LOADING USERS...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="align-top">
                    <Input
                      value={user.displayName}
                      onChange={(event) => updateDraft(user.uid, { displayName: event.target.value })}
                      className="w-full min-w-[220px]"
                    />
                  </TableCell>
                  <TableCell className="text-sm text-text-light align-middle">{user.email}</TableCell>
                  <TableCell className="align-top">
                    <Select value={user.role} onValueChange={(value: UserProfile['role']) => updateDraft(user.uid, { role: value })}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => saveUser(user)}
                        disabled={!user.dirty || user.saving || user.deleting}
                        size="sm"
                      >
                        {user.saving ? 'Saving...' : 'Save'}
                      </Button>
                      {user.role !== 'admin' && (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={() => removeUser(user)}
                          disabled={user.saving || user.deleting}
                          size="sm"
                        >
                          {user.deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-text-light py-8">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <section className="mt-8 rounded-lg border border-border-theme bg-slate-50 p-4 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-sm font-bold text-text-dark">API Tokens</h2>
            <p className="text-xs text-text-light">
              Create tokens for Postman, scripts, or other integrations. Tokens act as your account and are shown only once.
            </p>
          </div>

          <form onSubmit={handleCreateToken} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-light">Token Name</div>
              <Input
                value={newTokenName}
                onChange={(event) => setNewTokenName(event.target.value)}
                placeholder="Integration token"
                required
              />
            </div>
            <Button type="submit" disabled={creatingToken}>
              {creatingToken ? 'Creating...' : 'Create Token'}
            </Button>
          </form>

          {createdToken && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-text-dark">Copy this token now</p>
                  <p className="text-[11px] text-text-light">You will not be able to see the full token again.</p>
                </div>
                <Button type="button" size="sm" onClick={() => copyToken(createdToken.token)}>
                  Copy Token
                </Button>
              </div>
              <code className="block overflow-x-auto rounded bg-white px-3 py-2 text-xs text-text-dark dark:bg-slate-950">
                {createdToken.token}
              </code>
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-lg border border-border-theme bg-white dark:bg-slate-950">
            {loadingTokens ? (
              <div className="p-4 text-center text-xs font-mono text-text-light">LOADING TOKENS...</div>
            ) : apiTokens.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-light">No API tokens yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiTokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-medium">{token.name}</TableCell>
                      <TableCell>
                        <code className="rounded bg-slate-100 px-2 py-1 text-[11px] dark:bg-slate-900">
                          {token.tokenPrefix}...
                        </code>
                      </TableCell>
                      <TableCell className="text-xs text-text-light">{formatTokenDate(token.createdAt)}</TableCell>
                      <TableCell className="text-xs text-text-light">{formatTokenDate(token.lastUsedAt)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={deletingTokenId === token.id}
                          onClick={() => revokeToken(token)}
                        >
                          {deletingTokenId === token.id ? 'Revoking...' : 'Revoke'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
