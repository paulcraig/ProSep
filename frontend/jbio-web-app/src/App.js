import { useLocalStorage } from 'usehooks-ts'
import Sidebar from './components/Sidebar.js';
import Router from './Router.js';
import './App.css';


function App() {
    const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage('isSidebarOpen', true);
    const preference = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const [isDark, setIsDark] = useLocalStorage('isDark', preference);

    return (
        <div className="app-container" data-theme={isDark ? "dark" : "light"}>
            <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} isDark={isDark} />
            <Router isOpen={isSidebarOpen} />
            {/* <DarkToggle isChecked={isDark} handleChange={() => setIsDark(!isDark)} /> */} {/* Potentially add darkmode back when fixed */}
        </div>
    );
}

export default App;
