import * as React from 'react';
import {HandleFactory} from './Handle'
import {IGestureCallback} from './DragBar'
import {Track, Tag} from './Track'
import {Point} from './Utils'
import classNames from 'classnames'
import MouseHint from './MouseHint'

export interface SliderProps {
    value: number;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;

    onBeforeChange?: (value: number) => void;
    onChange: (oldValue: number, newValue: number) => void;
    onAfterChange?: (value: number) => void;
    onEmphasize?: () => void;

    customTriggerDragging?: boolean // trigger dragging by press handle
    tags?: Tag[]
    onChangeLimit?: (limit: number, isMin: boolean) => void
}

export interface SliderState {
    maxLimitHint: JSX.Element
    minLimitHint: JSX.Element
}
export class Slider extends React.Component<SliderProps, SliderState> implements IGestureCallback {
    private Handle = HandleFactory(() => {}, () => {});

    private isDragging: boolean = false
    private refDiv = React.createRef<HTMLDivElement>()

    static defaultProps: Partial<SliderProps> = {
        customTriggerDragging: false,
        disabled: false,
        tags: []
    }

    constructor(props: SliderProps) {
        super(props);

        this.state = {
            maxLimitHint: undefined,
            minLimitHint: undefined
        }

        this.onChooseHandle = this.onChooseHandle.bind(this)
    }

    private offset2Value(offset: number): number {
        offset = softrobot.util.limitNum(offset, 0, 100)
        return this.roundToStep((offset / 100) * (this.props.max - this.props.min) + this.props.min)
    }

    private roundToStep(value: number): number {
        const val = Math.round((value - this.props.min) / this.props.step) * this.props.step + this.props.min
        return softrobot.util.limitNum(val, this.props.min, this.props.max)
    }

    onStartDrag(offset: number) {
        if (this.props.disabled) return
        if (this.props.customTriggerDragging && !this.isDragging) return

        const newValue = this.offset2Value(offset)

        if (this.props.onBeforeChange) this.props.onBeforeChange(this.props.value)
        if (this.props.onChange) this.props.onChange(this.props.value, newValue)
    }
    onDrag(oldOffset: number, newOffset: number, lastPosition: Point, newPosition: Point) {
        if (this.props.disabled) return
        if (this.props.customTriggerDragging && !this.isDragging) return

        if (this.props.onChangeLimit) {
            this.handleExceededDrag(oldOffset, newOffset, newPosition)
            if (this.state.maxLimitHint) {
                this.props.onChangeLimit(this.props.max - newPosition.y + lastPosition.y, false)
                this.setState({maxLimitHint: this.renderLimitHint(newPosition, false)})
            }
            if (this.state.minLimitHint) {
                this.props.onChangeLimit(this.props.min - newPosition.y + lastPosition.y, true)
                this.setState({minLimitHint: this.renderLimitHint(newPosition, true)})
            }
        }

        const newValue = softrobot.util.limitNum(this.offset2Value(newOffset), this.props.min, this.props.max)

        if (this.props.onChange) this.props.onChange(this.props.value, newValue)
    }
    onEndDrag(offset: number) {
        if (this.props.disabled) return
        if (this.props.customTriggerDragging && !this.isDragging) return

        if (this.props.onAfterChange) this.props.onAfterChange(this.props.value)

        this.isDragging = false

        this.setState({
            maxLimitHint: undefined,
            minLimitHint: undefined
        })
    }
    onEmphasize(offset: number) {
        const newValue = this.offset2Value(offset)

        if (this.props.onEmphasize) this.props.onEmphasize()
    }

    private handleExceededDrag(oldOffset: number, newOffset: number, mouse: Point) {
        if (newOffset >= 110 && oldOffset < 110) {
            this.setState({maxLimitHint: this.renderLimitHint(mouse, false)})
        } else if (newOffset < 110 && oldOffset >= 110) {
            this.setState({maxLimitHint: undefined})
        } else if (newOffset <= -10 && oldOffset > -10) {
            this.setState({minLimitHint: this.renderLimitHint(mouse, true)})
        } else if (newOffset > -10 && oldOffset <= -10) {
            this.setState({minLimitHint: undefined})
        }
    }
    private renderLimitHint(position: Point, min?: boolean) {
        const labelClass = classNames(["ui", "orange", {
            left: min,
            right: !min
        }, "pointing", "label"])
        return (
            <MouseHint coordinate={position} position={min ? 'right' : 'left'}>
                <div className={labelClass}>{min ? lf("Drag up / down to change min limit") : lf("Drag up / down to change max limit")}</div>
            </MouseHint>
        )
    }

    private onChooseHandle(index: number) {
        this.isDragging = true
    }

    render() {
        const handle = (
            <this.Handle index={0} value={this.props.value}
                offset={(this.props.value - this.props.min) / (this.props.max - this.props.min) * 100}
                tipFormatter={(value: number) => value.toString()}
                wrapperClassName="sr-slider-handle-wrapper"
                handleClassName={classNames("sr-slider-handle", {"sr-slider-handle-disabled": this.props.disabled})}
            />
        )
        const track = (
            <Track min={this.props.min} max={this.props.max} active={this.props.disabled ? [] : {
                start: this.props.min,
                end: this.props.value
            }} tags={this.props.tags} />
        )
        return <div className="sr-slider" ref={this.refDiv}>
            {track}
            {handle}
            {this.state.maxLimitHint}
            {this.state.minLimitHint}
        </div>
    }
}
