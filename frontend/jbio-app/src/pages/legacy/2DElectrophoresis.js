import { useEffect, useRef, useState } from 'react';
import './2DElectrophoresis.extracted.css';
import { API_URL } from '../../config';
import axios from 'axios';
import waveAnimation from '../../assets/loader/wave-animation.svg';


const TwoDE = () => {
  // A bunch of frontend states to control the UI
  const canvasRef = useRef(null);

  
  const animationFrameRef = useRef(null);
  const [dots, setDots] = useState([]);
  const [hoveredDot, setHoveredDot] = useState(null);
  const [selectedDot, setSelectedDot] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [simulationState, setSimulationState] = useState('ready'); // 'ready', 'ief-running', 'ief-complete', 'sds-running', 'complete'
  const [simulationProgress, setSimulationProgress] = useState(0);

  // States for implementing requested features
  const [phRange, setPhRange] = useState({ min: 0, max: 14 });
  const [yAxisMode, setYAxisMode] = useState('mw'); // 'mw' or 'distance'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // State for PPS1-106: Acrylamide slider
  const [acrylamidePercentage, setAcrylamidePercentage] = useState(7.5); // Default value

  // State for PPS1-111: Collapsible protein list
  const [isProteinListCollapsed, setIsProteinListCollapsed] = useState(false);


  // Constants
  const MIN_PH = phRange.min;
  const MAX_PH = phRange.max;
  const PH_STEP = 2;
  const MAX_DISTANCE_TRAVELED = 6; // Maximum distance traveled in cm

  //All the constants for drawing the canvas
    const CANVAS_BG_COLOR = '#111111';
    const LOADING_ZONE_COLOR = '#333333';
    const LOADING_ZONE_X = 30;
    const LOADING_ZONE_Y = 280;
    const LOADING_ZONE_SIZE = 40;

    const LEFT_MARGIN = 50;
    const RIGHT_MARGIN = 50;
    const TOP_MARGIN_IEF = 50;
    const IEF_BAND_HEIGHT = 100;
    const PH_GRADIENT_Y = 30;
    const PH_GRADIENT_HEIGHT = 10;
    const ACID_COLOR = '#FF6B6B';
    const NEUTRAL_COLOR = '#4ECDC4';
    const BASIC_COLOR = '#45B7D1';

    const GRID_STROKE = '#444';
    const MAIN_FONT = '12px Arial';
    const SMALL_FONT = '10px Arial';

    const SDS_TOP_MARGIN = 170;
    const SDS_BOTTOM_MARGIN = 50;

    const PROGRESS_BG = '#666';
    const PROGRESS_FILL = '#4CAF50';
    const PROGRESS_Y_OFFSET = 20;
    const PROGRESS_HEIGHT = 4;

    const DOT_RADIUS = 5;
    const DOT_HOVER_RADIUS = 8;
    const HIGHLIGHT_STROKE = '#FFFFFF';
    const HIGHLIGHT_LINEWIDTH = 2;
    const PULSE_RADIUS = 12;
    const PULSE_STROKE = 'rgba(255, 255, 255, 0.5)';

    const BAND_HEIGHT = 40;


  // Shreyes: these decide the max labels for the axes, i used 0 and 1 as the starting axes
  const [minMW, setMinMW] = useState(0);
  const [maxMW, setMaxMW] = useState(1);

  //Shreyes: pan and zoom states
  const [isPanning, setIsPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Function to start running the IEF (first dimension), sets simulation 
  // state to 'ief-running' and calls the 'simulate-ief backend API to
  // run the IEF and then changes the frontend accordingly
  const startIEF = () => {
    if (simulationState !== 'ready') return;

    setSimulationState('ief-running');
    setSimulationProgress(0);

    // Prepare the data to send to the backend
    const data = {
      proteins: dots.map(dot => ({
        name: dot.name,
        fullName: dot.fullName,
        organism: dot.organism,
        ID: dot.ID,
        mw: dot.mw,
        pH: dot.pH,
        color: dot.color,
        sequence: dot.sequence,
        display_name: dot.display_name,
        Link: dot.Link
      })),
      phRange: phRange,
      canvasWidth: 800,
      canvasHeight: 600
    };

    // Call the backend API
    axios.post(`${API_URL}/2d/simulate-ief`, data)
      .then(response => {
        // Get the simulation results
        const simulationResults = response.data;
        const totalSteps = simulationResults.length;

        // Play the animation using the pre-calculated positions
        let currentStep = 0;
        const animationInterval = setInterval(() => {
          if (currentStep >= totalSteps) {
            clearInterval(animationInterval);
            setSimulationState('ief-complete');
            return;
          }

          // Update progress
          const progress = currentStep / (totalSteps - 1);
          setSimulationProgress(progress);

          // Update dots with the pre-calculated positions for this step
          setDots(simulationResults[currentStep]);

          // Move to next step
          currentStep++;
        }, 20); // Adjust timing for smoother animation
      })
      .catch(error => {
        console.error('Error in IEF simulation:', error);
        setSimulationState('ready');
      });
  };

  // Function to start running the SDS (second dimension), sets simulation 
  // state to 'sds-running' and calls the 'simulate-sds backend API to
  // run the SDS and then changes the frontend accordingly
  const startSDS = () => {
    if (simulationState !== 'ief-complete') return;

    setSimulationState('sds-running');

    // Prepare data to send to the backend
    const data = {
      proteins: dots.map(dot => ({
        name: dot.name,
        fullName: dot.fullName,
        organism: dot.organism,
        ID: dot.ID,
        mw: dot.mw,
        pH: dot.pH,
        color: dot.color,
        x: dot.x,
        y: dot.y,
        bandWidth: dot.bandWidth,
        sequence: dot.sequence,
        display_name: dot.display_name,
        Link: dot.Link
      })),
      yAxisMode: yAxisMode,
      acrylamidePercentage: acrylamidePercentage,
      canvasHeight: 600 //it's six centimeters
    };

    // Call the backend API
    axios.post(`${API_URL}/2d/simulate-sds`, data)

      .then(response => {
        console.log("SDS RESPONSE DATA:", response.data);
        // Get the simulation results
        const simulationResults = response.data;
        const totalSteps = simulationResults.length;

        // Play the animation using the pre-calculated positions
        let currentStep = 0;
        const animationInterval = setInterval(() => {
          if (currentStep >= totalSteps) {
            clearInterval(animationInterval);
            setSimulationState('complete');
            return;
          }

          // Update dots with the pre-calculated positions for this step
          setDots(simulationResults[currentStep]);

          // Move to next step
          currentStep++;
        }, 20); // Adjust timing for smoother animation
      })
      .catch(error => {
        console.error('Error in SDS simulation:', error);
        setSimulationState('ief-complete'); // Return to previous state
      });
  };

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Function to handle uploading a file to the 2DE by parsing out the files 
  // through the 'parse-fasta' backend API and then adds the new proteins 
  // to the simulation
  const handleFileUpload = async (files) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Create form data
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

      console.log(API_URL + " API URL IS HERE " + waveAnimation)

    try {
      // Upload to backend for processing
      const response = await axios.post(`${API_URL}/2d/parse-fasta`, formData);

      // Add new proteins to the existing dots
      setDots(prevDots => [...prevDots, ...response.data]);
    } catch (error) {
      console.error('Error uploading FASTA files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handler for when a dragged item enters an element
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  };

  // Handler for when a dragged item leaves an element
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragging(false);
    }
  };

  // Handler for when a dragged item is being dragged ontop 
  // of an element
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Handler for when a dragged item is dropped into an element
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = [...e.dataTransfer.files];
    await handleFileUpload(files);
  };

  // These functions remain in the frontend for direct UI use
  const getPHPosition = (pH, canvasWidth) => {
    const clampedPH = Math.min(Math.max(pH, MIN_PH), MAX_PH);
    return 50 + ((clampedPH - MIN_PH) / (MAX_PH - MIN_PH)) * (canvasWidth - 100);
  };


  const resetPositions = () => {
    setDots(prevDots => prevDots.map(dot => ({
      ...dot,
      x: 50,
      y: 300,
      currentpH: 7,
      velocity: 0,
      settled: false
    })));
    setHoveredDot(null);
    setSelectedDot(null);
    setSimulationState('ready');
    setSimulationProgress(0);

  };

  // Handler for when the mouse cursor moves on the canvas (simulation)
  // and checks if it is hovering over a dot on the simulation
const handleCanvasMouseMove = (event) => {
  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  setMousePos({ x: event.clientX, y: event.clientY });

    if (isPanning) {
    const dx = event.movementX;
    const dy = event.movementY;
    setOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
    return; // skip hover detection while panning
    }

  // --- Hover detection (only when not panning) ---
  if (!selectedDot) {
    const hoveredDot = dots.find(dot => {
        let mappedX = dot.x;
        let mappedY = dot.y;

        if (['sds-running', 'complete'].includes(simulationState)) {
          // Map SDS dot to canvas coordinates
          mappedX = LEFT_MARGIN + ((dot.pH - MIN_PH) / (MAX_PH - MIN_PH)) * (canvas.width - LEFT_MARGIN - RIGHT_MARGIN);
          const usableHeight = canvas.height - SDS_TOP_MARGIN - SDS_BOTTOM_MARGIN;
          mappedY = SDS_TOP_MARGIN + ((maxMW - dot.mw) / (maxMW - minMW)) * usableHeight;
        }

        // Apply zoom & offset
        const screenX = mappedX * zoom + offset.x;
        const screenY = mappedY * zoom + offset.y;

        const dx = x - screenX;
        const dy = y - screenY;
        return Math.sqrt(dx * dx + dy * dy) < 10;
      });
    setHoveredDot(hoveredDot);
  }
};

  // Handler for when the mouse course clicks on the document, which closes
  // the selected proteins information popup if clicked outside of the
  // canvas, info card, and protein list
  const handleDocumentClick = (event) => {
    const canvas = canvasRef.current;
    const infoCard = document.getElementById('protein-info-card');
    const proteinList = document.getElementById('protein-list');

    // Only close the popup if clicking outside the canvas, info card, and protein list
    if (selectedDot &&
      !canvas.contains(event.target) &&
      (!infoCard || !infoCard.contains(event.target)) &&
      (!proteinList || !proteinList.contains(event.target))) {
      setSelectedDot(null);
    }
  };

  // Handler for pH range input - now disabled during simulation
  const handlePhRangeChange = (type, value) => {
    if (simulationState !== 'ready') return; // Disable during simulation

    if (type === 'min') {
      // Ensure min pH is less than max pH
      const newMin = Math.min(parseFloat(value), phRange.max - 0.1);
      setPhRange(prev => ({ ...prev, min: newMin }));
    } else {
      // Ensure max pH is greater than min pH
      const newMax = Math.max(parseFloat(value), phRange.min + 0.1);
      setPhRange(prev => ({ ...prev, max: newMax }));
    }
  };

  // Handler for pH slider - now disabled during simulation
  const handlePhSliderChange = (e) => {
    if (simulationState !== 'ready') return; // Disable during simulation

    const value = parseFloat(e.target.value);
    const type = e.target.id.includes('min') ? 'min' : 'max';
    handlePhRangeChange(type, value);
  };

  // Handler for acrylamide percentage slider
  const handleAcrylamideChange = (e) => {
    if (simulationState !== 'ready') return; // Disable during simulation

    setAcrylamidePercentage(parseFloat(e.target.value));
  };

  // Toggle Y-axis mode
  const toggleYAxisMode = () => {
    setYAxisMode(prev => prev === 'mw' ? 'distance' : 'mw');
    // setproteinLocation
  };

  // Toggle protein list collapse state
  const toggleProteinList = () => {
    setIsProteinListCollapsed(!isProteinListCollapsed);
  };

  // React hook that is called when the selectedDot changes.
  // It makes a call to the document click handler
  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [selectedDot]);

  // Handler for when a new file is uploaded over an old one
  const handleFileInputChange = async (e) => {
    const files = [...e.target.files];
    await handleFileUpload(files);
  };

  // Modified to update canvas selection and show popup
  const handleProteinClick = (dot) => {
    setSelectedDot(dot);
    setHoveredDot(null);

    // Update the mouse position to position the popup correctly
    // Position it next to the protein list
    const proteinList = document.querySelector('#protein-list');
    if (proteinList) {
      const rect = proteinList.getBoundingClientRect();
      setMousePos({
        x: rect.right + 10,
        y: rect.top + 100 // Position it near the top of the panel
      });
    }

    // Scroll to the protein in the canvas if it's off-screen
    if (canvasRef.current) {
      canvasRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  // Dynamically compute min and max molecular weight (MW) from the loaded dots (proteins)
  useEffect(() => {
    if (dots && dots.length > 0) {
      // Filter out invalid or missing mw values
      const mws = dots
        .map(p => Number(p.mw))
        .filter(mw => !isNaN(mw) && mw > 0);
      if (mws.length > 0) {
        setMinMW(Math.min(...mws));
        setMaxMW(Math.max(...mws));
      }
    }
  }, [dots]);

  // React hook to handle all the different changes that may happen to the simulation
  // and draws makes sure that everything is drawn as it should be
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear initially
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // The function that handles drawing everything on the simulation
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = CANVAS_BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';

      // Draw loading zone indicator when in ready state
      if (simulationState === 'ready') {
        ctx.fillStyle = LOADING_ZONE_COLOR;
        ctx.fillRect(LOADING_ZONE_X, LOADING_ZONE_Y, LOADING_ZONE_SIZE, LOADING_ZONE_SIZE);
      }

      // Draw IEF Gel and pH gradient when not ready
      if (simulationState !== 'ready') {
        // IEF band/gel
        ctx.fillStyle = '#222222';
        ctx.fillRect(LEFT_MARGIN, TOP_MARGIN_IEF, canvas.width - (LEFT_MARGIN + RIGHT_MARGIN), IEF_BAND_HEIGHT);

        // pH gradient visualization above IEF band
        const gradient = ctx.createLinearGradient(LEFT_MARGIN, 0, canvas.width - RIGHT_MARGIN, 0);
        gradient.addColorStop(0, ACID_COLOR);   // Acidic
        gradient.addColorStop(0.5, NEUTRAL_COLOR); // Neutral
        gradient.addColorStop(1, BASIC_COLOR);   // Basic

        ctx.fillStyle = gradient;
        ctx.fillRect(LEFT_MARGIN, PH_GRADIENT_Y, canvas.width - (LEFT_MARGIN + RIGHT_MARGIN), PH_GRADIENT_HEIGHT);

        // pH range labels (small)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = SMALL_FONT;
        ctx.fillText(MIN_PH.toFixed(1), LEFT_MARGIN - 5, PH_GRADIENT_Y - 5);
        ctx.fillText(MAX_PH.toFixed(1), canvas.width - RIGHT_MARGIN - 5, PH_GRADIENT_Y - 5);
      }

      // Draw Grid
      ctx.strokeStyle = GRID_STROKE;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = MAIN_FONT;

      // Draw SDS-PAGE area separator when appropriate
      if (simulationState === 'ief-complete' || simulationState === 'sds-running' || simulationState === 'complete') {
        ctx.fillStyle = '#222222';
        ctx.fillRect(LEFT_MARGIN, SDS_TOP_MARGIN, canvas.width - (LEFT_MARGIN + RIGHT_MARGIN), canvas.height - SDS_TOP_MARGIN - SDS_BOTTOM_MARGIN);
      }

      // Draw axes when in SDS stages
      if (['sds-running', 'complete'].includes(simulationState)) {
        const topMargin = SDS_TOP_MARGIN;
        const bottomMargin = SDS_BOTTOM_MARGIN;
        const leftMargin = LEFT_MARGIN;
        const rightMargin = RIGHT_MARGIN;
        const usableHeight = canvas.height - topMargin - bottomMargin;

        // Y-Axis Labels (MW or Distance)
        if (yAxisMode === 'mw') {
          for (let y = topMargin; y <= canvas.height - bottomMargin; y += 100) {
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(canvas.width - rightMargin, y);
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';

            // Map Y → MW: top (y=topMargin) => maxMW, bottom => minMW
            const t = (y - topMargin) / usableHeight; // 0..1 top→bottom
            const mwValue = Math.round(maxMW - t * (maxMW - minMW));

            ctx.save();
            ctx.translate(15, y + 5);
            ctx.fillText(`${mwValue.toLocaleString()} Da.`, 0, 0);
            ctx.restore();
          }

          const bottomY = canvas.height - bottomMargin;
          ctx.beginPath();
          ctx.moveTo(leftMargin, bottomY);
          ctx.lineTo(canvas.width - rightMargin, bottomY);
          ctx.stroke();

          ctx.save();
          ctx.translate(15, bottomY + 5);
          ctx.fillText(`${minMW.toLocaleString()} Da.`, 0, 0);
          ctx.restore();

        } else {
          // Distance traveled axis
          for (let i = 0; i <= MAX_DISTANCE_TRAVELED; i++) {
            const y = topMargin + (i / MAX_DISTANCE_TRAVELED) * usableHeight;
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(canvas.width - rightMargin, y);
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.save();
            ctx.translate(25, y + 5);
            ctx.fillText(`${i} cm`, 0, 0);
            ctx.restore();
          }
        }

        // pH Axis vertical gridlines and labels
        for (let pH = MIN_PH; pH <= MAX_PH; pH += PH_STEP) {
          const x = getPHPosition(pH, canvas.width);
          ctx.beginPath();
          ctx.moveTo(x, topMargin);
          ctx.lineTo(x, canvas.height - bottomMargin);
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(pH.toFixed(1), x - 10, canvas.height - 30);
        }
      }

      // Draw PH axis label (now centered at bottom)
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('pH', canvas.width / 2, canvas.height - 10);

      // Vertical MW/Distance label
      ctx.save();
      ctx.translate(10, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yAxisMode === 'mw' ? 'MW (Da)' : 'Distance (cm)', 0, 0);
      ctx.restore();
      ctx.textAlign = 'left';

      // Draw progress indicator during IEF
      if (simulationState === 'ief-running') {
        ctx.fillStyle = PROGRESS_BG;
        ctx.fillRect(LEFT_MARGIN, canvas.height - PROGRESS_Y_OFFSET, canvas.width - (LEFT_MARGIN + RIGHT_MARGIN), PROGRESS_HEIGHT);
        ctx.fillStyle = PROGRESS_FILL;
        ctx.fillRect(LEFT_MARGIN, canvas.height - PROGRESS_Y_OFFSET, (canvas.width - (LEFT_MARGIN + RIGHT_MARGIN)) * simulationProgress, PROGRESS_HEIGHT);
      }

      // Draw Bands and Dots
      dots.forEach(dot => {
        const isHighlighted = dot === selectedDot;
        const isHovered = dot === hoveredDot;

        ctx.fillStyle = dot.color;

        if (simulationState === 'ready') {
          // Loading zone dots
          ctx.beginPath();

          const screenX = dot.x * zoom + offset.x;
          const screenY = dot.y * zoom + offset.y;
          ctx.arc(screenX, screenY, DOT_RADIUS * zoom, 0, Math.PI * 2);

          

          // ctx.arc(dot.x, dot.y, (isHighlighted || isHovered) ? DOT_HOVER_RADIUS : DOT_RADIUS, 0, Math.PI * 2);
          ctx.fill();

          if (isHighlighted) {
            ctx.strokeStyle = HIGHLIGHT_STROKE;
            ctx.lineWidth = HIGHLIGHT_LINEWIDTH;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(dot.x, dot.y, PULSE_RADIUS, 0, Math.PI * 2);
            ctx.strokeStyle = PULSE_STROKE;
            ctx.stroke();
          } else if (isHovered) {
            ctx.strokeStyle = HIGHLIGHT_STROKE;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        } else if (simulationState === 'ief-running' || simulationState === 'ief-complete') {
          if (dot.condensing) {
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
            ctx.fill();

            if (isHighlighted) {
              ctx.strokeStyle = HIGHLIGHT_STROKE;
              ctx.lineWidth = HIGHLIGHT_LINEWIDTH;
              ctx.stroke();
            }
          } else {
            // Vertical bands in IEF
            ctx.fillRect(dot.x - dot.bandWidth / 2,dot.y - BAND_HEIGHT / 2,dot.bandWidth,BAND_HEIGHT);

            if (isHighlighted || isHovered) {
              ctx.strokeStyle = HIGHLIGHT_STROKE;
              ctx.lineWidth = isHighlighted ? HIGHLIGHT_LINEWIDTH : 1;
              ctx.strokeRect(dot.x - dot.bandWidth / 2,dot.y - BAND_HEIGHT / 2,dot.bandWidth,BAND_HEIGHT);

              if (isHighlighted) {
                ctx.strokeStyle = PULSE_STROKE;
                ctx.lineWidth = 1;
                ctx.strokeRect(
                  dot.x - dot.bandWidth / 2 - 3,
                  dot.y - BAND_HEIGHT / 2 - 3,dot.bandWidth + 6,BAND_HEIGHT + 6);
              }
            }
          }
        } else {
          // SDS-PAGE dots mapped to pH (x) and MW (y)
          const x = LEFT_MARGIN + ((dot.pH - MIN_PH) / (MAX_PH - MIN_PH)) * (canvas.width - LEFT_MARGIN - RIGHT_MARGIN);

          const usableHeight = canvas.height - SDS_TOP_MARGIN - SDS_BOTTOM_MARGIN;
          const y = SDS_TOP_MARGIN + ((maxMW - dot.mw) / (maxMW - minMW)) * usableHeight;

          ctx.beginPath();
          ctx.arc(x, y, (isHighlighted || isHovered) ? DOT_HOVER_RADIUS : DOT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = dot.color;
          ctx.fill();

          if (isHighlighted || isHovered) {
            ctx.strokeStyle = HIGHLIGHT_STROKE;
            ctx.lineWidth = isHighlighted ? HIGHLIGHT_LINEWIDTH : 1;
            ctx.stroke();

            if (isHighlighted) {
              ctx.beginPath();
              ctx.arc(x, y, PULSE_RADIUS, 0, Math.PI * 2);
              ctx.strokeStyle = PULSE_STROKE;
              ctx.stroke();
            }
          }
        }
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [dots, hoveredDot, selectedDot, simulationState, simulationProgress, phRange, yAxisMode, acrylamidePercentage, minMW, maxMW]);



  // Function to handle hovering over a button, which causes it to change 
  // background and border colors, making it look like it is clickable
  const buttonHoverEffect = (e) => {
    e.target.style.backgroundColor = '#2a2a2a';
    e.target.style.borderColor = '#4a4a4a';
  };

  // Function to handle stopping hovering over a button, which causes
  // it to go back to its default background and border colors
  const buttonLeaveEffect = (e) => {
    e.target.style.backgroundColor = '#1a1a1a';
    e.target.style.borderColor = '#3a3a3a';
  };

  // Circular progress indicator component
  const CircularProgress = ({ progress }) => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress / 100);

    return (
      <div style={{ position: 'relative', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="50" height="50" viewBox="0 0 50 50">
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke="#333"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="25"
            cy="25"
            r={radius}
            stroke="#4CAF50"
            strokeWidth="4"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 25 25)"
          />
        </svg>
        <div style={{ position: 'absolute', fontSize: '12px' }}>
          {Math.round(progress)}%
        </div>
      </div>
    );
  };

  // Component for collapsible protein list header
  const ProteinListHeader = ({ isCollapsed, onToggle, count }) => {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={onToggle}
      >
        <h3 style={{ fontSize: '16px', margin: 0 }}>Proteins ({count})</h3>
        <div style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    );
  };

  // The actual component that is returned to render for the TwoDE
  const activeDot = selectedDot || hoveredDot;

  return (
    <div>
      <div className='simulatorBoxTwoDE'>

        <div className="twoDE-controls-col" >
          <div className="twoDE-controls-row">
            {/* First dimension button */}

            <label
              className="twoDE-button icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              onMouseOver={buttonHoverEffect}
              onMouseOut={buttonLeaveEffect}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload FASTA
              <input
                type="file"
                accept=".fasta,.fa,.faa,.FAA"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </label>

            <button
              className="twoDE-button"
              style={{
                opacity: simulationState === 'ief-running' ? 0.5 : 1,
                cursor: simulationState === 'ready' ? 'pointer' : 'not-allowed'
              }}
              onClick={startIEF}
              disabled={simulationState !== 'ready'}
              onMouseOver={buttonHoverEffect}
              onMouseOut={buttonLeaveEffect}
            >
              First Dimension
            </button>
            {/* Second dimension button */}
            <button
              className="twoDE-button"
              style={{
                opacity: simulationState !== 'ief-complete' ? 0.5 : 1,
                cursor: simulationState === 'ief-complete' ? 'pointer' : 'not-allowed'
              }}
              onClick={startSDS}
              disabled={simulationState !== 'ief-complete'}
              onMouseOver={buttonHoverEffect}
              onMouseOut={buttonLeaveEffect}
            >
              Second Dimension
            </button>
            {/* Reset button */}
            <button
              className="twoDE-button icon"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
              onClick={resetPositions}
              onMouseOver={buttonHoverEffect}
              onMouseOut={buttonLeaveEffect}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2.5 12a9.5 9.5 0 1 1 9.5 9.5 9.5 9.5 0 0 1-9.5-9.5m9.5-9.5v9.5l5-4.5" />
              </svg>
              Reset
            </button>

            {/* Upload FASTA button */}
            <button
              className="twoDE-button icon" onClick={toggleYAxisMode}onMouseOver={buttonHoverEffect}onMouseOut={buttonLeaveEffect}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v18M3 8h10M3 16h10M16 3v18M16 8h5M16 16h5" />
              </svg>
              {yAxisMode === 'mw' ? 'Show Distance' : 'Show MW'}
              {/* YAXIS BUTTON ABOVE ME */}
            </button> 
          </div>

          {/* pH Range Slider, disabled during simulation */}
          <div className="control-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <label className="twoDE-control-label" style={{ opacity: simulationState === 'ready' ? 1 : 0.5 }}>pH Range:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  type="number"
                  min="0"
                  max="14"
                  step="0.1"
                  value={phRange.min}
                  onChange={(e) => handlePhRangeChange('min', e.target.value)}
                  className="twoDE-input"
                  disabled={simulationState !== 'ready'} // Disable during simulation
                />
                <input
                  type="range"
                  id="ph-min-slider"
                  min="0"
                  max="14"
                  step="0.1"
                  value={phRange.min}
                  onChange={handlePhSliderChange}
                  className="twoDE-range"
                  disabled={simulationState !== 'ready'} // Disable during simulation
                />
                <input
                  type="range"
                  id="ph-max-slider"
                  min="0"
                  max="14"
                  step="0.1"
                  value={phRange.max}
                  onChange={handlePhSliderChange}
                  className="twoDE-range"
                  disabled={simulationState !== 'ready'} // Disable during simulation
                />
                <input
                  type="number"
                  min="0"
                  max="14"
                  step="0.1"
                  value={phRange.max}
                  onChange={(e) => handlePhRangeChange('max', e.target.value)}
                  className="twoDE-input"
                  disabled={simulationState !== 'ready'} // Disable during simulation
                />
              </div>
            </div>
          </div>

          {/* Acrylamide Percentage Slider */}
          <div className="control-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <label className="twoDE-control-label" style={{ opacity: simulationState === 'ready' ? 1 : 0.5 }}>Acrylamide %:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  type="number"
                  min="5"
                  max="20"
                  step="0.5"
                  value={acrylamidePercentage}
                  onChange={(e) => setAcrylamidePercentage(parseFloat(e.target.value))}
                  className="twoDE-input"
                  disabled={simulationState !== 'ready'} // Disable during simulation
                />
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="0.5"
                  value={acrylamidePercentage}
                  onChange={handleAcrylamideChange}
                  className="twoDE-range"
                  disabled={simulationState !== 'ready'} // Disable during simulation
                />
                <div className="twoDE-acrylic-desc" style={{ opacity: simulationState === 'ready' ? 0.8 : 0.4 }}>
                  {acrylamidePercentage < 7 ? 'Resolves large proteins' :
                    acrylamidePercentage < 12 ? 'Medium range separation' :
                      'Resolves small proteins'}
                </div>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            maxWidth: '1100px',
            margin: '0 auto'
          }}>
            {/* Protein list panel with resizable feature */}
            <div
              id="protein-list"
              className="twoDE-panel"
              style={{
                width: isProteinListCollapsed ? '80px' : '250px',
                height: '600px'
              }}
            >
              <ProteinListHeader
                isCollapsed={isProteinListCollapsed}
                onToggle={toggleProteinList}
                count={dots.length}
              />

              {/* Resizable handle */}
              <div className="twoDE-resize-handle"
                onMouseDown={(e) => {
                  const startWidth = e.currentTarget.parentElement.offsetWidth;
                  const startX = e.clientX;

                  const onMouseMove = (moveEvent) => {
                    if (isProteinListCollapsed) return;
                    const newWidth = Math.max(150, startWidth + moveEvent.clientX - startX);
                    e.currentTarget.parentElement.style.width = `${newWidth}px`;
                  };

                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                  };

                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                }}
              />

              <div className="twoDE-protein-list" style={{ opacity: isProteinListCollapsed ? 0 : 1, transition: 'opacity 0.2s', transitionDelay: isProteinListCollapsed ? '0s' : '0.1s' }}>
                {!isProteinListCollapsed && dots.map(dot => (
                  <div
                    key={dot.name}
                    onClick={() => handleProteinClick(dot)}
                    className={"twoDE-protein-item" + (selectedDot?.name === dot.name ? ' selected' : '')}
                    style={{ backgroundColor: selectedDot?.name === dot.name ? '#3a3a3a' : 'transparent' }}
                  >
                    <div className="twoDE-protein-color" style={{ backgroundColor: dot.color }} />
                    <span className="twoDE-protein-name">{dot.display_name}</span>
                  </div>
                ))}
              </div>


              {isUploading && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ marginBottom: '8px', fontSize: '14px' }}>Uploading FASTA...</div>
                      <div className="twoDE-progress">
                        {/* This svg did not work but this weird line worked idk don't touch this lol */}
                        <svg width="60" height="30" viewBox="0 0 100 50">
                        <line x1="10" y1="25" x2="10" y2="25" stroke="#7189da" stroke-width="4" stroke-linecap="round">
                        <animate attributeName="y1" values="25;10;25" dur="1s" begin="0s" repeatCount="indefinite"/>
                        <animate attributeName="y2" values="25;40;25" dur="1s" begin="0s" repeatCount="indefinite"/>
                        </line>
                        <line x1="30" y1="25" x2="30" y2="25" stroke="#7189da" stroke-width="4" stroke-linecap="round">
                        <animate attributeName="y1" values="25;10;25" dur="1s" begin="0.2s" repeatCount="indefinite"/>
                        <animate attributeName="y2" values="25;40;25" dur="1s" begin="0.2s" repeatCount="indefinite"/>
                        </line>
                        <line x1="50" y1="25" x2="50" y2="25" stroke="#7189da" stroke-width="4" stroke-linecap="round">
                        <animate attributeName="y1" values="25;10;25" dur="1s" begin="0.4s" repeatCount="indefinite"/>
                        <animate attributeName="y2" values="25;40;25" dur="1s" begin="0.4s" repeatCount="indefinite"/>
                        </line>
                        <line x1="70" y1="25" x2="70" y2="25" stroke="#7189da" stroke-width="4" stroke-linecap="round">
                        <animate attributeName="y1" values="25;10;25" dur="1s" begin="0.6000000000000001s" repeatCount="indefinite"/>
                        <animate attributeName="y2" values="25;40;25" dur="1s" begin="0.6000000000000001s" repeatCount="indefinite"/>
                        </line>
                        <line x1="90" y1="25" x2="90" y2="25" stroke="#7189da" stroke-width="4" stroke-linecap="round">
                        <animate attributeName="y1" values="25;10;25" dur="1s" begin="0.8s" repeatCount="indefinite"/>
                        <animate attributeName="y2" values="25;40;25" dur="1s" begin="0.8s" repeatCount="indefinite"/>
                        </line>
                        </svg>
                      </div>
                </div>
              )}
            </div>

            <div className="twoDE-canvas-wrapper"
              style={{ position: 'relative' }}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="twoDE-drag-overlay">
                  <div className="twoDE-drag-box">Drop FASTA files here</div>
                </div>
              )}

              {/* The actual graph part of the simulation, including the popups for protein informatiopn */}
             <canvas
              ref={canvasRef}
              width={800}
              height={600}
              onMouseDown={(e) => {setIsPanning(true)}}
              onMouseUp={() => setIsPanning(false)}
              onMouseMove={handleCanvasMouseMove}
            />

              {['sds-running', 'complete'].includes(simulationState) && (
                <div className='zoom-handler-buttons'
                  style={{position: 'absolute',top: 10,right: 10,display: 'flex',flexDirection: 'column',gap: '4px',background: 'rgba(20, 20, 20, 0)',borderRadius: '8px',padding: '4px', paddingTop: '160px'}}>
                  <button className="plus-button" onClick={() => setZoom((z) => Math.min(z * 1.1, 5))}>+</button>
                  <button className="minus-button" onClick={() => setZoom((z) => Math.max(z / 1.1, 0.5))}> - </button>
                </div>
              )}


              {/* Protein information popup - show for both canvas clicks and list clicks */}
              
              {(hoveredDot || selectedDot) && (
                <div
                  id="protein-info-card"
                  className="twoDE-card"
                  style={{
                    left: mousePos.x + 10,
                    top: mousePos.y + 10
                  }}
                >
                  <h4>{activeDot?.display_name}</h4>
                  <div className="meta">

                  <div>
                    Link:{" "}
                    {activeDot?.Link && activeDot.Link !== "N/A" ? (<a href={activeDot.Link}>{activeDot.Link}</a>) : ("N/A")}

                    <div>MW: {activeDot?.mw != null ? activeDot.mw.toLocaleString() : 'N/A'} Da</div>
                    <div>pI: {activeDot?.pH != null ? activeDot.pH.toFixed(2) : 'N/A'}</div>

                    {activeDot?.sequence && (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontWeight: 500 }}>Sequence Preview:</div>
                        <div className="sequence-preview">
                          {activeDot.sequence.substring(0, 50)}...
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default TwoDE;
