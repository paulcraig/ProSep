import React, { useEffect, useState } from 'react';
import './Hidden.css';


const Hidden: React.FC = () => {
  return (
    <div>
      <h2>Secret Page</h2>
    </div>
  );
};


export const useHiddenUnlock = () => {
  const [unlocked, setUnlocked] = useState(false);
  let keyDx = 0;

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setUnlocked(true);
      return;
    }

    if (localStorage.getItem('hiddenUnlocked') === 'true') {
      setUnlocked(true);
      return;
    }

    const konami = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'b', 'a'
    ];

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === konami[keyDx]) {
        keyDx++;

        if (keyDx === konami.length) {
          setUnlocked(true);
          localStorage.setItem('hiddenUnlocked', 'true');
          window.removeEventListener('keydown', onKeyDown);
        }
      } else { keyDx = 0; }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return unlocked;
};

export default Hidden;
