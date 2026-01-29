import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { API_URL } from '../config';
import './ArtifactList.css';

import { Box, Card, CardContent, CardMedia, Typography, IconButton, Stack, Button } from '@mui/material';
import ReplaceIcon from '@mui/icons-material/SwapHorizRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import DragIndictor from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';


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
}

export interface ArtifactListRef {
  uploadFile: (file: File) => Promise<void>;
}


const ArtifactList = forwardRef<ArtifactListRef, ArtifactListProps>(({
  group,
  enableDownload = true,
  enableReplace = true,
  enableDelete = true,
  enableReorder = true
}, ref) => {

  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerArtifact, setViewerArtifact] = useState<Artifact | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [textContent, setTextContent] = useState<string>('');

  
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
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}`);

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data = await res.json();
      setArtifacts(data);

    } catch (err) {
      console.error(err);
    }
  }


  useEffect(() => {
    fetchArtifacts();
  }, [group]);


  async function handleUpload(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}`, {
        method: 'POST',
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
  }));


  async function handleDelete(name: string): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(name)}`, { method: 'DELETE' });

      if (!res.ok) throw new Error(`Delete failed (${res.status})`);

      await fetchArtifacts();

    } catch (err) {
      console.error(err);
    }
  }


  async function handleReplace(name: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(name)}/replace`, {
        method: 'PUT',
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
    try {
      const fileOrder = newOrder.map(f => f.name);
      const res = await fetch(`${API_URL}/artifacts/${group}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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


  async function handleCardClick(artifact: Artifact): Promise<void> {
    if (!isDragging) {
      setViewerArtifact(artifact);
      setViewerOpen(true);
      
      if (getFileType(artifact.name) === 'text') {
        try {
          const res = await fetch(`${API_URL}/artifacts/${group}/${encodeURIComponent(artifact.name)}`);

          if (res.ok) {
            const text = await res.text();
            setTextContent(text);
          }
          
        } catch (err) {
          console.error('Failed to load text content:', err);
          setTextContent('Failed to load file content');
        }
      }
    }
  }


  function renderViewerContent(): React.ReactNode {
    if (!viewerArtifact) return null;

    const fileType = getFileType(viewerArtifact.name);
    const fileUrl = `${API_URL}/artifacts/${group}/${encodeURIComponent(viewerArtifact.name)}`;

    switch (fileType) {
      case 'image':
        return (
          <img
            src={fileUrl}
            alt={viewerArtifact.name}
            className='artifact-viewer-image'
          />
        );
      
      case 'pdf':
        return (
          <Box sx={{ width: '100%', height: '100%', minHeight: '600px', background: 'white', display: 'flex' }}>
            Broken...
          </Box>
        );
      
      case 'text':
        return (
          <pre className='artifact-viewer-text'>
            {textContent}
          </pre>
        );
      
      default:
        return (
          <Box className='artifact-viewer-unsupported' sx={{ padding: '3rem' }}>
            <Typography variant='body1' sx={{ mb: 2, color: 'var(--text)' }}>
              Preview not available for this file type
            </Typography>
            <Button
              variant='contained'
              onClick={() => handleDownload(viewerArtifact.name)}
              sx={{ 
                backgroundColor: 'var(--accent)',
                '&:hover': { backgroundColor: 'var(--text)' }
              }}
            >
              Download File
            </Button>
          </Box>
        );
    }
  }


  return (
    <Box>
      <Stack direction='row' flexWrap='wrap' gap={2} sx={{ justifyContent: 'flex-start' }}>
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
            onClick={() => handleCardClick(file)}
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
                  <IconButton
                    size='small'
                    onClick={() => handleDownload(file.name)}
                    title='Download'
                    className='artifact-icon'
                  >
                    <DownloadIcon fontSize='small' />
                  </IconButton>
                )}
                {enableReplace && (
                  <IconButton
                    size='small'
                    component='label'
                    title='Replace'
                    className='artifact-icon'
                  >
                    <ReplaceIcon fontSize='small' />
                    <input
                      type='file'
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleReplace(file.name, f);
                      }}
                    />
                  </IconButton>
                )}
                {enableDelete && (
                  <IconButton
                    size='small'
                    onClick={() => handleDelete(file.name)}
                    title='Delete'
                    className='artifact-icon'
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {viewerOpen && (
        <div
          style={{
            position: 'fixed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
          }}
          onClick={() => {
            setViewerOpen(false);
            setTextContent('');
          }}
        >
          <Box
            className='artifact-viewer-container'
            onClick={(e) => e.stopPropagation()}
          >
            <Box className='artifact-viewer-header'>
              <Typography className='artifact-viewer-title'>
                {viewerArtifact?.name}
              </Typography>
              <IconButton
                onClick={() => {
                  setViewerOpen(false);
                  setTextContent('');
                }}
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
      )}
    </Box>
  );
});

export default ArtifactList;
