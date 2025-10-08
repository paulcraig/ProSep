import logo from './assets/basil-logo.png';
import Dashboard from './components/Dashboard';
import About from './pages/About';

import OneDE from './pages/legacy/1DElectrophoresis.js'
import TwoDE from './pages/legacy/2DElectrophoresis.js'

import GitHubIcon from '@mui/icons-material/GitHub';
import HomeIcon from '@mui/icons-material/HomeRounded';
import { ReactComponent as OneDEIcon } from './assets/electrophoresis/1DE.svg';
import { ReactComponent as TwoDEIcon } from './assets/electrophoresis/2DE.svg';
import PeptideRetention from './pages/PeptideRetention';

function App() {
  const pages = [
    { id: 1, icon: <HomeIcon />, component: <About />, label: 'Project Information' },
    { id: 2, icon: <OneDEIcon />, component: <OneDE />, label: '1D Electrophoresis' },
    { id: 3, icon: <TwoDEIcon />, component: <TwoDE />, label: '2D Electrophoresis' },
    { id: 4, icon: <HomeIcon/>, component: <PeptideRetention />, label: 'Peptide Retention Prediction' },
    { id: 4, icon: <GitHubIcon />, link: 'https://github.com/paulcraig/ProSep', label: 'GitHub Repository' },
  ];

  return (
    <Dashboard
      pages={pages}
      homepage={1}
      darkmode={true}
      logo={logo}
    />
  );
}

export default App;
