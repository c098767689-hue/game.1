import React from 'react';
import { Game } from './components/Game';

const App: React.FC = () => {
  return (
    <div className="w-full h-screen bg-neutral-900 text-white overflow-hidden">
      <Game />
    </div>
  );
};

export default App;