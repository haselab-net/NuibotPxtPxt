import * as React from 'react'

export interface WrappedHandleProps {
    index: number,
    max?: number,
    min?: number,
    value: number,
    offset: number,
    ref?: React.RefObject<any>,
    tipFormatter: (val: number) => string,
    onMouseDown?: () => void,

    wrapperClassName?: string,
    handleClassName?: string
}
export interface WrappedHandleState {
    offset: number
    showTag: boolean
}
export function HandleFactory(onClick: (index: number, value: number) => void, onDoubleClick: (index: number, value: number) => void) {
    return class WrappedHandle extends React.Component<WrappedHandleProps, WrappedHandleState> {
        static defaultProps = {
            wrapperClassName: 'sr-keyframe-pointer-wrapper',
            handleClassName: 'sr-keyframe-pointer'
        }
        constructor(props: WrappedHandleProps) {
            super(props);
            this.state = {
                offset: this.props.offset,
                showTag: false,
            }

            this.onDoubleClick = this.onDoubleClick.bind(this);
        }
        private getCss(offset: number) {
            return {
                position: 'absolute',
                left: `${offset}%`
            };
        }
        clickFocus() {
            onClick(this.props.index, this.props.value)
        }
        onDoubleClick() {
            onDoubleClick(this.props.index, this.props.value)
        }
        componentWillReceiveProps(nextProps: WrappedHandleProps) {
            this.setState({
                offset: nextProps.offset
            })
        }
        render() {
            return (
                <div className={`sr-draggable ${this.props.wrapperClassName}`} id={`keyframe-pointer-${this.props.index}`}
                    style={this.getCss.bind(this)(this.state.offset)}
                    onMouseEnter={() => this.setState({showTag: true})} onMouseLeave={() => this.setState({showTag: false})}
                    onMouseDown={() => {if (this.props.onMouseDown) this.props.onMouseDown()}}
                    onTouchStart={() => {if (this.props.onMouseDown) this.props.onMouseDown()}}
                    onDoubleClick={this.onDoubleClick}
                >
                    <div className="ui pointing below label"
                        style={!this.state.showTag ? {display: 'none'} : {display: 'block'}}
                    >
                        {this.props.tipFormatter(this.props.value)}
                    </div>
                    <div className={this.props.handleClassName} />
                </div>
            )
        }
    }
}
