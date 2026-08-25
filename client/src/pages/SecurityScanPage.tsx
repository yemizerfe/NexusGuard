import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, 
  Search, 
  AlertTriangle,  
  Loader2,
  FileText,
  History,
  Eye,
  Trash2,
  TrendingUp,
  CheckCircle,
  XCircle,
  Settings,
  Brain
} from 'lucide-react';
import Sidebar from '../components/layout/sidebar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { DEFAULT_SCAN_OPTIONS, SCAN_PROFILE_PRESETS, type ScanOptions, type EnabledChecks } from '../../types';

const API_URL = 'http://localhost:8000/api';

interface Finding {
  type: string;
  rule_id?: string;
  name: string;
  severity: string;
  category?: string;
  message: string;
  recommendation: string;
}

interface ScanResult {
  scan_id: string;
  risk_score: number;
  findings_count: number;
  findings: Finding[];
  insights: any[];
  ai_analysis?: string | null;
  summary: {
    status: string;
    message: string;
    risk_score: number;
    severity_breakdown: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    top_recommendations: string[];
  };
}

interface ScanHistoryItem {
  id: string;
  target: string;
  risk_score: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

const SecurityScanPage = () => {
  const [target, setTarget] = useState('');
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'results' | 'history'>('scan');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [stats, setStats] = useState({
    total_scans: 0,
    average_risk_score: 0,
    total_critical_findings: 0
  });
  
  const [historyLimit, setHistoryLimit] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Standard security-scan parameters (Nessus/ZAP/Nmap-style options)
  const [options, setOptions] = useState<ScanOptions>(DEFAULT_SCAN_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Free-text port spec for custom mode, e.g. "80,443,8000-8100"
  const [useCustomPorts, setUseCustomPorts] = useState(false);
  const [customPortsInput, setCustomPortsInput] = useState('');
  // Comma-separated paths to skip, e.g. "/health,/status"
  const [excludePathsInput, setExcludePathsInput] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'delete' | 'success' | 'error'>('delete');
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  
  const currentScanIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [historyLimit]);

  const showModal = (type: 'delete' | 'success' | 'error', title: string, message: string, deleteId?: string) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setPendingDeleteId(deleteId || null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await executeDelete(pendingDeleteId);
    }
    closeModal();
  };

  const loadInitialData = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    await fetchScanHistory();
    await fetchScanStats();
  };

  const fetchScanHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoadingHistory(false);
        return;
      }
      
      const response = await fetch(`${API_URL}/scans/?limit=${historyLimit}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        const scans = data.scans || data || [];
        
        const formattedScans = scans.map((scan: any) => ({
          id: scan.id,
          target: scan.target,
          risk_score: scan.risk_score || 0,
          status: scan.status || scan.scan_status || 'unknown',
          created_at: scan.started_at || scan.created_at,
          completed_at: scan.completed_at,
          findings_count: scan.findings_count || 0
        }));
        
        setScanHistory(formattedScans);
      } else {
        setScanHistory([]);
      }
    } catch (error) {
      console.error('Failed to fetch scan history:', error);
      setScanHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchScanStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/scans/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats({
          total_scans: data.total_scans || 0,
          average_risk_score: data.average_risk_score || 0,
          total_critical_findings: data.total_critical_findings || 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const getStatusFromScore = (score: number): string => {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 80) return 'GOOD';
    if (score >= 70) return 'FAIR';
    if (score >= 50) return 'POOR';
    return 'CRITICAL';
  };

  const loadScanResults = async (scanId: string) => {
    setLoadingResults(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/scans/${scanId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const securityScore = data.risk_score || 0;
        
        const analysisResult: ScanResult = {
          scan_id: data.id,
          risk_score: securityScore,
          findings_count: data.findings?.length || 0,
          findings: data.findings || [],
          insights: [],
          ai_analysis: data.ai_analysis || null,
          summary: {
            status: getStatusFromScore(securityScore),
            message: `Scan completed. Security score: ${securityScore}/100`,
            risk_score: securityScore,
            severity_breakdown: {
              critical: data.critical_count || 0,
              high: data.high_count || 0,
              medium: data.medium_count || 0,
              low: data.low_count || 0
            },
            top_recommendations: (data.findings || [])
              .filter((f: any) => f.recommendation)
              .slice(0, 5)
              .map((f: any) => f.recommendation)
          }
        };
        
        setResults(analysisResult);
        setActiveTab('results');
        showModal('success', 'Success', 'Scan results loaded successfully');
      }
    } catch (error) {
      console.error('Failed to load scan results:', error);
      showModal('error', 'Error', 'Failed to load scan results');
    } finally {
      setLoadingResults(false);
    }
  };

  const executeDelete = async (scanId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/scans/${scanId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        setScanHistory(prev => prev.filter(scan => scan.id !== scanId));
        await fetchScanStats();
        showModal('success', 'Success', 'Scan deleted successfully');
        
        if (results && results.scan_id === scanId) {
          setResults(null);
          setActiveTab('scan');
        }
      } else {
        showModal('error', 'Error', 'Failed to delete scan');
      }
    } catch (error) {
      console.error('Failed to delete scan:', error);
      showModal('error', 'Error', 'Failed to delete scan');
    }
  };

  const deleteScan = (scanId: string) => {
    const scan = scanHistory.find(s => s.id === scanId);
    showModal('delete', 'Delete Scan', 
      `Are you sure you want to delete scan for "${scan?.target || 'this target'}"?\n\nThis action cannot be undone.`,
      scanId
    );
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleTabChange = (tab: 'scan' | 'results' | 'history') => {
    userInteractedRef.current = true;
    setActiveTab(tab);
    setTimeout(() => {
      userInteractedRef.current = false;
    }, 2000);
  };

  const pollScanResults = async (scanId: string) => {
    if (currentScanIdRef.current !== scanId) {
      return;
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/scans/${scanId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'completed') {
          stopPolling();
          
          const securityScore = data.risk_score || 0;
          const analysisResult: ScanResult = {
            scan_id: data.id,
            risk_score: securityScore,
            findings_count: data.findings?.length || 0,
            findings: data.findings || [],
            insights: [],
            ai_analysis: data.ai_analysis || null,
            summary: {
              status: getStatusFromScore(securityScore),
              message: `Scan completed. Security score: ${securityScore}/100`,
              risk_score: securityScore,
              severity_breakdown: {
                critical: data.critical_count || 0,
                high: data.high_count || 0,
                medium: data.medium_count || 0,
                low: data.low_count || 0
              },
              top_recommendations: (data.findings || [])
                .filter((f: any) => f.recommendation)
                .slice(0, 5)
                .map((f: any) => f.recommendation)
            }
          };
          
          setResults(analysisResult);
          
          if (!userInteractedRef.current) {
            setActiveTab('results');
          }
          
          setScanning(false);
          showModal('success', 'Scan Complete', 'Scan completed successfully!');
          
          await fetchScanHistory();
          await fetchScanStats();
        } else if (data.status === 'failed') {
          stopPolling();
          setScanning(false);
          showModal('error', 'Scan Failed', data.error_message || 'Scan failed');
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const startNewScan = () => {
    stopPolling();
    currentScanIdRef.current = null;
    userInteractedRef.current = true;
    setTarget('');
    setResults(null);
    setError('');
    setSuccess('');
    setScanning(false);
    setActiveTab('scan');
    
    setTimeout(() => {
      userInteractedRef.current = false;
    }, 500);
  };

  // ------------------ Standard scan-parameter helpers ------------------
  const updateOption = <K extends keyof ScanOptions>(key: K, value: ScanOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value, profile: 'custom' }));
  };

  const updateCheck = (key: keyof EnabledChecks, value: boolean) => {
    setOptions(prev => ({
      ...prev,
      profile: 'custom',
      enabled_checks: { ...prev.enabled_checks, [key]: value },
    }));
  };

  const applyProfile = (profile: keyof typeof SCAN_PROFILE_PRESETS) => {
    const preset = SCAN_PROFILE_PRESETS[profile];
    setCustomPortsInput('');
    setOptions({ ...DEFAULT_SCAN_OPTIONS, ...preset.patch, profile });
  };

  // Parse "80,443,8000-8100" into an explicit port list (custom mode)
  const parsePortSpec = (spec: string): number[] => {
    const ports = new Set<number>();
    spec.split(',').forEach(token => {
      const t = token.trim();
      if (!t) return;
      const range = t.match(/^(\d{1,5})-(\d{1,5})$/);
      if (range) {
        const lo = parseInt(range[1], 10);
        const hi = parseInt(range[2], 10);
        if (lo >= 1 && hi <= 65535 && lo <= hi && hi - lo + 1 <= 2000) {
          for (let p = lo; p <= hi; p++) ports.add(p);
        }
      } else if (/^\d{1,5}$/.test(t)) {
        const p = parseInt(t, 10);
        if (p >= 1 && p <= 65535) ports.add(p);
      }
    });
    return Array.from(ports).sort((a, b) => a - b);
  };

  const runScan = async () => {
    if (!target) {
      showModal('error', 'Error', 'Please enter a target IP or domain');
      return;
    }

    stopPolling();
    setScanning(true);
    setError('');
    setSuccess('');
    setResults(null);
    currentScanIdRef.current = null;

    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        showModal('error', 'Error', 'Please login again');
        setScanning(false);
        return;
      }

      // Send all standard scan parameters; snake_case matches server contract
      const payload: ScanOptions & { target: string } = { target: target, ...options };
      if (useCustomPorts && customPortsInput.trim()) {
        // Explicit port list takes precedence over port_range on the server
        payload.ports = parsePortSpec(customPortsInput);
      }
      payload.exclude_paths = excludePathsInput
        .split(',').map(s => s.trim()).filter(Boolean);

      const response = await fetch(`${API_URL}/scans/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (response.ok) {
        currentScanIdRef.current = data.scan_id;
        showModal('success', 'Scan Started', `Scanning: ${target}`);
        
        const interval = setInterval(() => {
          pollScanResults(data.scan_id);
        }, 2000);
        pollingIntervalRef.current = interval;
        
        await fetchScanHistory();
      } else {
        showModal('error', 'Error', data.detail || 'Scan failed');
        setScanning(false);
      }
    } catch (err) {
      console.error('Scan start error:', err);
      showModal('error', 'Error', 'Failed to connect to server. Make sure backend is running.');
      setScanning(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-green-500/20 text-green-500';
      case 'running': return 'bg-blue-500/20 text-blue-500';
      case 'failed': return 'bg-red-500/20 text-red-500';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const totalFindings = results?.findings?.length || 0;
  const severityBreakdown = results?.summary?.severity_breakdown || { critical: 0, high: 0, medium: 0, low: 0 };

  const handleLimitChange = (newLimit: number) => {
    setHistoryLimit(newLimit);
    setCurrentPage(1);
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header with Stats */}
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Shield className="w-8 h-8 text-primary" />
                  Security Scan
                </h1>
                <p className="text-gray-400 mt-1">
                  Scan systems for vulnerabilities, misconfigurations, and threats
                </p>
              </div>
              
              <Button 
                onClick={startNewScan} 
                variant="outline" 
                className="gap-2"
                disabled={scanning}
              >
                <Search className="w-4 h-4" />
                New Scan
              </Button>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Scans</p>
                      <p className="text-2xl font-bold">{stats.total_scans}</p>
                    </div>
                    <History className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Avg Security Score</p>
                      <p className={`text-2xl font-bold ${getRiskColor(stats.average_risk_score)}`}>
                        {stats.average_risk_score}/100
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-yellow-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Critical Findings</p>
                      <p className="text-2xl font-bold text-red-500">{stats.total_critical_findings}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-gray-800 mb-6">
            <button
              onClick={() => handleTabChange('scan')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'scan'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              New Scan
            </button>
            <button
              onClick={() => handleTabChange('results')}
              disabled={!results}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'results'
                  ? 'text-primary border-b-2 border-primary'
                  : results
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Results {results && `(${results.risk_score})`}
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <History className="w-4 h-4 inline mr-2" />
              History ({scanHistory.length})
            </button>
          </div>

          {/* NEW SCAN TAB CONTENT */}
          {activeTab === 'scan' && (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="target" className="text-gray-300">Target IP / Domain / System</Label>
                    <div className="flex gap-4 mt-2">
                      <Input
                        id="target"
                        placeholder="e.g., 192.168.1.100 or example.com"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="flex-1 bg-gray-800/50 border-gray-700 text-white"
                        onKeyPress={(e) => e.key === 'Enter' && !scanning && runScan()}
                        disabled={scanning}
                        autoFocus
                      />
                      <Button 
                        onClick={runScan} 
                        disabled={scanning}
                        size="lg"
                      >
                        {scanning ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Start Security Scan
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Scan Profile Presets - Nessus/OpenVAS-style policies */}
                  <div>
                    <Label className="text-gray-300">Scan Profile</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {(Object.keys(SCAN_PROFILE_PRESETS) as Array<keyof typeof SCAN_PROFILE_PRESETS>).map(key => {
                        const preset = SCAN_PROFILE_PRESETS[key];
                        const active = options.profile === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => applyProfile(key)}
                            disabled={scanning}
                            title={preset.description}
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              active
                                ? 'border-primary bg-primary/10'
                                : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
                            }`}
                          >
                            <span className={`block font-medium text-sm ${active ? 'text-primary' : 'text-white'}`}>
                              {preset.label}
                            </span>
                            <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug">
                              {preset.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {options.profile === 'custom' && (
                      <p className="text-[11px] text-yellow-500 mt-1">
                        ⚙ Custom parameters in use (preset values were modified)
                      </p>
                    )}
                  </div>

                  {/* Advanced scan parameters toggle */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    disabled={scanning}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors w-fit"
                  >
                    <Settings className={`w-4 h-4 ${showAdvanced ? 'text-primary' : ''}`} />
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                    <span className="text-[11px] text-gray-500 hidden md:inline">
                      (intensity: {options.intensity} · timeout: {options.timeout_seconds}s · threads: {options.max_threads})
                    </span>
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4 border border-gray-800 rounded-lg p-4 bg-gray-900/60">
                      {/* ---- Scope (Nmap-style port specs, ZAP-style intensity) ---- */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-gray-400 text-xs">Intensity (attack strength)</Label>
                          <select
                            value={options.intensity}
                            onChange={e => updateOption('intensity', e.target.value as ScanOptions['intensity'])}
                            disabled={scanning}
                            className="mt-1 w-full bg-gray-800/50 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="passive">Passive - headers/TLS only</option>
                            <option value="light">Light - minimal probing</option>
                            <option value="normal">Normal - balanced</option>
                            <option value="aggressive">Aggressive - full wordlist</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Port Range</Label>
                          <select
                            value={useCustomPorts ? 'custom' : options.port_range}
                            onChange={e => {
                              if (e.target.value === 'custom') {
                                setUseCustomPorts(true);
                              } else {
                                setUseCustomPorts(false);
                                setCustomPortsInput('');
                                updateOption('port_range', e.target.value);
                              }
                            }}
                            disabled={scanning}
                            className="mt-1 w-full bg-gray-800/50 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="top-10">Top 10 ports</option>
                            <option value="top-25">Top 25 ports</option>
                            <option value="top-100">Top 100 ports</option>
                            <option value="top-1000">Top 1000 ports</option>
                            <option value="1-1024">Range 1-1024</option>
                            <option value="custom">Custom list…</option>
                          </select>
                        </div>
                        {useCustomPorts ? (
                          <div>
                            <Label className="text-gray-400 text-xs">Custom Ports</Label>
                            <Input
                              placeholder="e.g. 80,443,8000-8100"
                              value={customPortsInput}
                              onChange={e => setCustomPortsInput(e.target.value)}
                              disabled={scanning}
                              className="mt-1 bg-gray-800/50 border-gray-700 text-white"
                            />
                          </div>
                        ) : (
                          <div>
                            <Label className="text-gray-400 text-xs">Max Ports Scanned</Label>
                            <Input
                              type="number" min={1} max={65535}
                              value={options.max_ports}
                              onChange={e => updateOption('max_ports',
                                Math.max(1, Math.min(65535, parseInt(e.target.value || '100', 10) || 1)))}
                              disabled={scanning}
                              className="mt-1 bg-gray-800/50 border-gray-700 text-white"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-gray-400 text-xs">Timeout (seconds)</Label>
                          <Input
                            type="number" min={1} max={60}
                            value={options.timeout_seconds}
                            onChange={e => updateOption('timeout_seconds',
                              Math.max(1, Math.min(60, parseInt(e.target.value || '5', 10) || 1)))}
                            disabled={scanning}
                            className="mt-1 bg-gray-800/50 border-gray-700 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Concurrent Threads</Label>
                          <Input
                            type="number" min={1} max={200}
                            value={options.max_threads}
                            onChange={e => updateOption('max_threads',
                              Math.max(1, Math.min(200, parseInt(e.target.value || '10', 10) || 1)))}
                            disabled={scanning}
                            className="mt-1 bg-gray-800/50 border-gray-700 text-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-gray-400 text-xs">Exclude Paths (comma-separated)</Label>
                          <Input
                            placeholder="/health,/status,/metrics"
                            value={excludePathsInput}
                            onChange={e => setExcludePathsInput(e.target.value)}
                            disabled={scanning}
                            className="mt-1 bg-gray-800/50 border-gray-700 text-white"
                          />
                        </div>
                      </div>

                      {/* ---- Check Modules (enable/disable categories) ---- */}
                      <div>
                        <Label className="text-gray-400 text-xs">Scan Modules</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                          {([
                            ['port_scan', 'Port Discovery', 'TCP connect scan'],
                            ['web_headers', 'Security Headers', 'CSP, HSTS, X-Frame-Options…'],
                            ['sensitive_paths', 'Sensitive Paths', '/admin, /.env, /backup…'],
                            ['ssl_tls', 'SSL/TLS Certificates', 'Expiry & validity checks'],
                            ['server_info', 'Info Disclosure', 'Server / X-Powered-By headers'],
                            ['https_redirect', 'HTTPS Redirect', 'HTTP→HTTPS enforcement'],
                          ] as Array<[keyof EnabledChecks, string, string]>).map(([key, label, desc]) => (
                            <label
                              key={key}
                              className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                options.enabled_checks[key]
                                  ? 'bg-primary/10 border-primary/40'
                                  : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={options.enabled_checks[key]}
                                onChange={e => updateCheck(key, e.target.checked)}
                                disabled={scanning}
                                className="mt-0.5 accent-primary"
                              />
                              <span>
                                <span className="block text-sm text-white">{label}</span>
                                <span className="block text-[11px] text-gray-500">{desc}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* ---- HTTP Client Behaviour (Burp/Acunetix-style) ---- */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={options.follow_redirects}
                              onChange={e => updateOption('follow_redirects', e.target.checked)}
                              disabled={scanning}
                              className="accent-primary"
                            />
                            Follow Redirects
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={options.verify_ssl}
                              onChange={e => updateOption('verify_ssl', e.target.checked)}
                              disabled={scanning}
                              className="accent-primary"
                            />
                            Verify SSL Certificates
                            <span className="text-[11px] text-gray-500">
                              (off = audit self-signed hosts)
                            </span>
                          </label>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">User-Agent</Label>
                          <Input
                            value={options.user_agent}
                            onChange={e => updateOption('user_agent', e.target.value)}
                            disabled={scanning}
                            className="mt-1 bg-gray-800/50 border-gray-700 text-white font-mono text-xs"
                          />
                        </div>
                      </div>

                      {/* ---- Reporting ---- */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={options.ai_enhanced}
                              onChange={e => updateOption('ai_enhanced', e.target.checked)}
                              disabled={scanning}
                              className="accent-primary"
                            />
                            AI-Enhanced Analysis
                            <span className="text-[11px] text-gray-500">(Gemini post-analysis)</span>
                          </label>
                        </div>
                        <div>
                          <Label className="text-gray-400 text-xs">Min Severity to Report</Label>
                          <select
                            value={options.min_severity}
                            onChange={e => updateOption('min_severity', e.target.value as ScanOptions['min_severity'])}
                            disabled={scanning}
                            className="mt-1 w-full bg-gray-800/50 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="info">Info & above (everything)</option>
                            <option value="low">Low & above</option>
                            <option value="medium">Medium & above</option>
                            <option value="high">High only</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* What gets scanned - reflects enabled check modules */}
                  <div className="bg-gray-800/30 p-4 rounded-lg">
                    <p className="text-xs text-gray-400 mb-2">🔍 What gets scanned:</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {options.enabled_checks.port_scan && (
                        <span className="px-2 py-1 bg-gray-700/50 rounded">
                          Open Ports {useCustomPorts && customPortsInput.trim() ? '(custom list)' : `(${options.port_range})`}
                        </span>
                      )}
                      {options.enabled_checks.web_headers && (
                        <span className="px-2 py-1 bg-gray-700/50 rounded">Security Headers</span>
                      )}
                      {options.enabled_checks.sensitive_paths && (
                        <span className="px-2 py-1 bg-gray-700/50 rounded">
                          Sensitive Paths ({options.intensity === 'aggressive' ? 'full wordlist' : options.intensity})
                        </span>
                      )}
                      {options.enabled_checks.ssl_tls && (
                        <span className="px-2 py-1 bg-gray-700/50 rounded">SSL/TLS Certificates</span>
                      )}
                      {options.enabled_checks.server_info && (
                        <span className="px-2 py-1 bg-gray-700/50 rounded">Info Disclosure</span>
                      )}
                      {options.enabled_checks.https_redirect && (
                        <span className="px-2 py-1 bg-gray-700/50 rounded">HTTPS Redirect</span>
                      )}
                      {options.ai_enhanced && (
                        <span className="px-2 py-1 bg-purple-900/40 text-purple-300 rounded">AI Analysis</span>
                      )}
                      {!Object.values(options.enabled_checks).some(Boolean) && (
                        <span className="px-2 py-1 bg-red-900/40 text-red-300 rounded">All modules disabled!</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* RESULTS TAB CONTENT */}
          {activeTab === 'results' && (
            <>
              {loadingResults ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : results ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <Card className={`${getRiskBg(results.risk_score)} transition-all`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Overall Security Score</p>
                          <p className={`text-6xl font-bold ${getRiskColor(results.risk_score)}`}>
                            {results.risk_score}/100
                          </p>
                          <p className="text-sm mt-2 max-w-md">{results.summary?.message}</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getRiskColor(results.risk_score)}`}>
                            {results.summary?.status}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 space-y-1">
                            <p>{totalFindings} total findings</p>
                            <div className="flex gap-2 justify-end">
                              {severityBreakdown.critical > 0 && (
                                <span className="text-red-500">C:{severityBreakdown.critical}</span>
                              )}
                              {severityBreakdown.high > 0 && (
                                <span className="text-orange-500">H:{severityBreakdown.high}</span>
                              )}
                              {severityBreakdown.medium > 0 && (
                                <span className="text-yellow-500">M:{severityBreakdown.medium}</span>
                              )}
                              {severityBreakdown.low > 0 && (
                                <span className="text-blue-500">L:{severityBreakdown.low}</span>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={startNewScan}
                            className="mt-3"
                          >
                            <Search className="w-3 h-3 mr-1" />
                            New Scan
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex gap-4 text-sm">
                          <span className="text-red-500">Critical: {severityBreakdown.critical || 0}</span>
                          <span className="text-orange-500">High: {severityBreakdown.high || 0}</span>
                          <span className="text-yellow-500">Medium: {severityBreakdown.medium || 0}</span>
                          <span className="text-blue-500">Low: {severityBreakdown.low || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {results.ai_analysis && (
                    <Card className="bg-purple-500/5 border-purple-500/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-400">
                          <Brain className="w-5 h-5" />
                          AI Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">
                          {results.ai_analysis}
                        </pre>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="bg-gray-900/50 border-gray-800">
                    <CardHeader>
                      <CardTitle>Security Findings ({totalFindings})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {results.findings.map((finding, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`p-4 rounded-lg border ${getSeverityBadge(finding.severity)}`}
                          >
                            <div className="flex items-start justify-between flex-wrap gap-2">
                              <div className="flex-1">
                                <h3 className="font-semibold">{finding.name}</h3>
                                <p className="text-sm mt-1 opacity-90">{finding.message}</p>
                                {finding.recommendation && (
                                  <p className="text-sm mt-2">
                                    <span className="font-medium">💡 Fix:</span> {finding.recommendation}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs px-2 py-1 rounded-full uppercase font-medium bg-current/10">
                                {finding.severity}
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {results.summary?.top_recommendations?.length > 0 && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader>
                        <CardTitle className="text-primary">🎯 Recommended Actions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {results.summary.top_recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-primary mt-0.5">▸</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              ) : (
                <Card className="bg-gray-900/50 border-gray-800">
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-400">No scan results to display. Run a scan or select one from history.</p>
                    <Button onClick={startNewScan} className="mt-4">
                      <Search className="w-4 h-4 mr-2" />
                      Run a Scan
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* HISTORY TAB CONTENT */}
          {activeTab === 'history' && (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Scan History ({scanHistory.length} of {stats.total_scans})
                  </CardTitle>
                  
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Show:</span>
                    <select
                      value={historyLimit}
                      onChange={(e) => handleLimitChange(Number(e.target.value))}
                      className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-700 transition-colors"
                    >
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                      <option value={200}>200 per page</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : scanHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No scans performed yet.</p>
                    <Button onClick={startNewScan} className="mt-4">
                      <Search className="w-4 h-4 mr-2" />
                      Run Your First Scan
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scanHistory.map((scan) => (
                      <div key={scan.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
                        <div 
                          className="flex-1 cursor-pointer" 
                          onClick={() => loadScanResults(scan.id)}
                        >
                          <p className="font-medium hover:text-primary transition-colors">{scan.target}</p>
                          <p className="text-xs text-gray-400">{formatDate(scan.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${getRiskColor(scan.risk_score)}`}>
                            Score: {scan.risk_score}/100
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(scan.status)}`}>
                            {scan.status}
                          </span>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => loadScanResults(scan.id)}
                            title="View results"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="text-red-500 hover:text-red-400"
                            onClick={() => deleteScan(scan.id)}
                            title="Delete scan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Custom Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-gray-900 rounded-xl border border-gray-700 shadow-2xl max-w-md w-full mx-4 overflow-hidden"
          >
            {/* Modal Header */}
            <div className={`p-4 ${
              modalType === 'delete' ? 'bg-red-500/10 border-b border-red-500/20' :
              modalType === 'success' ? 'bg-primary/10 border-b border-primary/20' :
              'bg-red-500/10 border-b border-red-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {modalType === 'delete' && <AlertTriangle className="w-6 h-6 text-red-500" />}
                  {modalType === 'success' && <CheckCircle className="w-6 h-6 text-primary" />}
                  {modalType === 'error' && <AlertTriangle className="w-6 h-6 text-red-500" />}
                  <h2 className={`text-lg font-semibold ${
                    modalType === 'delete' ? 'text-red-500' :
                    modalType === 'success' ? 'text-primary' :
                    'text-red-500'
                  }`}>
                    {modalTitle}
                  </h2>
                </div>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-300 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-gray-300 whitespace-pre-line">
                {modalMessage}
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-800/30 flex justify-end gap-3">
              {modalType === 'delete' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="gap-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmDelete}
                    className="gap-2 bg-red-600 hover:bg-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
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
    </div>
  );
};

export default SecurityScanPage;