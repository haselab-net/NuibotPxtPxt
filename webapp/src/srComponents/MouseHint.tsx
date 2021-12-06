import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Point} from './Utils';

type Position = 'top' | 'bottom' | 'left' | 'right'

interface MouseHintProps {
    coordinate: Point
    position?: Position
}

export default class MouseHint extends React.Component<MouseHintProps> {
    static defaultProps = {
        position: 'right'
    }
    render() {
        const {
            position,
            coordinate
        } = this.props
        const attachedClass = 'sr-attach-' + position
        const rootStyle: React.CSSProperties = {
            position: 'absolute',
            left: coordinate.x,
            top: coordinate.y,
            width: 0,
            height: 0,
            zIndex: 1000,
            color: 'white',
            whiteSpace: 'nowrap'
        }
        const element = (
            <div style={rootStyle}>
                <div className={attachedClass}>
                    {this.props.children}
                </div>
            </div>
        )
        const parentNode = document.querySelector('body')
        return ReactDOM.createPortal(element, parentNode)
    }
}
