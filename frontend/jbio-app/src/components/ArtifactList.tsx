import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useRef, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';

import { API_URL } from '../config';
import './ArtifactList.css';

import { Box, Card, CardContent, CardMedia, Typography, IconButton, Stack, Button, CircularProgress } from '@mui/material';
import ReplaceIcon from '@mui/icons-material/SwapHorizRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import DragIndictor from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';


interface Artifact {
  id: string;
  name: string;
  size: number;
  url: string;
}

interface ArtifactListProps {
  group: string;
  enableDownload?: boolean;
  enableReplace?: boolean;
  enableDelete?: boolean;
  enableReorder?: boolean;
  visibleRows?: number;
  artifactsPerRow?: number;
  encryptedPassword?: string;
  speedDial?: boolean;
}

export interface ArtifactListRef {
  uploadFile: (file: File) => Promise<void>;
  refresh: () => Promise<void>;
}

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;


const ArtifactList = forwardRef<ArtifactListRef, ArtifactListProps>(({
  group,
  enableDownload = true,
  enableReplace = true,
  enableDelete = true,
  enableReorder = true,
  visibleRows,
  artifactsPerRow,
  encryptedPassword,
  speedDial = false,
}, ref) => {

  const GAP = 16;
  const CARD_HEIGHT = 250;
  
  const fetchingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const speedDialRef = useRef<HTMLDivElement>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [textContent, setTextContent] = useState<string>('');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  const viewerArtifact = viewerIndex !== null ? (artifacts[viewerIndex] ?? null) : null;
  
  
  const gridTemplateColumns = useMemo(() =>
    artifactsPerRow ? `repeat(${artifactsPerRow}, 1fr)` : `repeat(auto-fill, minmax(280px, 1fr))`,
    [artifactsPerRow]
  );

  
  const maxHeight = useMemo(() =>
    visibleRows ? (CARD_HEIGHT + GAP) * visibleRows - GAP : undefined,
    [visibleRows]
  );

  
  const updateOverscrollBehavior = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const hasOverflow = container.scrollHeight > container.clientHeight;
      container.style.overscrollBehavior = hasOverflow ? 'contain' : 'auto';
    }
  }, []);


  useEffect(() => {
    updateOverscrollBehavior();
  }, [artifacts, gridTemplateColumns, maxHeight, updateOverscrollBehavior]);

  
  function getFileExtension(filename: string): string {
    return filename.slice(filename.lastIndexOf('.')).toLowerCase();
  }

  
  function getFileType(filename: string): 'image' | 'pdf' | 'text' | 'other' {
    const ext = getFileExtension(filename);
    
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'].includes(ext)) {
      return 'image';
    }
    if (ext === '.pdf') {
      return 'pdf';
    }
    if (['.txt', '.md', '.json', '.xml', '.csv', '.log', '.py', '.js', '.html', '.css', '.fasta', '.faa'].includes(ext)) {
      return 'text';
    }
    return 'other';
  }

  
  async function fetchArtifacts(): Promise<void> {
    if (fetchingRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }

    fetchingRef.current = true;
    
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}`);

      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setArtifacts(data);

    } catch (err) {
      console.error(err);

    } finally {
      fetchingRef.current = false;
    }
  }


  useEffect(() => {
    if (!speedDialOpen) return;
    const handler = (e: MouseEvent) => {
      if (speedDialRef.current && !speedDialRef.current.contains(e.target as Node)) {
        setSpeedDialOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [speedDialOpen]);


  useEffect(() => {
    fetchArtifacts();
  }, [group]);


  async function handleUpload(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    const headers: HeadersInit = {};
    if (encryptedPassword) headers['X-Encrypted-Password'] = encryptedPassword;
    
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      await fetchArtifacts();

    } catch (err) {
      console.error(err);
    }
  }


  useImperativeHandle(ref, () => ({
    uploadFile: handleUpload,
    refresh: fetchArtifacts,
  }));


  async function handleDelete(name: string): Promise<void> {
    const headers: HeadersInit = {};
    if (encryptedPassword) headers['X-Encrypted-Password'] = encryptedPassword;
    
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) throw new Error(`Delete failed (${res.status})`);

      await fetchArtifacts();

    } catch (err) {
      console.error(err);
    }
  }


  async function handleReplace(name: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    const headers: HeadersInit = {};
    if (encryptedPassword) headers['X-Encrypted-Password'] = encryptedPassword;
    
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(name)}/replace`, {
        method: 'PUT',
        headers,
        body: formData,
      });

      if (!res.ok) throw new Error(`Replace failed (${res.status})`);

      await fetchArtifacts();

    } catch (err) {
      console.error(err);
    }
  }


  async function handleDownload(name: string): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = name;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
    }
  }


  async function saveOrder(newOrder: Artifact[]): Promise<void> {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (encryptedPassword) headers['X-Encrypted-Password'] = encryptedPassword;
    
    try {
      const fileOrder = newOrder.map(f => f.name);
      const res = await fetch(`${API_URL}/artifacts/${group}/reorder`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ file_order: fileOrder }),
      });

      if (!res.ok) throw new Error(`Reorder failed (${res.status})`);

    } catch (err) {
      console.error(err);
      await fetchArtifacts();
    }
  }


  function handleDragStart(e: React.DragEvent, index: number): void {
    if (!enableReorder) return;
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.75';
    }
  }


  function handleDragEnd(e: React.DragEvent): void {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => setIsDragging(false), 100);
  }


  function handleDragOver(e: React.DragEvent, index: number): void {
    if (!enableReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }


  function handleDragLeave(): void {
    setDragOverIndex(null);
  }


  function handleDrop(e: React.DragEvent, dropIndex: number): void {
    if (!enableReorder) return;
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newArtifacts = [...artifacts];
    const draggedItem = newArtifacts[draggedIndex];

    newArtifacts.splice(draggedIndex, 1);
    newArtifacts.splice(dropIndex, 0, draggedItem);

    setArtifacts(newArtifacts);
    setDragOverIndex(null);
    saveOrder(newArtifacts);
  }


  async function openViewer(index: number): Promise<void> {
    const artifact = artifacts[index];
    setViewerIndex(index);
    setViewerOpen(true);
    setTextContent('');
    setNumPages(null);
    setViewerLoading(true);

    if (getFileType(artifact.name) === 'text') {
      try {
        const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(artifact.name)}`);
        if (res.ok) setTextContent(await res.text());
        else setTextContent('Failed to load file content');
      } catch {
        setTextContent('Failed to load file content');
      }
      setViewerLoading(false);
    } else if (getFileType(artifact.name) === 'other') {
      setViewerLoading(false);
    }
  }


  function navigateViewer(delta: number): void {
    if (viewerIndex === null) return;
    openViewer((viewerIndex + delta + artifacts.length) % artifacts.length);
  }


  function handleCardClick(index: number): void {
    if (!isDragging) openViewer(index);
  }


  function renderViewerContent(): React.ReactNode {
    if (!viewerArtifact) return null;

    const fileType = getFileType(viewerArtifact.name);
    const fileUrl = `${API_URL}/artifacts/${group}/${encodeURIComponent(viewerArtifact.name)}`;

    return (
      <Box sx={{ position: 'relative', width: '100%', minHeight: '24rem', display: 'flex', alignItems: 'stretch' }}>
        {viewerLoading && (
          <Box className='artifact-viewer-loading'>
            <CircularProgress sx={{ color: 'var(--accent)' }} />
          </Box>
        )}
        <Box sx={{ width: '100%', visibility: viewerLoading ? 'hidden' : 'visible', display: 'flex', alignItems: 'stretch' }}>
          {fileType === 'image' && (
            <img
              src={fileUrl}
              alt={viewerArtifact.name}
              className='artifact-viewer-image'
              onLoad={() => setViewerLoading(false)}
              onError={() => setViewerLoading(false)}
            />
          )}
          {fileType === 'pdf' && (
            <Box sx={{ overflow: 'auto', width: '100%' }}>
              <Document
                file={fileUrl}
                loading=""
                onLoadSuccess={({ numPages }) => { setNumPages(numPages); setViewerLoading(false); }}
                onLoadError={() => setViewerLoading(false)}
              >
                {Array.from(new Array(numPages), (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    renderTextLayer
                    renderAnnotationLayer
                  />
                ))}
              </Document>
            </Box>
          )}
          {fileType === 'text' && (
            <pre className='artifact-viewer-text'>{textContent}</pre>
          )}
          {fileType === 'other' && (
            <Box className='artifact-viewer-unsupported' sx={{ padding: '3rem' }}>
              <Typography variant='body1' sx={{ mb: 2, color: 'var(--text)' }}>
                Preview not available for this file type
              </Typography>
              <Button
                variant='contained'
                onClick={() => handleDownload(viewerArtifact.name)}
                sx={{ backgroundColor: 'var(--accent)', '&:hover': { backgroundColor: 'var(--text)' } }}
              >
                Download File
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    );
  }


  const viewerModal = viewerOpen && (
    <div
      style={{
        position: 'fixed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
      }}
      onClick={() => { setViewerOpen(false); setTextContent(''); setViewerLoading(false); }}
    >
      <Box className='artifact-viewer-container' onClick={(e) => e.stopPropagation()}>
        <Box className='artifact-viewer-header'>
          <Box className='artifact-viewer-header-left'>
            {artifacts.length > 1 && (
              <IconButton size='small' className='artifact-viewer-nav' onClick={() => navigateViewer(-1)}>
                <ChevronLeftIcon />
              </IconButton>
            )}
            <Typography className='artifact-viewer-title'>
              {viewerArtifact?.name}
            </Typography>
            {artifacts.length > 1 && (
              <IconButton size='small' className='artifact-viewer-nav' onClick={() => navigateViewer(1)}>
                <ChevronRightIcon />
              </IconButton>
            )}
          </Box>
          <IconButton
            onClick={() => { setViewerOpen(false); setTextContent(''); setViewerLoading(false); }}
            className='artifact-viewer-close'
            size='small'
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box className='artifact-viewer-content'>
          {renderViewerContent()}
        </Box>
      </Box>
    </div>
  );

  if (!artifacts.length) return null;

  if (speedDial) {
    return (
      <Box className='artifact-speed-dial' ref={speedDialRef}>
        <IconButton
          className='speed-dial-trigger'
          onClick={() => setSpeedDialOpen((o) => !o)}
          title={speedDialOpen ? 'Close files' : 'Open files'}
        >
          {speedDialOpen ? <FolderOpenIcon /> : <FolderIcon />}
        </IconButton>
        {speedDialOpen && (
          <Box className='speed-dial-list'>
            {artifacts.map((file, index) => (
              <Box
                key={file.id}
                className='speed-dial-item'
                onClick={() => { openViewer(index); setSpeedDialOpen(false); }}
              >
                <Typography className='speed-dial-name' title={file.name}>
                  {file.name}
                </Typography>
                {enableDownload && (
                  <IconButton
                    size='small'
                    className='artifact-icon'
                    title='Download'
                    onClick={(e) => { e.stopPropagation(); handleDownload(file.name); }}
                  >
                    <DownloadIcon fontSize='small' />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        )}
        {viewerModal}
      </Box>
    );
  }

  return (
    <Box>
      <Box
        className='artifact-container'
        ref={containerRef}
        sx={{
          gridTemplateColumns,
          maxHeight: maxHeight ? `${maxHeight}px` : 'none',
        }}
      >
        {artifacts.map((file, index) => (
          <Card
            key={file.id}
            className={`artifact-card ${dragOverIndex === index ? 'drag-over' : ''}`}
            draggable={enableReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => handleCardClick(index)}
          >
            <Box className='artifact-media-container'>
              {enableReorder && (
                <Box className='artifact-drag-icon'>
                  <DragIndictor fontSize='small' />
                </Box>
              )}
              <CardMedia
                component='img'
                className='artifact-media'
                src={`${API_URL}/artifacts/${group}/${encodeURIComponent(file.name)}/preview`}
                alt={file.name}
              />
            </Box>
            <CardContent className='artifact-content'>
              <Box className='artifact-info'>
                <Typography className='artifact-name' title={file.name}>
                  {file.name}
                </Typography>
                <Typography className='artifact-size'>
                  {file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(2)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                </Typography>
              </Box>
              <Stack direction='row' className='artifact-actions' onClick={(e) => e.stopPropagation()}>
                {enableDownload && (
                  <IconButton size='small' onClick={() => handleDownload(file.name)} title='Download' className='artifact-icon'>
                    <DownloadIcon fontSize='small' />
                  </IconButton>
                )}
                {enableReplace && (
                  <IconButton size='small' component='label' title='Replace' className='artifact-icon'>
                    <ReplaceIcon fontSize='small' />
                    <input type='file' hidden onChange={(e) => e.target.files?.[0] && handleReplace(file.name, e.target.files[0])}/>
                  </IconButton>
                )}
                {enableDelete && (
                  <IconButton size='small' onClick={() => handleDelete(file.name)} title='Delete' className='artifact-icon'>
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
      {viewerModal}
    </Box>
  );
});

export default ArtifactList;
