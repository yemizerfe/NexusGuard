
import { useState, useEffect } from 'react';
import {
  Search,
  Trash2,
  Activity,
  Loader2,
  RotateCcw,
  Archive,
  X,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '../../components/layout/AdminLayout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');
const API_URL = `${API_BASE_URL}/api`;

interface Scan {
  id: string;
  target: string;
  risk_score: number;
  status: string;
  started_at: string;
  user_email: string;
  is_deleted?: boolean;
  deleted_at?: string;
  deleted_by?: string;
  deletion_reason?: string;
}

type ModalType = 'delete' | 'restore' | 'success' | 'error' | 'info';
type ActionType = 'delete' | 'restore';

interface PendingAction {
  id: string;
  target: string;
  type: ActionType;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const AdminScansPage = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [filteredScans, setFilteredScans] = useState<Scan[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('delete');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);

  useEffect(() => {
    void fetchAllScans();
  }, [showDeleted]);

  useEffect(() => {
    filterScans();
  }, [search, scans]);

  const showModal = (
    type: ModalType,
    title: string,
    message: string,
    action?: PendingAction
  ) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setPendingAction(action ?? null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingAction(null);
  };

  const confirmAction = async () => {
    const action = pendingAction;

    closeModal();

    if (!action) return;

    if (action.type === 'delete') {
      await executeDelete(action.id, action.target);
    } else {
      await executeRestore(action.id, action.target);
    }
  };

  const fetchAllScans = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');

      const url = showDeleted
        ? `${API_URL}/admin/all-scans?include_deleted=true`
        : `${API_URL}/admin/all-scans`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error(
          'Failed to fetch scans:',
          response.status,
          await response.text()
        );
        return;
      }

      const data: unknown = await response.json();

      let rawScans: unknown[] = [];

      if (Array.isArray(data)) {
        rawScans = data;
      } else if (isRecord(data) && Array.isArray(data.scans)) {
        rawScans = data.scans;
      }

      const validScans: Scan[] = rawScans.filter(
        (value): value is Scan => {
          if (!isRecord(value)) return false;

          return (
            typeof value.id === 'string' &&
            typeof value.target === 'string' &&
            typeof value.status === 'string'
          );
        }
      ).map((scan) => ({
        id: scan.id,
        target: scan.target,
        status: scan.status,
        risk_score:
          typeof scan.risk_score === 'number' ? scan.risk_score : 0,
        started_at:
          typeof scan.started_at === 'string' ? scan.started_at : '',
        user_email:
          typeof scan.user_email === 'string' ? scan.user_email : 'unknown',
        is_deleted:
          typeof scan.is_deleted === 'boolean' ? scan.is_deleted : false,
        deleted_at:
          typeof scan.deleted_at === 'string' ? scan.deleted_at : undefined,
        deleted_by:
          typeof scan.deleted_by === 'string' ? scan.deleted_by : undefined,
        deletion_reason:
          typeof scan.deletion_reason === 'string'
            ? scan.deletion_reason
            : undefined,
      }));

      setScans(validScans);
    } catch (error) {
      console.error('Failed to fetch scans:', error);
      showModal('error', 'Error', 'Failed to fetch scans');
    } finally {
      setLoading(false);
    }
  };

  const filterScans = () => {
    let filtered = [...scans];
    const searchTerm = search.toLowerCase();

    if (searchTerm) {
      filtered = filtered.filter(
        (scan) =>
          scan.target.toLowerCase().includes(searchTerm) ||
          scan.user_email.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredScans(filtered);
  };

  const executeDelete = async (scanId: string, target: string) => {
    setDeleting(scanId);

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`${API_URL}/admin/scans/${scanId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setScans((previous) =>
          previous.filter((scan) => scan.id !== scanId)
        );

        showModal(
          'success',
          'Success',
          `Scan for "${target}" was permanently deleted`
        );
      } else {
        let message = 'Failed to delete scan';

        try {
          const data: unknown = await response.json();

          if (
            isRecord(data) &&
            typeof data.detail === 'string'
          ) {
            message = data.detail;
          }
        } catch {
          // Keep the fallback message if the response is not JSON.
        }

        showModal('error', 'Error', message);
      }
    } catch (error) {
      console.error('Failed to delete scan:', error);
      showModal('error', 'Error', 'Failed to delete scan');
    } finally {
      setDeleting(null);
    }
  };

  const deleteScan = (scanId: string, target: string) => {
    showModal(
      'delete',
      'Delete Scan',
      `Are you sure you want to permanently delete scan for "${target}"?\n\nThis action will be logged for audit purposes and CANNOT be undone.`,
      { id: scanId, target, type: 'delete' }
    );
  };

  const executeRestore = async (scanId: string, target: string) => {
    setRestoring(scanId);

    try {
      const token = localStorage.getItem('accessToken');

      const response = await fetch(
        `${API_URL}/admin/scans/${scanId}/restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      let data: unknown = {};

      try {
        data = await response.json();
      } catch {
        // The server may return an empty response.
      }

      if (response.ok) {
        await fetchAllScans();

        showModal(
          'success',
          'Success',
          `Scan for "${target}" was restored successfully`
        );
      } else {
        const message =
          isRecord(data) && typeof data.detail === 'string'
            ? data.detail
            : 'Failed to restore scan';

        showModal('error', 'Error', message);
      }
    } catch (error) {
      console.error('Failed to restore scan:', error);
      showModal('error', 'Error', 'Failed to restore scan');
    } finally {
      setRestoring(null);
    }
  };

  const restoreScan = (scanId: string, target: string) => {
    showModal(
      'restore',
      'Restore Scan',
      `Are you sure you want to restore scan for "${target}"?`,
      { id: scanId, target, type: 'restore' }
    );
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBg = (score: number) => {
    if (score >= 70) return 'bg-green-500/10';
    if (score >= 40) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/20 text-green-500';
      case 'running':
        return 'bg-blue-500/20 text-blue-500';
      case 'failed':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Accept optional dates, including scan.deleted_at.
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);

    return Number.isNaN(date.getTime())
      ? dateString
      : date.toLocaleString();
  };

  const activeScans = scans.filter((scan) => !scan.is_deleted).length;
  const deletedScans = scans.filter((scan) => scan.is_deleted).length;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="w-8 h-8 text-primary" />
            All Scans
          </h1>
          <p className="text-gray-400 mt-1">
            View and manage all security scans performed by all users
          </p>
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle>
                All Scans
                <span className="ml-2 text-sm text-gray-400">
                  ({activeScans} active, {deletedScans} deleted)
                </span>
              </CardTitle>

              <Button
                variant={showDeleted ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowDeleted((current) => !current)}
                className="gap-2"
              >
                <Archive className="w-4 h-4" />
                {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by target or user..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-10 bg-gray-800/50 border-gray-700"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredScans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No scans found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-800">
                    <tr className="text-left text-gray-400">
                      <th className="pb-3">Started At</th>
                      <th className="pb-3">Target</th>
                      <th className="pb-3">User</th>
                      <th className="pb-3">Risk Score</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Deleted Info</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredScans.map((scan) => (
                      <tr
                        key={scan.id}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                          scan.is_deleted ? 'opacity-70 bg-red-500/5' : ''
                        }`}
                      >
                        <td className="py-3 text-xs whitespace-nowrap">
                          {formatDate(scan.started_at)}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{scan.target}</span>
                            {scan.is_deleted && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-500">
                                DELETED
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3">{scan.user_email}</td>

                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${getRiskColor(scan.risk_score)} ${getRiskBg(scan.risk_score)}`}
                          >
                            {scan.risk_score}/100
                          </span>
                        </td>

                        <td className="py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(scan.status)}`}
                          >
                            {scan.status}
                          </span>
                        </td>

                        <td className="py-3 text-xs">
                          {scan.is_deleted ? (
                            <div>
                              <div className="text-red-400">
                                Deleted by: {scan.deleted_by || 'user'}
                              </div>
                              <div className="text-gray-500">
                                {formatDate(scan.deleted_at)}
                              </div>
                              {scan.deletion_reason && (
                                <div className="text-gray-500 text-xs">
                                  {scan.deletion_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-green-500">Active</span>
                          )}
                        </td>

                        <td className="py-3">
                          <div className="flex gap-1">
                            {scan.is_deleted ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => restoreScan(scan.id, scan.target)}
                                disabled={restoring === scan.id}
                                className="text-primary hover:text-primary/80 hover:bg-primary/10"
                                title="Restore scan"
                              >
                                {restoring === scan.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-4 h-4" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteScan(scan.id, scan.target)}
                                disabled={deleting === scan.id}
                                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                title="Permanently delete scan"
                              >
                                {deleting === scan.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeModal}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-gray-900 rounded-xl border border-gray-700 shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div
              className={`p-4 ${
                modalType === 'delete'
                  ? 'bg-red-500/10 border-b border-red-500/20'
                  : modalType === 'error'
                    ? 'bg-red-500/10 border-b border-red-500/20'
                    : 'bg-primary/10 border-b border-primary/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {modalType === 'delete' && (
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  )}
                  {modalType === 'restore' && (
                    <RotateCcw className="w-6 h-6 text-primary" />
                  )}
                  {modalType === 'success' && (
                    <CheckCircle className="w-6 h-6 text-primary" />
                  )}
                  {modalType === 'error' && (
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  )}
                  {modalType === 'info' && (
                    <Info className="w-6 h-6 text-primary" />
                  )}

                  <h2
                    className={`text-lg font-semibold ${
                      modalType === 'delete' || modalType === 'error'
                        ? 'text-red-500'
                        : 'text-primary'
                    }`}
                  >
                    {modalTitle}
                  </h2>
                </div>

                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-300 whitespace-pre-line">
                {modalMessage}
              </p>
            </div>

            <div className="p-4 bg-gray-800/30 flex justify-end gap-3">
              {modalType === 'delete' || modalType === 'restore' ? (
                <>
                  <Button variant="outline" onClick={closeModal} className="gap-2">
                    Cancel
                  </Button>

                  <Button
                    onClick={() => void confirmAction()}
                    className={
                      modalType === 'delete'
                        ? 'gap-2 bg-red-600 hover:bg-red-700'
                        : 'gap-2 bg-primary hover:bg-primary/80'
                    }
                  >
                    {modalType === 'delete' ? (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Permanently
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        Restore Scan
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={closeModal}
                  className="gap-2 bg-primary hover:bg-primary/80"
                >
                  <CheckCircle className="w-4 h-4" />
                  OK
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminScansPage;
