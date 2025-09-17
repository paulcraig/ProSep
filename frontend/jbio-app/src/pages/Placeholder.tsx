import React from 'react';
import Profile from '../components/Profile';


type PlaceholderProps = {
  text: string;
};


const Placeholder: React.FC<PlaceholderProps> = ({ text }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',

        color: 'var(--text)',
        fontSize: '1.5rem'
      }}
    >
      {text}
    </div>
  );
};

export default Placeholder;
