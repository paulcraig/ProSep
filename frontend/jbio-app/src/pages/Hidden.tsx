import React, { useEffect, useRef, useState } from 'react';
import './Hidden.css';

const KONAMI = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];


const Hidden: React.FC = () => {
  return (
    <div style={{padding: '1.75rem'}}>
      <h2 style={{color: 'var(--accent)'}}>Secret Page</h2>
    </div>
  );
};


export const useHiddenUnlock = () => {
  const [unlocked, setUnlocked] = useState(false);
  const keyDx = useRef(0);

  useEffect(() => {
    // if (process.env.NODE_ENV === 'development') {
    //   setUnlocked(true);
    //   return;
    // }

    // if (localStorage.getItem('hiddenUnlocked') === 'true') {
    //   setUnlocked(true);
    //   return;
    // }

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
