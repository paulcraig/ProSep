import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

import { Box, Card, CardContent, CardMedia, Typography, IconButton, Stack, TextField, Button, Alert } from '@mui/material';

import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';


interface Artifact {
  id: string;
  name: string;
  size: number;
  url: string;
}


export default function ArtifactList(): JSX.Element {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function fetchArtifacts(): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/artifacts`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setArtifacts(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load artifacts from the server.');
    }
  }

  useEffect(() => {
    fetchArtifacts();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/artifacts`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);

      setError(null);
      await fetchArtifacts();

    } catch (err) {
      console.error(err);
      setError('Upload failed. Please check your connection or server status.');
    }
  }

  async function handleDelete(name: string): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/artifacts/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);

      setError(null);
      await fetchArtifacts();

    } catch (err) {
      console.error(err);
      setError(`Failed to delete ${name}.`);
    }
  }

  async function handleRename(oldName: string): Promise<void> {
    if (!newName || newName === oldName) {
      setEditing(null);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/artifacts/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: newName }),
      });
      if (!res.ok) throw new Error(`Rename failed (${res.status})`);

      setError(null);
      setEditing(null);
      await fetchArtifacts();

    } catch (err) {
      console.error(err);
      setError(`Failed to rename ${oldName}.`);
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
      setError(`Failed to download ${name}.`);
    }
  }

  return (
    <Box>
      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button component='label' startIcon={<AddPhotoAlternateRoundedIcon />} sx={{ mb: 2 }}>
        Upload
        <input type='file' hidden onChange={handleUpload} />
      </Button>

      <Stack direction='row' flexWrap='wrap' gap={2} sx={{ justifyContent: 'flex-start' }}>
        {artifacts.map((file) => (
          <Card
            key={file.id}
            sx={{
              width: 260,
              height: 180,
              backgroundColor: 'var(--sub-background)',
              color: 'var(--text)',
              border: '4px solid var(--accent)',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            {/* Preview */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <CardMedia
                component='img'
                src={`${API_URL}/artifacts/${encodeURIComponent(file.name)}`}
                alt={file.name}
                sx={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </Box>

            <CardContent
              sx={{
                p: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {editing === file.name ? (
                  <TextField
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    size='small'
                    variant='outlined'
                    sx={{
                      input: {
                        color: 'var(--text)',
                        p: '2px 6px',
                      },
                    }}
                  />
                ) : (
                  <>
                    <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }} title={file.name}>
                      {file.name}
                    </Typography>
                    <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </>
                )}
              </Box>

              <Stack direction='row'>
                <IconButton
                  size='small'
                  onClick={() => handleDownload(file.name)}
                  title='Download'
                  sx={{ color: 'var(--accent)' }}
                >
                  <DownloadRoundedIcon fontSize='small' />
                </IconButton>
                <IconButton
                  size='small'
                  onClick={() => handleDelete(file.name)}
                  title='Delete'
                  sx={{ color: 'var(--accent)' }}
                >
                  <DeleteRoundedIcon fontSize='small' />
                </IconButton>
                <IconButton
                  size='small'
                  onClick={() => {
                    if (editing === file.name) {
                      handleRename(file.name);
                    } else {
                      setEditing(file.name);
                      setNewName(file.name);
                    }
                  }}
                  title={editing === file.name ? 'Save' : 'Rename'}
                  sx={{ color: 'var(--accent)' }}
                >
                  {editing === file.name ? (
                    <SaveRoundedIcon fontSize='small' />
                  ) : (
                    <EditRoundedIcon fontSize='small' />
                  )}
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
