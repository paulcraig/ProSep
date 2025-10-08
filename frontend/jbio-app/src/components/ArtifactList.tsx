import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { API_URL } from '../config';
import './ArtifactList.css';

import { Box, Card, CardContent, CardMedia, Typography, IconButton, Stack } from '@mui/material';
import ReplaceIcon from '@mui/icons-material/SwapHorizRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import DragIndictor from '@mui/icons-material/DragIndicator';


interface Artifact {
  id: string;
  name: string;
  size: number;
  url: string;
}


export interface ArtifactListRef {
  uploadFile: (file: File) => Promise<void>;
}


const ArtifactList = forwardRef<ArtifactListRef>((_, ref) => {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  
  async function fetchArtifacts(): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/artifacts`);

      if (!res.ok) throw new Error(`Server responded ${res.status}`);

      const data = await res.json();
      setArtifacts(data);

    } catch (err) {
      console.error(err);
    }
  }


  useEffect(() => {
    fetchArtifacts();
  }, []);


  async function handleUpload(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/artifacts`, {
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
      const res = await fetch(`${API_URL}/artifacts/${encodeURIComponent(name)}`, { method: 'DELETE' });

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
      const res = await fetch(`${API_URL}/artifacts/${encodeURIComponent(name)}/replace`, {
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
      const res = await fetch(`${API_URL}/artifacts/${encodeURIComponent(name)}`);
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
      const res = await fetch(`${API_URL}/artifacts/reorder`, {
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
    setDraggedIndex(index);
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
  }


  function handleDragOver(e: React.DragEvent, index: number): void {
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


  return (
    <Box>
      <Stack direction='row' flexWrap='wrap' gap={2} sx={{ justifyContent: 'flex-start' }}>
        {artifacts.map((file, index) => (
          <Card
            key={file.id}
            className={`artifact-card ${dragOverIndex === index ? 'drag-over' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
          >
            <Box className='artifact-media-container'>
              <Box className='artifact-drag-icon'>
                <DragIndictor fontSize='small' />
              </Box>
              <CardMedia
                component='img'
                className='artifact-media'
                src={`${API_URL}/artifacts/${encodeURIComponent(file.name)}/preview`}
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
              <Stack direction='row' className='artifact-actions'>
                <IconButton
                  size='small'
                  onClick={() => handleDownload(file.name)}
                  title='Download'
                  className='artifact-icon'
                >
                  <DownloadIcon fontSize='small' />
                </IconButton>
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
                <IconButton
                  size='small'
                  onClick={() => handleDelete(file.name)}
                  title='Delete'
                  className='artifact-icon'
                >
                  <DeleteIcon fontSize='small' />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
});

export default ArtifactList;
