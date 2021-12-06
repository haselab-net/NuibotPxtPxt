import * as React from 'react';
import {HandleFactory} from './Handle'
import {IGestureCallback} from './DragBar'

export interface RangeProps {
    values: number[];
    min: number;
    max: number;

    minNeighborDistance: number;
    onBeforeChange?: (index: number, value: number) => void;
    onChange: (index: number, oldValue: number, newValue: number) => void;
    onAfterChange?: (index: number, value: number) => void;
    onEmphasize?: (index: number) => void;

    customTriggerDragging?: boolean // trigger dragging by press handle
}
interface RangeState {
    moveLimitMin: number;
    moveLimitMax: number;
}
export class Range extends React.Component<RangeProps, RangeState> implements IGestureCallback {
    private Handle = HandleFactory(() => {}, (index: number) => {if (this.props.onEmphasize) this.props.onEmphasize(index)});
    private changedIndex: number

    private isDragging: boolean = false

    static defaultProps = {
        customTriggerDragging: false
    }

    constructor(props: RangeProps) {
        super(props);

        this.state = {
            moveLimitMin: this.props.min,
            moveLimitMax: this.props.max
        }

        this.onChooseHandle = this.onChooseHandle.bind(this)
    }

    private offset2Value(offset: number): number {
        offset = softrobot.util.limitNum(offset, 0, 100)
        return (offset / 100) * (this.props.max - this.props.min) + this.props.min
    }

    static getNewValues(oldValues: number[], newIndex: number, newValue: number): number[] {
        const newValues = [...oldValues]
        newValues[newIndex] = newValue;
        return newValues;
    }

    private getNearestIndex(value: number) {
        let nearestIndex = 0, nearestDistance = Math.abs(value - this.props.values[nearestIndex])
        for (let i = 1; i < this.props.values.length; i++) {
            const distance = Math.abs(value - this.props.values[i])
            if (distance < nearestDistance) {
                nearestIndex = i
                nearestDistance = distance
            }
        }
        return nearestIndex
    }

    onStartDrag(offset: number) {
        if (this.props.customTriggerDragging && !this.isDragging) return

        const newValue = this.offset2Value(offset)
        this.changedIndex = this.getNearestIndex(newValue)

        let moveLimitMin, moveLimitMax
        if (this.changedIndex === 0) {
            moveLimitMin = this.props.min
        } else {
            moveLimitMin = this.props.values[this.changedIndex - 1] + this.props.minNeighborDistance
        }

        if (this.changedIndex === this.props.values.length - 1) {
            moveLimitMax = this.props.max
        } else {
            moveLimitMax = this.props.values[this.changedIndex + 1] - this.props.minNeighborDistance
        }

        this.setState({
            moveLimitMin: moveLimitMin,
            moveLimitMax: moveLimitMax
        })

        if (this.props.onBeforeChange) this.props.onBeforeChange(this.changedIndex, this.props.values[this.changedIndex])
        if (this.props.onChange) this.props.onChange(this.changedIndex, this.props.values[this.changedIndex], newValue)
    }
    onDrag(oldOffset: number, newOffset: number) {
        if (this.props.customTriggerDragging && !this.isDragging) return

        const newValue = softrobot.util.limitNum(this.offset2Value(newOffset), this.state.moveLimitMin, this.state.moveLimitMax)

        if (this.props.onChange) this.props.onChange(this.changedIndex, this.props.values[this.changedIndex], newValue)
    }
    onEndDrag(offset: number) {
        if (this.props.customTriggerDragging && !this.isDragging) return

        if (this.props.onAfterChange) this.props.onAfterChange(this.changedIndex, this.props.values[this.changedIndex])

        this.isDragging = false
    }
    onEmphasize(offset: number) {
        const newValue = this.offset2Value(offset)
        const changedIndex = this.getNearestIndex(newValue)

        this.props.onEmphasize(changedIndex)
    }

    private onChooseHandle(index: number) {
        this.isDragging = true
    }

    render() {
        const pointers: JSX.Element[] = this.props.values.map((value: number, index: number) => (
            <this.Handle key={index} index={index} value={value}
                offset={(value - this.props.min) / (this.props.max - this.props.min) * 100}
                tipFormatter={(value: number) => softrobot.util.time2Str(value + 1)}
                onMouseDown={() => this.onChooseHandle(index)}
            />
        ))
        return pointers
    }
}
