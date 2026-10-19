/*
 * Build the salt gradient overlay for the chromatogram.
 * It stays flat initially, then transitions toward saltEnd across later fractions.
 */
export function saltGradientPoints(data: {
    params: { saltStart: number; saltEnd: number }
    fractions: Array<{ fractionIndex: number }>
}): Array<{ x: number; y: number }> {
    const fractions = data.fractions ?? []
    const totalFractions = Math.max(1, fractions.length)

    // Start the gradient after an initial loading/binding region.
    const gradientStartFraction = Math.max(2, Math.floor(totalFractions * 0.18))

    return fractions.map((f, index) => {
        let y = data.params.saltStart

        if (index + 1 > gradientStartFraction) {
            const progress = (index + 1 - gradientStartFraction) / Math.max(1, totalFractions - gradientStartFraction)
            y = data.params.saltStart + (data.params.saltEnd - data.params.saltStart) * progress
        }

        return {
            x: f.fractionIndex,
            y,
        }
    })
}
