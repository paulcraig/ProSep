import React, { useEffect, useRef, useState } from 'react';
import './Hidden.css';

import ArtifactList, { ArtifactListRef } from '../components/ArtifactList';

import { Box, IconButton, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/UploadFile';

const KONAMI = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];


const Hidden: React.FC = () => {
  const artifactRef = useRef<ArtifactListRef>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && artifactRef.current) {
      artifactRef.current.uploadFile(file);
    }
  };

  return (
    <div className="hidden-page">
      <Box className="hidden-header">
        <IconButton
          component="label"
          size="small"
          className="hidden-upload-btn"
          title="Upload File"
        >
          <UploadIcon />
          <input type="file" hidden onChange={handleFileChange} />
        </IconButton>
        <h2 className="section-header">Artifacts</h2>
      </Box>

      <ArtifactList ref={artifactRef} />
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
