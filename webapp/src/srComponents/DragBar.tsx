import * as React from "react";
import {Click2Value} from "./Click2Value";
import {Point} from "./Utils"

export interface IGestureCallback {
    onStartDrag?: (offset: number, position?: Point) => void
    onDrag?: (oldOffset: number, newOffset: number, oldPosition: Point, newPosition?: Point) => void
    onEndDrag?: (offset: number) => void
    onEmphasize?: (offset: number) => void
}

export function DragBar<T extends {disabled?: boolean}>(DragConsumer: typeof React.Component & IGestureCallback, height: string | number) {
    return class extends React.Component<T> {
        private click2Value: Click2Value
        private dragConsumer: React.Component & IGestureCallback
        private readonly barStyle: React.CSSProperties
        private lastValue: number
        private lastPosition: Point

        constructor(props: T) {
            super(props);

            this.barStyle = {
                height: height
            }

            this.setDivRef = this.setDivRef.bind(this)
            this.setComponentRef = this.setComponentRef.bind(this)

            this.onMouseDown = this.onMouseDown.bind(this)
            this.onMouseMove = this.onMouseMove.bind(this)
            this.onMouseUp = this.onMouseUp.bind(this)
            this.onTouchStart = this.onTouchStart.bind(this)
            this.onTouchMove = this.onTouchMove.bind(this)
            this.onTouchEnd = this.onTouchEnd.bind(this)

            this.onDoubleClick = this.onDoubleClick.bind(this)
        }

        setDivRef(element: HTMLDivElement) {
            if (element !== undefined) {
                this.click2Value = new Click2Value(element)
            } else {
                this.click2Value = undefined
            }
        }
        setComponentRef(element: React.Component & IGestureCallback) {
            if (element !== undefined) {
                this.dragConsumer = element
            } else {
                this.dragConsumer = undefined
            }
        }

        onMouseDown(event: React.MouseEvent<HTMLDivElement>) {
            if (event.buttons !== 1) return;

            event.preventDefault()

            const newValue = this.click2Value.calculate(event.clientX, 0, 100)
            const newPosition = {
                x: event.clientX,
                y: event.clientY
            }
            if (this.dragConsumer.onStartDrag) this.dragConsumer.onStartDrag(newValue, newPosition)
            this.lastValue = newValue
            this.lastPosition = newPosition

            window.addEventListener("mousemove", this.onMouseMove)
            window.addEventListener("mouseup", this.onMouseUp)
        }
        onMouseMove(event: MouseEvent) {
            if (event.buttons !== 1) return;

            event.preventDefault()

            const newValue = this.click2Value.calculate(event.clientX, 0, 100)
            const newPosition = {
                x: event.clientX,
                y: event.clientY
            }
            if (this.dragConsumer.onDrag) this.dragConsumer.onDrag(this.lastValue, newValue, this.lastPosition, newPosition)
            this.lastValue = newValue
            this.lastPosition = newPosition
        }
        onMouseUp(event: MouseEvent) {
            event.preventDefault()

            const newValue = this.click2Value.calculate(event.clientX, 0, 100)
            if (this.dragConsumer.onEndDrag) this.dragConsumer.onEndDrag(newValue)

            window.removeEventListener("mousemove", this.onMouseMove)
            window.removeEventListener("mouseup", this.onMouseUp)
        }
        onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
            event.preventDefault()

            const newValue = this.click2Value.calculate(event.touches[0].clientX, 0, 100)
            const newPosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }
            if (this.dragConsumer.onStartDrag) this.dragConsumer.onStartDrag(newValue, newPosition)
            this.lastValue = newValue
            this.lastPosition = newPosition

            window.addEventListener("touchmove", this.onTouchMove)
            window.addEventListener("touchend", this.onTouchEnd)
        }
        onTouchMove(event: TouchEvent) {
            event.preventDefault()

            const newValue = this.click2Value.calculate(event.touches[0].clientX, 0, 100)
            const newPosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            }
            if (this.dragConsumer.onDrag) this.dragConsumer.onDrag(this.lastValue, newValue, this.lastPosition, newPosition)
            this.lastValue = newValue
            this.lastPosition = newPosition
        }
        onTouchEnd(event: TouchEvent) {
            event.preventDefault()

            if (this.dragConsumer.onEndDrag) this.dragConsumer.onEndDrag(this.lastValue)

            window.removeEventListener("touchmove", this.onTouchMove)
            window.removeEventListener("touchend", this.onTouchEnd)
        }

        onDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
            const newValue = this.click2Value.calculate(event.clientX, 0, 100)
            if (this.dragConsumer.onEmphasize) this.dragConsumer.onEmphasize(newValue)
        }

        render() {
            return (
                <div
                  className={this.props.disabled ? "sr-dragbar-disabled" : "sr-dragbar"}
                  style={this.barStyle}
                  onDoubleClick={this.onDoubleClick}
                  onMouseDown={this.onMouseDown}
                  onTouchStart={this.onTouchStart}
                  ref={this.setDivRef}
                >
                  <DragConsumer {...this.props} ref={this.setComponentRef}  />
                </div>
              );
        }
    }
}
