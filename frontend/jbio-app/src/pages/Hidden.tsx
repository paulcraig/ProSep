import React, { useEffect, useRef, useState } from 'react';

import ArtifactList, { ArtifactListRef } from '../components/ArtifactList';
import { API_URL } from '../config';
import './Hidden.css';

import { IconButton } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import LockResetIcon from '@mui/icons-material/LockReset';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import RefreshIcon from '@mui/icons-material/Refresh';


const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
];


const Hidden: React.FC = () => {
  const [password, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [verifyPw, setVerifyPw] = useState('');

  const [showReset, setShowReset] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'checking' | 'correct' | 'wrong'>('idle');
  const [resetStatus, setResetStatus] = useState<'idle' | 'resetting' | 'success' | 'error'>('idle');
  
  const [updateInterval, setUpdateInterval] = useState(1);
  const [updateServiceActive, setUpdateServiceActive] = useState(true);
  
  const [isLocked, setIsLocked] = useState(true);
  const [checkoutVersion, setCheckoutVersion] = useState('v5.1.2');
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{show: boolean; title: string; message: string; action: () => void; isCheckout?: boolean; isDanger?: boolean; }>
  ({
    show: false, title: '', message: '', action: () => {}, isCheckout: false, isDanger: false
  });
  const [lockOnCheckout, setLockOnCheckout] = useState(false);
  const artifactRef = useRef<ArtifactListRef>(null);

  const hashPw = async (pw: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const updateAuthState = (success: boolean, hash?: string) => {
    if (success) {
      setPwStatus('correct');
      setAuthed(true);
      if (hash) localStorage.setItem('admin-password-hash', hash);
    } else {
      setPwStatus('wrong');
      setAuthed(false);
      setShowReset(false);
      localStorage.removeItem('admin-password-hash');
    }
  };

  const checkPw = async () => {
    if (!password) return;
    setPwStatus('checking');
    
    try {
      const hash = await hashPw(password);
      const statusRes = await fetch(`${API_URL}/admin/status`);
      const statusData = await statusRes.json();

      const endpoint = statusData.password_set ? '/admin/verify' : '/admin/set-initial';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashed_password: hash }),
      });

      const data = await res.json();
      const valid = statusData.password_set ? data.valid : data.success;
      updateAuthState(res.ok && valid, hash);
    } catch (err) {
      console.error('Password verification error:', err);
      updateAuthState(false);
    }
  };

  const toggleReset = () => {
    setShowReset(!showReset);
    setNewPw('');
    setVerifyPw('');
    setResetStatus('idle');
  };

  const submitReset = async () => {
    if (!newPw || !verifyPw || newPw !== verifyPw) return;
    setResetStatus('resetting');
    
    try {
      const currentHash = localStorage.getItem('admin-password-hash');
      if (!currentHash) {
        setResetStatus('error');
        return;
      }

      const newHash = await hashPw(newPw);
      const res = await fetch(`${API_URL}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_hashed_password: currentHash,
          new_hashed_password: newHash,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetStatus('success');
        localStorage.setItem('admin-password-hash', newHash);
        setPw(newPw);
        setNewPw('');
        setVerifyPw('');
        setShowReset(false);
        setTimeout(() => setResetStatus('idle'), 1500);
        toggleReset();
      } else {
        setResetStatus('error');
        setTimeout(() => setResetStatus('idle'), 2000);
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setResetStatus('error');
      setTimeout(() => setResetStatus('idle'), 2000);
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
      title: '',
      message: '',
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

  // Action handlers:
  const handleRestartApache = () => {
    console.log('Restarting Apache...');
    // API call here TODO
  };

  const handleRestartUvicorn = () => {
    console.log('Restarting Uvicorn...');
    // API call here TODO
  };

  const handleRestartBoth = () => {
    console.log('Restarting both services...');
    // API call here TODO
  };

  const handleDeleteUploads = () => {
    console.log('Deleting all uploads...');
    // API call here TODO
  };

  const handleCheckoutVersion = () => {
    console.log(`Checking out version ${checkoutVersion}, lock: ${lockOnCheckout}`);
    // API call here TODO
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !artifactRef.current) return;

    Array.from(files).forEach((file) => {
      artifactRef.current!.uploadFile(file);
    });

    e.target.value = '';
  };

  const handleRefresh = () => {
    if (!authed) return;
    
    setIsRefreshing(true);
    console.log('Refreshing app status and danger zone data...');
    // API calls to refresh data TODO
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Mock data
  const versionInfo = {
    version: 'v5.1.2',
    remoteVersion: 'v5.1.3',
    creationDate: '2025-02-08',
    notes: 'Performance improvements and bug fixes for long running processes with memory optimization',
    prs: [
      { id: 142, title: 'Fix memory leak in peptide retention', url: '#' },
      { id: 141, title: 'Update dependencies', url: '#' },
      { id: 140, title: 'Improve error handling', url: '#' }
    ]
  };

  const availableVersions = ['v5.1.2', 'v5.1.1', 'v5.1.0', 'v5.0.3', 'v5.0.2'];

  const serverHealth = {
    uptime: '7d 14h 32m',
    apache: {
      requestsPerMinute: 3120,
      errorRate: 0.02,
      avgResponseTime: 28,
      serviceRunning: true
    },
    uvicorn: {
      requestsPerMinute: 2450,
      errorRate: 0.15,
      avgResponseTime: 42,
      processRunning: true
    }
  };

  // Calculate server health:
  const getServerHealth = () => {
    const apacheHealthy = serverHealth.apache.serviceRunning && 
                          serverHealth.apache.errorRate < 1 && 
                          serverHealth.apache.avgResponseTime < 100;
    const uvicornHealthy = serverHealth.uvicorn.processRunning && 
                           serverHealth.uvicorn.errorRate < 1 && 
                           serverHealth.uvicorn.avgResponseTime < 100;
    
    if (apacheHealthy && uvicornHealthy) return 'Good';
    if (!serverHealth.apache.serviceRunning || !serverHealth.uvicorn.processRunning) return 'Bad';
    if (serverHealth.apache.errorRate > 2 || serverHealth.uvicorn.errorRate > 2) return 'Bad';
    return 'Poor';
  };

  return (
    <div className='hidden-page'>
      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className='modal-overlay' onClick={closeModal}>
          <div className={`modal-content ${confirmModal.isDanger ? 'danger' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h3 className='modal-title'>{confirmModal.title}</h3>
            <p className='modal-message'>{confirmModal.message}</p>
            
            {confirmModal.isCheckout && (
              <div className='modal-checkout-options'>
                <div className='modal-lock-toggle'>
                  <IconButton
                    size='small'
                    className='lock-toggle'
                    onClick={() => setLockOnCheckout(!lockOnCheckout)}
                  >
                    {lockOnCheckout ? <LockIcon fontSize='small' /> : <LockOpenIcon fontSize='small' />}
                  </IconButton>
                  <span className='modal-lock-label'>
                    {lockOnCheckout ? 'Lock to this version' : 'Don\'t lock version'}
                  </span>
                </div>
              </div>
            )}

            <div className='modal-actions'>
              <button className='modal-button cancel' onClick={closeModal}>
                Cancel
              </button>
              <button className='modal-button confirm' onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Authentication Section */}
      <div className='admin-section full-width'>
        <div className='admin-card'>
          <h3 className='section-header-inside'>Login</h3>
          
          {/* Authentication Row */}
          <div className='password-auth-container'>
            {/* Single Password Input */}
            <div className='password-auth-inputs'>
              <div className='password-input-group'>
                <div className='password-input-wrapper'>
                  <input
                    type='password'
                    className={`admin-input password-input ${pwStatus}`}
                    value={password}
                    onChange={(e) => {
                      setPw(e.target.value);
                      setPwStatus('idle');
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && checkPw()}
                    placeholder='Enter admin password'
                  />
                  <div className={`password-status-indicator ${pwStatus}`} />
                </div>
              </div>
            </div>

            {/* Authenticate Button */}
            <button 
              className='auth-button'
              onClick={checkPw}
              disabled={!password}
            >
              Authenticate
            </button>

            {/* Reset Toggle */}
            <IconButton
              size='small'
              className={`reset-password-toggle ${resetStatus === 'success' || resetStatus === 'error' ? `flash-${resetStatus}` : ''}`}
              onClick={toggleReset}
              disabled={!authed}
              title={showReset ? 'Cancel' : 'Reset Password'}
            >
              {showReset ? <CloseIcon /> : <LockResetIcon />}
            </IconButton>

            {/* Password Reset Inputs */}
            {showReset && (
              <div className='password-reset-inputs'>
                <div className='password-input-group'>
                  <input
                    type='password'
                    className='admin-input'
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitReset()}
                    placeholder='Enter new password'
                  />
                </div>
                <div className='password-input-group'>
                  <input
                    type='password'
                    className='admin-input'
                    value={verifyPw}
                    onChange={(e) => setVerifyPw(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitReset()}
                    placeholder='Re-enter new password'
                  />
                </div>
              </div>
            )}

            {/* Confirm Reset Button */}
            {showReset && (
              <button 
                className='auth-button confirm-reset-button'
                disabled={!newPw || !verifyPw || newPw !== verifyPw || resetStatus === 'resetting'}
                onClick={submitReset}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Server Health and Danger Zone Row */}
      <div className='dual-section-row'>
        {/* Server Health Section */}
        <div className='admin-section flex-section'>
          <div className={`admin-card ${!authed ? 'disabled' : ''}`}>
            <div className='status-header-with-refresh'>
              <h3 className='section-header-inside'>App Status</h3>
              <IconButton
                size='small'
                className={`refresh-button ${isRefreshing ? 'spinning' : ''}`}
                onClick={handleRefresh}
                disabled={!authed || isRefreshing}
                title='Refresh Status'
              >
                <RefreshIcon fontSize='small' />
              </IconButton>
            </div>
            
            <div className='health-grid'>
              {/* Version Info Box */}
              <div className='metric-section version-box'>
                <div className='version-header-row'>
                  <span className='metric-section-title'>Tag {versionInfo.version}</span>
                  <IconButton
                    size='small'
                    className='lock-toggle'
                    onClick={() => setIsLocked(!isLocked)}
                    title={isLocked ? 'Version Locked' : 'Version Unlocked'}
                    disabled={!authed || !updateServiceActive}
                  >
                    {isLocked ? <LockIcon fontSize='small' /> : <LockOpenIcon fontSize='small' />}
                  </IconButton>
                </div>
                <span className='version-date'>Created: {versionInfo.creationDate} • Remote {versionInfo.remoteVersion}</span>
                <div className='version-notes'>{versionInfo.notes}</div>
                <div className='pr-list-compact'>
                  {versionInfo.prs.map(pr => (
                    <a key={pr.id} href={pr.url} className='pr-link' target='_blank' rel='noopener noreferrer'>
                      #{pr.id} - {pr.title}
                    </a>
                  ))}
                </div>
              </div>

              {/* Apache Metrics */}
              <div className='metric-section'>
                <div className='metric-section-title'>Apache (Frontend)</div>
                <div className='metric-item'>
                  <span className='metric-label'>Req/min:</span>
                  <span className='metric-value'>{serverHealth.apache.requestsPerMinute.toLocaleString()}</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Error Rate:</span>
                  <span className='metric-value'>{serverHealth.apache.errorRate}%</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Response Time:</span>
                  <span className='metric-value'>{serverHealth.apache.avgResponseTime}ms</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Service Running:</span>
                  <span className={`status-badge ${serverHealth.apache.serviceRunning ? 'running' : 'stopped'}`}>
                    {serverHealth.apache.serviceRunning ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* Uvicorn Metrics */}
              <div className='metric-section'>
                <div className='metric-section-title'>Uvicorn (Backend)</div>
                <div className='metric-item'>
                  <span className='metric-label'>Req/min:</span>
                  <span className='metric-value'>{serverHealth.uvicorn.requestsPerMinute.toLocaleString()}</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Error Rate:</span>
                  <span className='metric-value'>{serverHealth.uvicorn.errorRate}%</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Response Time:</span>
                  <span className='metric-value'>{serverHealth.uvicorn.avgResponseTime}ms</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Process Running:</span>
                  <span className={`status-badge ${serverHealth.uvicorn.processRunning ? 'running' : 'stopped'}`}>
                    {serverHealth.uvicorn.processRunning ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* System Status */}
              <div className='metric-section'>
                <div className='metric-section-title'>Sever (Host)</div>
                <div className='metric-item'>
                  <span className='metric-label'>Uptime:</span>
                  <span className='metric-value'>{serverHealth.uptime}</span>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Auto Update:</span>
                  <div className={`service-status-chip ${updateServiceActive ? 'active' : 'inactive'}`}>
                    <span>{updateServiceActive ? 'Active' : 'Inactive'}</span>
                    <IconButton
                      size='small'
                      className='service-toggle-inline'
                      onClick={() => setUpdateServiceActive(!updateServiceActive)}
                      title={updateServiceActive ? 'Pause Service' : 'Resume Service'}
                      disabled={!authed}
                    >
                      {updateServiceActive ? <PauseIcon fontSize='small' /> : <PlayArrowIcon fontSize='small' />}
                    </IconButton>
                  </div>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Update Interval:</span>
                  <div className={`interval-wrapper ${!updateServiceActive || !authed ? 'disabled' : ''}`}>
                    <input
                      type='number'
                      className='interval-input'
                      value={updateInterval}
                      onChange={(e) => setUpdateInterval(Number(e.target.value))}
                      min='1'
                      max='60'
                      disabled={!updateServiceActive || !authed}
                    />
                    <span className='interval-unit'>min</span>
                  </div>
                </div>
                <div className='metric-item'>
                  <span className='metric-label'>Server Health:</span>
                  <span className={`health-badge ${getServerHealth().toLowerCase()}`}>
                    {getServerHealth()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div className='admin-section danger-zone flex-section'>
          <div className={`admin-card danger-card ${!authed ? 'disabled' : ''}`}>
            <h3 className='section-header-inside danger-header'>Danger Zone</h3>
            
            <div className='danger-grid'>
              {/* Versions Box */}
              <div className='metric-section checkout-box'>
                <div className='metric-section-title danger-section-title'>Versions</div>
                <div className='version-selector'>
                  <select
                    className='version-dropdown'
                    value={checkoutVersion}
                    onChange={(e) => setCheckoutVersion(e.target.value)}
                    disabled={!authed}
                  >
                    {availableVersions.map(version => (
                      <option key={version} value={version}>
                        {version} {version === versionInfo.version ? '(current)' : ''}
                      </option>
                    ))}
                  </select>
                  <button 
                    className='danger-button checkout-button' 
                    disabled={!authed || checkoutVersion === versionInfo.version}
                    onClick={() => showConfirmation(
                      'Checkout Version',
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
              <div className='metric-section danger-actions-box'>
                <div className='metric-section-title danger-section-title'>Services</div>
                <button 
                  className='danger-button restart-button' 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    'Restart Apache',
                    'Are you sure you want to restart the Apache (Frontend) service? This may cause brief downtime.',
                    handleRestartApache,
                    false,
                    true
                  )}
                >
                  Restart Apache (Frontend)
                </button>
                
                <button 
                  className='danger-button restart-button' 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    'Restart Uvicorn',
                    'Are you sure you want to restart the Uvicorn (Backend) service? This may cause brief downtime.',
                    handleRestartUvicorn,
                    false,
                    true
                  )}
                >
                  Restart Uvicorn (Backend)
                </button>
                
                <button 
                  className='danger-button restart-button critical' 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    'Restart Application',
                    'Are you sure you want to restart BOTH services? This will cause downtime.',
                    handleRestartBoth,
                    false,
                    true
                  )}
                >
                  Restart App
                </button>
                <button 
                  className='danger-button restart-button critical' 
                  disabled={!authed}
                  onClick={() => showConfirmation(
                    'Delete ALL Document Uploads',
                    'Are you sure you want to delete ALL uploaded files? This action cannot be undone!',
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
      <div className='admin-section full-width'>
        <div className={`admin-card ${!authed ? 'disabled' : ''}`}>
          <div className='section-header-with-upload'>
            <h3 className='section-header-inside'>Home Page</h3>
            <input
              type='file'
              id='document-upload'
              className='hidden-file-input'
              onChange={handleFileChange}
              multiple
              disabled={!authed}
            />
            <IconButton
              size='small'
              className='upload-icon-button'
              onClick={() => document.getElementById('document-upload')?.click()}
              disabled={!authed}
              title='Upload Documents'
            >
              <UploadFileIcon fontSize='small' />
            </IconButton>
          </div>

          <ArtifactList
            group='about'
            ref={artifactRef}
            visibleRows={1}
            enableDownload={true}
            enableReplace={true}
            enableDelete={true}
            enableReorder={true}
            passwordHash={localStorage.getItem('admin-password-hash') || undefined}
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
    if (process.env.NODE_ENV === 'development') {
      setUnlocked(true);
      return;
    }

    if (localStorage.getItem('hiddenUnlocked') === 'true') {
      setUnlocked(true);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI[keyDx.current]) {
        keyDx.current++;

        if (keyDx.current === KONAMI.length) {
          setUnlocked(true);
          localStorage.setItem('hiddenUnlocked', 'true');
          window.removeEventListener('keydown', onKeyDown);
        }
      } else { keyDx.current = 0; }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return unlocked;
};


export default Hidden;
