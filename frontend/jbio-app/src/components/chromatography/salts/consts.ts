/**
 * This describes the largest difference between the starting and ending salt that the user can specify.
 *
 * Because the lowest salt the user can specify is 0 (because concentrations cannot be negative), this can also be treated as MAX_SALT.
 * We call it a delta because that allows it to generalize better across chromatographies that may treat salt differently 
 */
export const MAX_SALT_DELTA = 2

/**
 * This describes at what percentage of fractions should the salt gradient start transitioning from salt start to salt end.
 * 
 * This constant could potentially be adjusted by the user. This would require parameterization of this constant similar to other salt settings.
 */
export const SALT_ELBOW_LOCATION = 0.18