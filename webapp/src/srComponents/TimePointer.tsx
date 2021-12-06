import * as React from "react"
import {Click2Value} from "./Click2Value"
import * as utils from "./Utils"
import {IGestureCallback} from './DragBar'

interface PointerProps {
  value: number;
  offset: number;
  tipFormatter: (val: number) => string;
}
interface PointerState {
  value: number;
  offset: number;
  showTag: boolean;
}
class Pointer extends React.Component<PointerProps, PointerState> {
  private readonly pointerCSS: React.CSSProperties = {
    width: 20,
    borderLeft: "10px solid transparent",
    borderRight: "10px solid transparent",
    borderBottom: "30px solid " + utils.color_red,
    borderRadius: 10,
    margin: "auto"
  };

  private getCss(offset: number) {
    let css: React.CSSProperties = {
      position: "absolute",
      transform: "translateX(-50%)",

      background: "transparent"
    };
    css.left = `${offset}%`;
    return css;
  }
  private getLabelStyle(): React.CSSProperties {
    return {
        display: this.state.showTag ? "block" : "none",
        zIndex: 1
    }
  }

  constructor(props: PointerProps) {
    super(props);

    this.state = {
      showTag: false,
      offset: props.offset,
      value: props.value
    };
  }

  componentDidUpdate(prevProps: PointerProps) {
    if (prevProps.offset !== this.props.offset) {
      this.setState({
        offset: this.props.offset,
        value: this.props.value
      });
    }
  }

  render() {
    return <div
      className="sr-draggable"
      style={this.getCss.bind(this)(this.state.offset)}
      onMouseEnter={() => this.setState({ showTag: true})}
      onMouseLeave={() => this.setState({ showTag: false})}
    >
      <div style={this.pointerCSS} />
      <div className="ui pointing label" style={this.getLabelStyle()}>
        {this.props.tipFormatter(this.props.value)}
      </div>
    </div>;
  }
}

// TimePointer
export interface TimePointerProps {
  duration: number;
  currentTime: number;

  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => void;
  addKeyframe: () => void;
  setSyncPose: () => void;

  onAfterChange?: (newTime: number) => void;
}
export class TimePointer extends React.Component<TimePointerProps> implements IGestureCallback{
  private currentTime: number = this.props.currentTime;
  private click2Value: Click2Value;

  constructor(props: TimePointerProps) {
    super(props);

    this.setRef = this.setRef.bind(this)
  }

  private setRef(element: HTMLDivElement) {
    this.click2Value = new Click2Value(element)
  }

  private offset2Value(offset: number): number {
    offset = softrobot.util.limitNum(offset, 0, 100)
    return (offset / 100) * (this.props.duration - 1)
  }

  onStartDrag(offset: number): void {
    const newTime = Math.round(this.offset2Value(offset))

    this.props.setSyncPose();
    this.props.updateCurrentTime(softrobot.util.limitNum(newTime, 0, this.props.duration - 1));

    this.currentTime = newTime;
  }
  onDrag(oldOffset: number, newOffset: number): void {
    const newTime = softrobot.util.limitNum(Math.round(this.offset2Value(newOffset)), 0, this.props.duration - 1);
    this.props.updateCurrentTime(newTime);

    this.currentTime = newTime;
  }
  onEndDrag(offset: number): void {
    if (this.props.onAfterChange) {
      this.props.onAfterChange(this.currentTime);
    }
  }
  onEmphasize(offset: number): void {
    this.props.addKeyframe();
  }

  render() {
    const offset = (this.props.currentTime / (this.props.duration - 1)) * 100;

    return (
      <Pointer value={this.props.currentTime} offset={offset} tipFormatter={(value: number) => softrobot.util.time2Str(value + 1)} />
    );
  }
}
