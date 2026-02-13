import React, { useEffect, useRef, useState } from "react";

import ArtifactList, { ArtifactListRef } from "../components/ArtifactList";
import { API_URL, getPublicKey } from "../config";
import "./Hidden.css";
import JSEncrypt from "jsencrypt";

import { IconButton } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import LockResetIcon from "@mui/icons-material/LockReset";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import RefreshIcon from "@mui/icons-material/Refresh";


const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a"
];

interface PRInfo {
  id: number;
  title: string;
  url: string;
}

interface VersionInfo {
  version: string;
  remoteVersion: string;
  creationDate: string;
  notes: string;
  prs: PRInfo[];
}

interface ServiceMetrics {
  requestsPerMinute: number;
  errorRate: number;
  memoryMb: number;
  serviceRunning?: boolean;
  processRunning?: boolean;
}

interface ServerHealth {
  uptime: string;
  apache: ServiceMetrics;
  uvicorn: ServiceMetrics;
}


const Hidden: React.FC = () => {
  const [password, setPw] = useState(() => {
    // Load cached password on mount
    return localStorage.getItem("admin-cached-password") || "";
  });
  const [newPw, setNewPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authedPw, setAuthedPw] = useState("");
  const [verifyPw, setVerifyPw] = useState("");

  const [showReset, setShowReset] = useState(false);
  const [pwStatus, setPwStatus] = useState<"idle" | "checking" | "correct" | "wrong">("idle");
  const [resetStatus, setResetStatus] = useState<"idle" | "resetting" | "success" | "error">("idle");
  
  const [updateInterval, setUpdateInterval] = useState(1);
  const [updateServiceActive, setUpdateServiceActive] = useState(true);
  
  const [isLocked, setIsLocked] = useState(true);
  const [lockOnCheckout, setLockOnCheckout] = useState(false);
  const [checkoutVersion, setCheckoutVersion] = useState("v5.1.2");

  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  
  const artifactRef = useRef<ArtifactListRef>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{show: boolean; title: string; message: string; action: () => void; isCheckout?: boolean; isDanger?: boolean; }>
  ({
    show: false, title: "", message: "", action: () => {}, isCheckout: false, isDanger: false
  });

  // Cache password to localStorage whenever it changes
  useEffect(() => {
    if (password) {
      localStorage.setItem("admin-cached-password", password);
    } else {
      localStorage.removeItem("admin-cached-password");
    }
  }, [password]);


  const getAuthHeaders = (): HeadersInit => {
    const headers: HeadersInit = {};
    const hash = localStorage.getItem("admin-encrypted-password");
    if (hash) headers["X-Encrypted-Password"] = hash;
    return headers;
  };


  const getAuthJsonHeaders = (): HeadersInit => {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    const hash = localStorage.getItem("admin-encrypted-password");
    if (hash) headers["X-Encrypted-Password"] = hash;
    return headers;
  };


  const fetchData = async () => {
    try {
      const [versionRes, perfRes, autoUpdateRes] = await Promise.all([
        fetch(`${API_URL}/status/version`),
        fetch(`${API_URL}/status/performance`),
        fetch(`${API_URL}/status/auto-update`)
      ]);

      if (versionRes.ok) {
        const data = await versionRes.json();
        setVersionInfo({
          version: data.version,
          remoteVersion: data.remote_version,
          creationDate: data.creation_date,
          notes: data.notes,
          prs: data.prs
        });
        setAvailableVersions(data.available_versions);
        setIsLocked(data.locked);
        setCheckoutVersion(data.version);
      }

      if (perfRes.ok) {
        const data = await perfRes.json();
        setServerHealth({
          uptime: data.uptime,
          apache: {
            requestsPerMinute: data.apache.requests_per_minute,
            errorRate: data.apache.error_rate,
            memoryMb: data.apache.memory_mb,
            serviceRunning: data.apache.service_running
          },
          uvicorn: {
            requestsPerMinute: data.uvicorn.requests_per_minute,
            errorRate: data.uvicorn.error_rate,
            memoryMb: data.uvicorn.memory_mb,
            processRunning: data.uvicorn.process_running
          }
        });
      }

      if (autoUpdateRes.ok) {
        const data = await autoUpdateRes.json();
        setUpdateServiceActive(data.active);
        setUpdateInterval(data.interval_minutes);
      }
    } catch (err) {
      console.error("Failed to fetch status data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (password && !authed) {
      checkPw();
    }
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsRefreshing(true);
      fetchData().then(() => {
        setTimeout(() => setIsRefreshing(false), 500);
      });
    }, 60000); // Refresh status every minute.

    return () => clearInterval(intervalId);
  }, []);


  const encryptPw = async (pw: string): Promise<string | false> => {
    try {
      const publicKey = await getPublicKey();
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(publicKey);
      return encrypt.encrypt(pw);
    } catch (err) {
      console.error("Failed to encrypt password:", err);
      return false;
    }
  };


  const updateAuthState = (success: boolean, encrypted?: string, pw?: string) => {
    if (success) {
      setPwStatus("correct");
      setAuthed(true);
      if (encrypted) localStorage.setItem("admin-encrypted-password", encrypted);
      if (pw) setAuthedPw(pw);
    } else {
      setPwStatus("wrong");
      setAuthed(false);
      setAuthedPw("");
      setShowReset(false);
      localStorage.removeItem("admin-encrypted-password");
      localStorage.removeItem("admin-cached-password"); // Clear cached password on failed auth
    }
  };


  const checkPw = async () => {
    if (!password) return;
    setPwStatus("checking");
    
    try {
      const encrypted = await encryptPw(password);
      if (!encrypted) {
        setPwStatus("wrong");
        return;
      }

      fetch(`${API_URL}/admin/status`)
        .then(res => res.json())
        .then(statusData => {
          const endpoint = statusData.password_set ? "/admin/verify" : "/admin/set-initial";
          return fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ encrypted_password: encrypted }),
          }).then(res => res.json().then(data => ({ res, data, encrypted })));
        })
        .then(({ res, data, encrypted }) => {
          const valid = data.valid !== undefined ? data.valid : data.success;
          updateAuthState(res.ok && valid, encrypted, password);
        })
        .catch(err => {
          console.error("Password verification error:", err);
          updateAuthState(false);
        });
    } catch (err) {
      console.error("Password encryption error:", err);
      updateAuthState(false);
    }
  };


  const toggleReset = () => {
    setShowReset(!showReset);
    setNewPw("");
    setVerifyPw("");
    setResetStatus("idle");
  };


  const submitReset = async () => {
    if (!newPw || !verifyPw || newPw !== verifyPw) return;
    setResetStatus("resetting");
    
    try {
      const currentEncrypted = localStorage.getItem("admin-encrypted-password");
      if (!currentEncrypted) {
        setResetStatus("error");
        return;
      }

      const newEncrypted = await encryptPw(newPw);
      if (!newEncrypted) {
        setResetStatus("error");
        return;
      }

      fetch(`${API_URL}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_encrypted_password: currentEncrypted,
          new_encrypted_password: newEncrypted,
        }),
      })
        .then(res => res.json().then(data => ({ res, data })))
        .then(({ res, data }) => {
          if (res.ok && data.success) {
            setResetStatus("success");
            localStorage.setItem("admin-encrypted-password", newEncrypted);
            setPw(newPw);
            setAuthedPw(newPw);
            setNewPw("");
            setVerifyPw("");
            setShowReset(false);
            setTimeout(() => setResetStatus("idle"), 1500);
          } else {
            setResetStatus("error");
            setTimeout(() => setResetStatus("idle"), 2000);
          }
        })
        .catch(err => {
          console.error("Password reset error:", err);
          setResetStatus("error");
          setTimeout(() => setResetStatus("idle"), 2000);
        });
    } catch (err) {
      console.error("Password encryption error:", err);
      setResetStatus("error");
      setTimeout(() => setResetStatus("idle"), 2000);
    }
  };


  const showConfirmation = (title: string, message: string, action: () => void, isCheckout = false, isDanger = false) => {
    setConfirmModal({
      show: true,
      title,
      message,
      action,
      isCheckout,
      isDanger
    });
    if (isCheckout) {
      setLockOnCheckout(false);
    }
  };


  const closeModal = () => {
    setConfirmModal({
      show: false,
      title: "",
      message: "",
      action: () => {},
      isCheckout: false,
      isDanger: false
    });
    setLockOnCheckout(false);
  };


  const handleConfirm = () => {
    confirmModal.action();
    closeModal();
  };


  const handleRestartApache = async () => {
    try {
      const res = await fetch(`${API_URL}/status/restart/apache`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (res.ok) console.log("Apache restart initiated");
    } catch (err) {
      console.error("Failed to restart Apache:", err);
    }
  };


  const handleRestartUvicorn = async () => {
    try {
      fetch(`${API_URL}/status/restart/uvicorn`, {
        method: "POST",
        headers: getAuthHeaders()

      }).catch(() => {
        console.log("Uvicorn restart initiated (connection lost as expected)");
      });
      
      console.log("Uvicorn restart initiated - backend will restart shortly");

    } catch (err) {
      console.error("Failed to restart Uvicorn:", err);
    }
  };


  const handleRestartBoth = async () => {
    try {
      fetch(`${API_URL}/status/restart/app`, {
        method: "POST",
        headers: getAuthHeaders()

      }).catch(() => {
        console.log("App restart initiated (connection lost as expected)");
      });
      
      console.log("Full app restart initiated - services will restart shortly");

    } catch (err) {
      console.error("Failed to restart app:", err);
    }
  };


  const handleDeleteUploads = async () => {
    try {
      const res = await fetch(`${API_URL}/artifacts`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`Deleted ${data.groups_deleted} artifact group(s)`);

        if (artifactRef.current) {
          artifactRef.current.refresh();
        }
      }
    } catch (err) {
      console.error("Failed to delete uploads:", err);
    }
  };


  const handleCheckoutVersion = async () => {
    try {
      const res = await fetch(`${API_URL}/status/version/checkout`, {
        method: "POST",
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ version: checkoutVersion, lock: lockOnCheckout })
      });
      if (res.ok) {
        console.log(`Checked out version ${checkoutVersion}`);
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to checkout version:", err);
    }
  };


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !artifactRef.current) return;

    Array.from(files).forEach((file) => {
      artifactRef.current!.uploadFile(file);
    });

    e.target.value = "";
  };


  const handleRefresh = async () => {
    if (!authed) return;
    
    setIsRefreshing(true);
    await fetchData();
    setTimeout(() => setIsRefreshing(false), 500);
  };


  const handleToggleAutoUpdate = async () => {
    try {
      const res = await fetch(`${API_URL}/status/auto-update/activate`, {
        method: "POST",
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ active: !updateServiceActive })
      });
      if (res.ok) {
        setUpdateServiceActive(!updateServiceActive);
      }
    } catch (err) {
      console.error("Failed to toggle auto-update:", err);
    }
  };


  const handleUpdateInterval = async (newInterval: number) => {
    try {
      const res = await fetch(`${API_URL}/status/auto-update/interval`, {
        method: "POST",
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ interval_minutes: newInterval })
      });
      if (res.ok) {
        setUpdateInterval(newInterval);
      }
    } catch (err) {
      console.error("Failed to update interval:", err);
    }
  };


  const handleToggleLock = async () => {
    try {
      const res = await fetch(`${API_URL}/status/version/lock`, {
        method: "POST",
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ locked: !isLocked })
      });
      if (res.ok) {
        setIsLocked(!isLocked);
      }
    } catch (err) {
      console.error("Failed to toggle lock:", err);
    }
  };

  
  const getServerHealth = () => {
    if (!serverHealth) return "Unknown";
    if (process.env.NODE_ENV === "development") return "Local";
    
    const apacheHealthy = serverHealth.apache.serviceRunning && 
                          serverHealth.apache.errorRate <= 5;

    const uvicornHealthy = serverHealth.uvicorn.processRunning && 
                           serverHealth.uvicorn.errorRate <= 5;
    
    if (apacheHealthy && uvicornHealthy) return "Good";
    if (!serverHealth.apache.serviceRunning || !serverHealth.uvicorn.processRunning) return "Bad";
    if (serverHealth.apache.errorRate > 10 || serverHealth.uvicorn.errorRate > 10) return "Bad";
    
    return "Poor";
  };


  return (
    <div className="hidden-page">
      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className={`modal-content ${confirmModal.isDanger ? "danger" : ""}`} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{confirmModal.title}</h3>
            <p className="modal-message">{confirmModal.message}</p>
            
            {confirmModal.isCheckout && (
              <div className="modal-checkout-options">
                <div className="modal-lock-toggle">
                  <IconButton
                    size="small"
                    className="lock-toggle"
                    onClick={() => setLockOnCheckout(!lockOnCheckout)}
                  >
                    {lockOnCheckout ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                  </IconButton>
                  <span className="modal-lock-label">
                    {lockOnCheckout ? "Lock to this version" : "Don\"t lock version"}
                  </span>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="modal-button cancel" onClick={closeModal}>
                Cancel
              </button>
              <button className="modal-button confirm" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Authentication Section */}
      <div className="admin-section full-width">
        <div className="admin-card">
          <h3 className="section-header-inside">Login</h3>
          
          {/* Authentication Row */}
          <div className="password-auth-container">
            {/* Single Password Input */}
            <div className="password-auth-inputs">
              <div className="password-input-group">
                <div className="password-input-wrapper">
                  <input
                    type="password"
                    className={`admin-input password-input ${pwStatus}`}
                    value={password}
                    onChange={(e) => {
                      setPw(e.target.value);
                      setPwStatus("idle");
                    }}
                    onKeyPress={(e) => e.key === "Enter" && checkPw()}
                    placeholder="Enter admin password"
                  />
                  <div className={`password-status-indicator ${pwStatus}`} />
                </div>
              </div>
            </div>

            {/* Authenticate Button */}
            <button 
              className="auth-button"
              onClick={checkPw}
              disabled={!password || (authed && password === authedPw)}
            >
              Authenticate
            </button>

            {/* Reset Toggle */}
            <IconButton
              size="small"
              className={`reset-password-toggle ${resetStatus === "success" || resetStatus === "error" ? `flash-${resetStatus}` : ""}`}
              onClick={toggleReset}
              disabled={!authed}
              title={showReset ? "Cancel" : "Reset Password"}
            >
              {showReset ? <CloseIcon /> : <LockResetIcon />}
            </IconButton>

            {/* Password Reset Inputs */}
            {showReset && (
              <div className="password-reset-inputs">
                <div className="password-input-group">
                  <input
                    type="password"
                    className="admin-input"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitReset()}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="password-input-group">
                  <input
                    type="password"
                    className="admin-input"
                    value={verifyPw}
                    onChange={(e) => setVerifyPw(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitReset()}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>
            )}

            {/* Confirm Reset Button */}
            {showReset && (
              <button 
                className="auth-button confirm-reset-button"
                disabled={!newPw || !verifyPw || newPw !== verifyPw || resetStatus === "resetting"}
                onClick={submitReset}
              >
                Update
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Server Health and Danger Zone Row */}
      <div className="dual-section-row">
        {/* Server Health Section */}
        <div className="admin-section flex-section">
          <div className={`admin-card ${!authed ? "disabled" : ""}`}>
            <div className="status-header-with-refresh">
              <h3 className="section-header-inside">App Status</h3>
              <IconButton
                size="small"
                className={`refresh-button ${isRefreshing ? "spinning" : ""}`}
                onClick={handleRefresh}
                disabled={!authed || isRefreshing}
                title="Refresh Status"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </div>
            
            <div className="health-grid">
              {/* Version Info Box */}
              <div className="metric-section version-box">
                <div className="version-header-row">
                  <span className="metric-section-title">Tag {versionInfo?.version || "Loading..."}</span>
                  <IconButton
                    size="small"
                    className="lock-toggle"
                    onClick={handleToggleLock}
                    title={isLocked ? "Version Locked" : "Version Unlocked"}
                    disabled={!authed || !updateServiceActive}
                  >
                    {isLocked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
                  </IconButton>
                </div>
                <span className="version-date">Created: {versionInfo?.creationDate || "..."} • Remote {versionInfo?.remoteVersion || "..."}</span>
                <div className="version-notes">{versionInfo?.notes || "Loading..."}</div>
                <div className="pr-list-compact">
                  {versionInfo?.prs?.map(pr => (
                    <a key={pr.id} href={pr.url} className="pr-link" target="_blank" rel="noopener noreferrer">
                      #{pr.id} - {pr.title}
                    </a>
                  )) || null}
                </div>
              </div>

              {/* Apache Metrics */}
              <div className="metric-section">
                <div className="metric-section-title">Apache (Frontend)</div>
                <div className="metric-item">
                  <span className="metric-label">Req/min:</span>
                  <span className="metric-value">{serverHealth?.apache?.requestsPerMinute?.toLocaleString() || "..."}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Error Rate:</span>
                  <span className="metric-value">{serverHealth?.apache?.errorRate ?? "0"}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Memory Use:</span>
                  <span className="metric-value">{serverHealth?.apache?.memoryMb ?? "0"}MB</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Service Running:</span>
                  <span className={`status-badge ${serverHealth?.apache?.serviceRunning ? "running" : "stopped"}`}>
                    {serverHealth?.apache?.serviceRunning ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {/* Uvicorn Metrics */}
              <div className="metric-section">
                <div className="metric-section-title">Uvicorn (Backend)</div>
                <div className="metric-item">
                  <span className="metric-label">Req/min:</span>
                  <span className="metric-value">{serverHealth?.uvicorn?.requestsPerMinute?.toLocaleString() || "..."}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Error Rate:</span>
                  <span className="metric-value">{serverHealth?.uvicorn?.errorRate ?? "0"}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Memory Use:</span>
                  <span className="metric-value">{serverHealth?.uvicorn?.memoryMb ?? "0"}MB</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Process Running:</span>
                  <span className={`status-badge ${serverHealth?.uvicorn?.processRunning ? "running" : "stopped"}`}>
                    {serverHealth?.uvicorn?.processRunning ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {/* System Status */}
              <div className="metric-section">
                <div className="metric-section-title">Sever (Host)</div>
                <div className="metric-item">
                  <span className="metric-label">Uptime:</span>
                  <span className="metric-value">{serverHealth?.uptime || "..."}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Auto Update:</span>
                  <div className={`service-status-chip ${updateServiceActive ? "active" : "inactive"}`}>
                    <span>{updateServiceActive ? "Active" : "Inactive"}</span>
                    <IconButton
                      size="small"
                      className="service-toggle-inline"
                      onClick={handleToggleAutoUpdate}
                      title={updateServiceActive ? "Pause Service" : "Resume Service"}
                      disabled={!authed}
                    >
                      {updateServiceActive ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                    </IconButton>
                  </div>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Update Interval:</span>
                  <div className={`interval-wrapper ${!updateServiceActive || !authed ? "disabled" : ""}`}>
                    <input
                      type="number"
                      className="interval-input"
                      value={updateInterval}
                      onChange={(e) => setUpdateInterval(Number(e.target.value))}
                      onBlur={(e) => handleUpdateInterval(Number(e.target.value))}
                      min="1"
                      max="60"
                      disabled={!updateServiceActive || !authed}
                    />
                    <span className="interval-unit">min</span>
                  </div>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Server Health:</span>
                  <span className={`health-badge ${getServerHealth().toLowerCase()}`}>
                    {getServerHealth()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div className="admin-section danger-zone flex-section">
          <div className={`admin-card danger-card ${!authed ? "disabled" : ""}`}>
            <h3 className="section-header-inside danger-header">Danger Zone</h3>
            
            <div className="danger-grid">
              {/* Versions Box */}
              <div className="metric-section checkout-box">
                <div className="metric-section-title danger-section-title">Versions</div>
                <div className="version-selector">
                  <select
                    className="version-dropdown"
                    value={checkoutVersion}
                    onChange={(e) => setCheckoutVersion(e.target.value)}
                    disabled={!authed || !availableVersions?.length}
                  >
                    {availableVersions.map(version => (
                      <option key={version} value={version}>
                        {version} {version === versionInfo?.version ? "(current)" : ""}
                      </option>
                    ))}
                  </select>
                  <button 
                    className="danger-button checkout-button" 
                    disabled={!authed || checkoutVersion === versionInfo?.version}
                    onClick={() => showConfirmation(
                      "Checkout Version",
                      `Are you sure you want to checkout version ${checkoutVersion}? This will restart the application.`,
                      handleCheckoutVersion,
                      true,
                      true
                    )}
                  >
                    Checkout
                  </button>
                </div>
              </div>

              {/* Services Actions Box */}
              <div className="metric-section danger-actions-box">
                <div className="metric-section-title danger-section-title">Services</div>
                <button 
                  className="danger-button restart-button" 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    "Restart Apache",
                    "Are you sure you want to restart the Apache (Frontend) service? This may cause brief downtime.",
                    handleRestartApache,
                    false,
                    true
                  )}
                >
                  Restart Apache (Frontend)
                </button>
                
                <button 
                  className="danger-button restart-button" 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    "Restart Uvicorn",
                    "Are you sure you want to restart the Uvicorn (Backend) service? This may cause brief downtime.",
                    handleRestartUvicorn,
                    false,
                    true
                  )}
                >
                  Restart Uvicorn (Backend)
                </button>
                
                <button 
                  className="danger-button restart-button critical" 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    "Restart Application",
                    "Are you sure you want to restart BOTH services? This will cause downtime.",
                    handleRestartBoth,
                    false,
                    true
                  )}
                >
                  Restart App
                </button>
                <button 
                  className="danger-button restart-button critical" 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    "Delete ALL Document Uploads",
                    "Are you sure you want to delete ALL uploaded files? This action cannot be undone!",
                    handleDeleteUploads,
                    false,
                    true
                  )}
                >
                  Delete Uploads
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="admin-section full-width">
        <div className={`admin-card ${!authed ? "disabled" : ""}`}>
          <div className="section-header-with-upload">
            <h3 className="section-header-inside">Home Page</h3>
            <input
              type="file"
              id="document-upload"
              className="hidden-file-input"
              onChange={handleFileChange}
              multiple
              disabled={!authed}
            />
            <IconButton
              size="small"
              className="upload-icon-button"
              onClick={() => document.getElementById("document-upload")?.click()}
              disabled={!authed}
              title="Upload Documents"
            >
              <UploadFileIcon fontSize="small" />
            </IconButton>
          </div>

          <ArtifactList
            group="about"
            ref={artifactRef}
            enableDownload={true}
            enableReplace={true}
            enableDelete={true}
            enableReorder={true}
            encryptedPassword={localStorage.getItem("admin-encrypted-password") || undefined}
          />
        </div>
      </div>
    </div>
  );
};


export const useHiddenUnlock = () => {
  const [unlocked, setUnlocked] = useState(false);
  const keyDx = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setUnlocked(true);
      return;
    }

    if (localStorage.getItem("hiddenUnlocked") === "true") {
      setUnlocked(true);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI[keyDx.current]) {
        keyDx.current++;

        if (keyDx.current === KONAMI.length) {
          setUnlocked(true);
          localStorage.setItem("hiddenUnlocked", "true");
          window.removeEventListener("keydown", onKeyDown);
        }
      } else { keyDx.current = 0; }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return unlocked;
};


export default Hidden;
