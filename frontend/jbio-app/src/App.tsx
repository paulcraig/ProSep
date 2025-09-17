import logo from './assets/basil-logo.png';
import Placeholder from './pages/Placeholder';
import Dashboard from './components/Dashboard';

import GitHubIcon from '@mui/icons-material/GitHub';
import HomeIcon from '@mui/icons-material/HomeRounded';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';


function App() {
  const pages = [
    { id: 1, icon: <HomeIcon />, component: <Placeholder text='Page 1' />, label: 'Project Information' },
    { id: 2, icon: <ShowChartIcon />, component: <Placeholder text='Page 2' />, label: '1D Electrophoresis' },
    { id: 3, icon: <BubbleChartIcon />, component: <Placeholder text='Page 3' />, label: '2D Electrophoresis' },
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
