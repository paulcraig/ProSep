import React, { useState } from 'react'
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CardHeader,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	SelectChangeEvent,
	TextField,
	Typography,
} from '@mui/material'
import { API_URL } from '../config'
import NumberField from '../components/ui/NumberField'

const PROTEASES = ['Trypsin', 'Chymostrypsin', 'Thermolysin', 'ProteinaseK'] as const

const TandemMS: React.FC = () => {
	const [proteinString, setProteinString] = useState<string>('')
	const [protease, setProtease] = useState<string>(PROTEASES[0])
	const [lowerBound, setLowerBound] = useState<number | null>(0)
	const [upperBound, setUpperBound] = useState<number | null>(3000)
	const [loading, setLoading] = useState<boolean>(false)
	const [error, setError] = useState<string>('')
	const [requestBodyText, setRequestBodyText] = useState<string | null>(null)

	const sanitizedProteinString = proteinString.toUpperCase()
	const proteinIsValid = /^[A-Z]+$/.test(sanitizedProteinString) || sanitizedProteinString.length == 0
	const proteaseIsValid = PROTEASES.some((allowedProtease) => allowedProtease === protease)
	const boundsAreValid =
		lowerBound !== null &&
		upperBound !== null &&
		Number.isFinite(lowerBound) &&
		Number.isFinite(upperBound) &&
		Number.isInteger(lowerBound) &&
		Number.isInteger(upperBound) &&
		lowerBound >= 0 &&
		lowerBound <= 3000 &&
		upperBound >= 0 &&
		upperBound <= 3000 &&
		lowerBound <= upperBound
	const inputsAreValid = proteinIsValid && proteaseIsValid && boundsAreValid

	const handleRun = async () => {
		if (!inputsAreValid) {
			return
		}

		setLoading(true)
		setError('')
		const requestBody = {
			protein_string: sanitizedProteinString,
			protease,
			lower_bound: lowerBound,
			upper_bound: upperBound,
		}
		setRequestBodyText(JSON.stringify(requestBody, null, 2))

		try {
			const response = await fetch(`${API_URL}/tandem_ms/plot`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unexpected error')
		} finally {
			setLoading(false)
		}
	}

	const handleProteaseChange = (event: SelectChangeEvent<string>) => {
		setProtease(event.target.value)
	}

	return (
		<Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
			<Card>
				<CardHeader title='Tandem Mass Spectrometry' />
				<CardContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						<TextField
							label='Protein sequence'
							value={proteinString}
							onChange={(event) => setProteinString(event.target.value)}
							multiline
							minRows={4}
							fullWidth
							required
						/>

						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
							<FormControl>
								<InputLabel id='tandem-ms-protease-label'>Protease</InputLabel>
								<Select
									labelId='tandem-ms-protease-label'
									value={protease}
									label='Protease'
									onChange={handleProteaseChange}
								>
									{PROTEASES.map((name) => (
										<MenuItem key={name} value={name}>{name}</MenuItem>
									))}
								</Select>
							</FormControl>

							<NumberField
								label='Lower bound'
								value={lowerBound}
								min={0}
								max={3000}
								step={1}
								onValueChange={setLowerBound}
							/>
							<NumberField
								label='Upper bound'
								value={upperBound}
								min={0}
								max={3000}
								step={1}
								onValueChange={setUpperBound}
							/>
						</Box>
						{!proteinIsValid && (
							<Alert severity='error'>Protein sequence must contain letters only.</Alert>
						)}
						{!proteaseIsValid && (
							<Alert severity='error'>Select one of the available proteases.</Alert>
						)}
						{!boundsAreValid && (
							<Alert severity='error'>Bounds must be integers from 0 to 3000, and the lower bound cannot exceed the upper bound.</Alert>
						)}
						{error && <Alert severity='error'>{error}</Alert>}

						<Box>
							<Button
								variant='contained'
								onClick={handleRun}
								disabled={loading || !inputsAreValid}
							>
								{loading ? 'Sending request...' : 'Run Tandem MS'}
							</Button>
						</Box>
					</Box>
				</CardContent>
			</Card>

			{requestBodyText !== null && (
				<Card>
					<CardHeader title='Request Body Sent' />
					<CardContent>
						<Typography
							component='pre'
							variant='body2'
							sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'auto' }}
						>
							{requestBodyText}
						</Typography>
					</CardContent>
				</Card>
			)}
		</Box>
	)
}

export default TandemMS
