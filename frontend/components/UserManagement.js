'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Users, Plus, Edit2, Trash2, Shield, User as UserIcon, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function UserManagement() {
    const { t } = useLanguage();
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
            toast.error(t('userManagement.failedFetchUsers'));
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
            toast.success(editingUser ? t('userManagement.userUpdated') : t('userManagement.userCreated'));
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm(t('userManagement.deleteConfirm'))) return;
        try {
            const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers: { 'x-api-key': 'IEEE_SECURE_API_KEY_2025', 'ngrok-skip-browser-warning': 'true' } });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to delete user');
            }
            toast.success(t('userManagement.userDeleted'));
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
                    {t('userManagement.title')}
                </h2>
                <button
                    onClick={openAddModal}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg"
                >
                    <Plus className="w-4 h-4" />
                    {t('userManagement.addUser')}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap block md:table">
                        <thead className="bg-gray-900 border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wider hidden md:table-header-group">
                            <tr className="block md:table-row">
                                <th className="px-6 py-4 block md:table-cell">{t('userManagement.username')}</th>
                                <th className="px-6 py-4 block md:table-cell">{t('userManagement.role')}</th>
                                <th className="px-6 py-4 block md:table-cell">{t('userManagement.status')}</th>
                                <th className="px-6 py-4 text-right block md:table-cell">{t('userManagement.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50 block md:table-row-group">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-700/30 transition-colors block md:table-row bg-gray-800/40 md:bg-transparent border border-gray-700 md:border-none rounded-xl md:rounded-none p-4 md:p-0 mb-4 md:mb-0">
                                    <td className="px-0 py-3 md:px-6 md:py-4 font-bold text-white flex items-center justify-between md:justify-start gap-3 whitespace-nowrap block md:table-cell border-b border-gray-700/50 md:border-none">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-700 rounded-lg shrink-0">
                                                {u.role === 'admin' ? <Shield className="w-4 h-4 text-rose-400" /> : <UserIcon className="w-4 h-4 text-gray-300" />}
                                            </div>
                                            {u.username}
                                        </div>
                                    </td>
                                    <td className="px-0 py-3 md:px-6 md:py-4 whitespace-nowrap block md:table-cell border-b border-gray-700/50 md:border-none flex items-center justify-between md:table-cell">
                                        <span className="md:hidden text-xs text-gray-500 font-bold uppercase tracking-wider">{t('userManagement.role')}</span>
                                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border whitespace-nowrap ${u.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                                            u.role === 'local_authority' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                                'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                            }`}>
                                            {u.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-0 py-3 md:px-6 md:py-4 block md:table-cell border-b border-gray-700/50 md:border-none flex items-center justify-between md:table-cell">
                                        <span className="md:hidden text-xs text-gray-500 font-bold uppercase tracking-wider">{t('userManagement.status')}</span>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            {u.is_active ? (
                                                <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-gray-300">{t('common.active')}</span></>
                                            ) : (
                                                <><XCircle className="w-4 h-4 text-gray-500" /><span className="text-gray-500">{t('common.disabled')}</span></>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-0 py-3 md:px-6 md:py-4 text-right space-x-2 block md:table-cell flex justify-end md:table-cell items-center gap-2 pt-4 md:pt-4">
                                        <button
                                            onClick={() => openEditModal(u)}
                                            className="p-2 md:p-2 flex-1 md:flex-none justify-center text-gray-400 hover:text-white bg-gray-700/50 md:bg-transparent hover:bg-gray-700 rounded-lg transition-colors flex items-center"
                                            title="Edit User"
                                        >
                                            <Edit2 className="w-4 h-4 mr-2 md:mr-0" />
                                            <span className="md:hidden text-xs font-bold">{t('userManagement.editUser')}</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 md:p-2 flex-1 md:flex-none justify-center text-red-400 md:text-gray-400 hover:text-red-400 bg-red-500/10 md:bg-transparent hover:bg-red-500/10 rounded-lg transition-colors flex items-center"
                                            title="Delete User"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2 md:mr-0" />
                                            <span className="md:hidden text-xs font-bold">{t('common.delete')}</span>
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
                            <h3 className="font-bold text-lg">{editingUser ? t('userManagement.editUser') : t('userManagement.createUser')}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t('userManagement.username')}</label>
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
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{editingUser ? t('userManagement.passwordKeep') : t('userManagement.password')}</label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                                    required={!editingUser}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t('userManagement.role')}</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none"
                                >
                                    <option value="general_user">{t('userManagement.roleGeneral')}</option>
                                    <option value="local_authority">{t('userManagement.roleAuthority')}</option>
                                    <option value="admin">{t('userManagement.roleAdmin')}</option>
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
                                    <label htmlFor="active-checkbox" className="text-sm font-bold text-gray-300">{t('userManagement.accountActive')}</label>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition">
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-bold transition shadow-lg">
                                    {t('userManagement.saveUser')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
