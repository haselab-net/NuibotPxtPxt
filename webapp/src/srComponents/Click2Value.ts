import * as React from 'react';

export class Click2Value {
    private readonly div: HTMLDivElement
    constructor(div: HTMLDivElement) {
        this.div = div
    }
    calculate(mouseX: number, min: number, max: number) {
        const offsetLeft = this.div.getBoundingClientRect().left
        const offsetWidth = this.div.offsetWidth;
        const res = ((mouseX - offsetLeft) / offsetWidth) * (max - min) + min;
        return res;
    }
}
