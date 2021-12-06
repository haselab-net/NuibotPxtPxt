export let color_blue: string = '#26c6da'
export let color_blue_light: string = '#bbdefb'
export let color_red: string = '#ef5350'
export let color_grey: string = '#e0e1e2'

export function getAsArray<T>(val: T | T[]): T[] {
    return Array.isArray(val) ? val : [val]
}

export interface Point {
    x: number;
    y: number;
}
