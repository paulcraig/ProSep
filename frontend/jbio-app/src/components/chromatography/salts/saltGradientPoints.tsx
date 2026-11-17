import { MAX_SALT_DELTA } from "./consts"

/*
 * Create (x, y) points that correspond to the salt gradient at any given fraction.
 * Typically fed into a graph
 */
export function saltGradientPoints(data: {
    params: { saltStart: number; saltEnd: number, saltElbowLocation: number }
    fractions: Array<{ fractionIndex: number }>
}): Array<{ x: number; y: number }> {
    const fractions = data.fractions ?? []
    const totalFractions = Math.max(1, fractions.length)

    // Start the gradient after an initial loading/binding region
    const gradientStartFraction = Math.max(MAX_SALT_DELTA, Math.floor(totalFractions * data.params.saltElbowLocation))

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
