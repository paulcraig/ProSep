import logo from './assets/basil-logo.png';
import Dashboard from './components/Dashboard';

import About from './pages/About';

import OneDE from "./pages/1DE";
import TwoDE from "./pages/legacy/2DElectrophoresis.js";

import GitHubIcon from "@mui/icons-material/GitHub";
import HomeIcon from "@mui/icons-material/HomeRounded";
import InsightsIcon from "@mui/icons-material/Insights";
import HiddenIcon from '@mui/icons-material/Terminal';

import Hidden, { useHiddenUnlock } from './pages/Hidden';

import SwapVertIcon from '@mui/icons-material/SwapVert';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';

import { ReactComponent as OneDEIcon } from "./assets/electrophoresis/1DE.svg";
import { ReactComponent as TwoDEIcon } from "./assets/electrophoresis/2DE.svg";

import PeptideRetention from "./pages/PeptideRetention";
import IonExchangeFractionation from "./pages/IonExchangeFractionation";
import HydrophobicInteractionFractionation from "./pages/HydrophobicInteractionFractionation";
import SizeExclusionPage from './pages/SizeExclusion';

function App() {
  const pages = [
    {
      id: 1,
      icon: <HomeIcon />,
      component: <About />,
      label: "Project Information",
      artifactGroup: "about"
    },
    ...(useHiddenUnlock() ? [{ id: 99, icon: <HiddenIcon />, component: <Hidden />, label: 'Team Information' }] : []),
    {
      id: 2,
      icon: <OneDEIcon />,
      component: <OneDE />,
      label: "1D Electrophoresis",
      artifactGroup: "1de"
    },
    {
      id: 3,
      icon: <TwoDEIcon />,
      component: <TwoDE />,
      label: "2D Electrophoresis",
      artifactGroup: "2de"
    },
    {
      id: 4,
      icon: <InsightsIcon />,
      component: <PeptideRetention />,
      label: "Peptide Retention",
      artifactGroup: "peptide_retention"
    },
    {
      id: 6,
      icon: <SwapVertIcon />,
      component: <IonExchangeFractionation />,
      label: "Ion Exchange Fractionation",
      artifactGroup: "ion_exchange",
    },
      {
      id: 7,
      icon: <SwapVertIcon />,
      component: <SizeExclusionPage />,
      label: "SizeExclusionPage",
      artifactGroup: "ion_exchange",
    },
    {
      id: 7,
      icon: <SwapVertIcon />,
      component: <HydrophobicInteractionFractionation />,
      label: "Hydrophobic Interaction Fractionation",
    },
    {
      id: 8,
      icon: <GitHubIcon />,
      link: "https://github.com/paulcraig/ProSep",
      label: "GitHub Repository",
    },
  ];

  return <Dashboard pages={pages} homepage={1} darkmode={true} logo={logo} />;
}

export default App;
