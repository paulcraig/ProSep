import { Timer } from "@mui/icons-material"
import { Box } from "@mui/material"
import { useRef, useState } from "react"

function formatTime(timeInSeconds: number) {
    const minutes = Math.floor(timeInSeconds / 60)
    const secondsRemainder = timeInSeconds % 60
    const secondsRemainderFormatted = secondsRemainder.toString().padStart(2, '0')
    return minutes > 0 ? `${minutes}m ${secondsRemainderFormatted}s` : `${secondsRemainderFormatted}s`
}

export function useTimer() {
    const [timeInSeconds, setTimeInSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    function startTimer() {
        if (timerRef.current) clearInterval(timerRef.current)

        timerRef.current = setInterval(() => {
            setTimeInSeconds((prev) => prev + 1)
        }, 1000)

        setIsTimerRunning(true)
    }

    function stopTimer() {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        setIsTimerRunning(false)
    }

    return {
        startTimer,
        stopTimer,
        setTimeInSeconds,
        isTimerRunning,
        timeInSeconds
    }
}

export type StopwatchProps = {
    timeInSeconds: number
    isTimerRunning: boolean
}
export function Stopwatch({ timeInSeconds, isTimerRunning }: StopwatchProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: 'bold',
            }}
            color={isTimerRunning ? 'text' : 'text.disabled'}
        >
            <Timer fontSize='small' style={{ marginRight: '0.25rem' }} />
            {formatTime(timeInSeconds)}
        </Box>
    )
}
