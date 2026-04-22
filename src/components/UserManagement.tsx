import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../types';
import { createUser, deleteUser, listUsers, updateUser } from '../lib/api';
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
      </div>
    </div>
  );
}
