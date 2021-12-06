/**
 * An number input have normal appearance, but could accept input like slider
 */

import * as React from 'react';

interface WithSliderProps {
    min: number;
    max: number;
    valuePerPixel: number;

    vertical?: boolean;     // defaule: horizontal
    inverted?: boolean;      // default: right > left, up > down
}

interface Status {
    value: number;
    x: number;
    y: number;
}

type WithSliderPropsHOC = WithSliderProps & React.InputHTMLAttributes<HTMLInputElement> & any

export function withSlider(Input: React.ComponentType<React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>>) {
    return class WithSlider extends React.Component<WithSliderPropsHOC> {
        constructor(props: WithSliderPropsHOC) {
            super(props)
        }
        static defaultProps: Partial<WithSliderProps> = {
            vertical: false,
            inverted: false
        }
        private refInput: HTMLInputElement = undefined
        private startStatus: Status = {
            value: 0,
            x: 0,
            y: 0
        }
        onRef = (element: HTMLInputElement) => {
            if (element === undefined) {
                this.refInput = undefined
            }
            else {
                this.refInput = element
            }
        }
        private position2Value(x: number, y: number) {
            const pixOffset = this.props.vertical ? - (y - this.startStatus.y) : x - this.startStatus.x
            const valueOffset = (this.props.inverted ? -1 : 1) * pixOffset * this.props.valuePerPixel
            return this.startStatus.value + valueOffset
        }
        onTouchStart = (event: React.TouchEvent<HTMLInputElement>) => {
            this.startStatus = {
                value: Number(this.props.value),
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }
            if (this.props.onTouchStart) this.props.onTouchStart(event)

            window.addEventListener("touchmove", this.onTouchMove)
            window.addEventListener("touchend", this.onTouchEnd)
        }
        onTouchMove = (event: TouchEvent) => {
            event.preventDefault()
            const newValue = this.position2Value(event.touches[0].clientX, event.touches[0].clientY)

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor((window as any).HTMLInputElement.prototype, 'value').set
            nativeInputValueSetter.call(this.refInput, newValue.toString())

            const changeEvent = new Event('change', {bubbles: true})
            this.refInput.dispatchEvent(changeEvent)
        }
        onTouchEnd = (event: TouchEvent) => {
            window.removeEventListener("touchmove", this.onTouchMove)
            window.removeEventListener("touchend", this.onTouchEnd)
        }
        render() {
            const {
                onTouchStart,
                forwardedRef,

                min,
                max,
                valuePerPixel,
                inverted,
                vertical,

                ...restProps
            } = this.props

            return <Input
                ref={this.onRef}
                onTouchStart={this.onTouchStart}
                {...restProps}
            />
        }
    }
}
