import * as React from 'react'
import * as Utils from './Utils'

export interface Tag {
    value: number
    label: string
}

interface ActiveRegion {
    start: number
    end: number
}

interface TrackProps {
    min: number
    max: number
    tags?: Tag[]
    active?: ActiveRegion | ActiveRegion[]
}

export class Track extends React.Component<TrackProps> {
    private style = {
        trackWidth: 4,
        pointRadius: 5
    }

    private readonly lineStyle: React.CSSProperties
    private readonly pointStyle: React.CSSProperties
    private readonly tagStyle: React.CSSProperties

    static defaultProps: Partial<TrackProps> = {
        tags: [],
        active: []
    }

    constructor(props: TrackProps) {
        super(props);

        this.lineStyle = {
            position: 'relative',
            height: this.style.trackWidth,
            background: Utils.color_grey,
            borderRadius: this.style.trackWidth / 2
        }
        this.pointStyle = {
            background: 'white',
            width: 2 * this.style.pointRadius,
            height: 2 * this.style.pointRadius,
            borderRadius: this.style.pointRadius,
            borderWidth: 3,
            borderStyle: 'solid',
            borderColor: Utils.color_grey,
            transform: `translateY(${this.style.trackWidth / 2 - this.style.pointRadius}px)`
        }
        this.tagStyle = {
            transform: `translateY(${Math.max(this.style.trackWidth / 2 + this.style.pointRadius, this.style.trackWidth) + 2}px)`,
            fontSize: '0.8rem',
            color: '#646464'
        }
    }

    private value2Offset(value: number) {
        return (value - this.props.min) / (this.props.max - this.props.min) * 100
    }

    render() {
        const points = this.props.tags.map((tag, index) => (
            <RelativeHandle key={`point-${index}`} offset={this.value2Offset(tag.value)}>
                <div style={this.pointStyle} />
            </RelativeHandle>
        ))
        const tags = this.props.tags.map((tag, index) => (
            <RelativeHandle key={`tag-${index}`} offset={this.value2Offset(tag.value)}>
                <div style={this.tagStyle}>{tag.label}</div>
            </RelativeHandle>
        ))
        const activeRegions = Utils.getAsArray(this.props.active).map((region, index) => (
            <Line key={`active-${index}`} startOffset={this.value2Offset(region.start)} endOffset={this.value2Offset(region.end)} height={this.style.trackWidth} />
        ))
        return (
            <div style={this.lineStyle}>
                {activeRegions}
                {points}
                {tags}
            </div>
        )
    }
}

interface RelativeHandleProps {
    offset: number
}

class RelativeHandle extends React.Component<RelativeHandleProps> {
    render() {
        return (
            <div style={{
                'position': 'absolute',
                'left': this.props.offset.toString() + '%',
                'transform': 'translateX(-50%)'
            }}>
                {this.props.children}
            </div>
        )
    }
}

interface LineProps {
    startOffset: number
    endOffset: number
    height: number
}

function Line(props: LineProps) {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: props.startOffset.toString() + '%',
        width: (props.endOffset - props.startOffset).toString() + '%',
        height: props.height,
        backgroundColor: Utils.color_blue_light
    }
    return (<div style={style} />)
}
