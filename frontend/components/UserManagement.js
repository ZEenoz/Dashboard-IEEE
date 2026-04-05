'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, Plus, Edit2, Trash2, Shield, User as UserIcon, CheckCircle2, XCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null); // null if adding new

    const [form, setForm] = useState({ username: '', role: 'general_user', password: '', is_active: true });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/users`, {
                headers: { 
                    'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // Update
                const res = await fetch(`${API_URL}/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        role: form.role,
                        is_active: form.is_active,
                        ...(form.password ? { password: form.password } : {})
                    })
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Failed to update user');
                }
            } else {
                // Create
                const res = await fetch(`${API_URL}/users`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-api-key': 'IEEE_SECURE_API_KEY_2025',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        username: form.username,
                        password: form.password,
                        role: form.role
                    })
                });
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Failed to create user');
                }
            }
            await fetchUsers();
            setIsModalOpen(false);
            setForm({ username: '', role: 'general_user', password: '', is_active: true });
            toast.success(editingUser ? 'User updated successfully!' : 'User created successfully!');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { 'x-api-key': 'IEEE_SECURE_API_KEY_2025', 'ngrok-skip-browser-warning': 'true' } });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete user');
            }
            toast.success('User deleted successfully');
            await fetchUsers();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const openAddModal = () => {
        setEditingUser(null);
        setForm({ username: '', role: 'general_user', password: '', is_active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setForm({ username: user.username, role: user.role, password: '', is_active: user.is_active });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 fade-in">
            <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="w-6 h-6 text-indigo-400" />
                    User Management
                </h2>
                <button
                    onClick={openAddModal}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg"
                >
                    <Plus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900 border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 font-bold text-white flex items-center gap-3">
                                        <div className="p-2 bg-gray-700 rounded-lg">
                                            {u.role === 'admin' ? <Shield className="w-4 h-4 text-rose-400" /> : <UserIcon className="w-4 h-4 text-gray-300" />}
                                        </div>
                                        {u.username}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border ${u.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                                            u.role === 'local_authority' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                                'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                            }`}>
                                            {u.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-sm">
                                            {u.is_active ? (
                                                <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-gray-300">Active</span></>
                                            ) : (
                                                <><XCircle className="w-4 h-4 text-gray-500" /><span className="text-gray-500">Disabled</span></>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => openEditModal(u)}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors inline-block"
                                            title="Edit User"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors inline-block"
                                            title="Delete User"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editingUser ? 'Edit User' : 'Create New User'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Username</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={e => setForm({ ...form, username: e.target.value })}
                                    disabled={!!editingUser}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none disabled:opacity-50"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Password {editingUser && '(Leave blank to keep)'}</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                                    required={!editingUser}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Role</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                                >
                                    <option value="general_user">General User (View Only)</option>
                                    <option value="local_authority">Local Authority (Stations & Thresholds)</option>
                                    <option value="admin">Admin (Full Access)</option>
                                </select>
                            </div>

                            {editingUser && (
                                <div className="flex items-center gap-2 mt-4">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                        className="w-4 h-4 rounded bg-gray-900 border-gray-700"
                                        id="active-checkbox"
                                    />
                                    <label htmlFor="active-checkbox" className="text-sm font-bold text-gray-300">Account is Active</label>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition">
                                    Cancel
                                </button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-bold transition shadow-lg">
                                    Save User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
