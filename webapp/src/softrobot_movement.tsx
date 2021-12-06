/// <reference path="../../built/softrobot.d.ts" />

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as sui from "./sui"
import Slider, { Range, Handle, createSliderWithTooltip, Marks } from 'rc-slider';
import {RCTooltip} from 'rc-tooltip';
import { FAST_TRACE_INTERVAL } from "./simulator";

export let CODE_STRING: string = "";

let SliderWithTooltip = createSliderWithTooltip(Slider);
let RangeWithTooltip = createSliderWithTooltip(Range);

interface PartialKeyframe {
  pose: number[]; // pose of motors in motorIdList
  time: number; // absolute time from start // NOTE the time stored here start from 0 for convenience in calculation, in visible element (e.g. codeStr, tags) please plus 1
}

interface MovementData {
  name: string;
  motorIdList: number[];
  keyframes: PartialKeyframe[];
  duration: number;
  motorNum: number;
}

/**
 * encode movement data into string
 * line 0: [name]
 * line 1: [keyframe count = n] [used motor count = m] [duration]
 * line 2: [total motor count] [motor id 0] ... [motor id m]
 * line 3 ~ 2+n: [relative time] [motor length 0] .. [motor length m]
 * @description the encoded data is compatible to Robokey, one only have to delete line 2
 * @param data data structure to be encoded
 * @returns encoded string
 */
export function movementEncoder(data: MovementData): string {
  /**
   * encode partial keyframe into string
   * @param keyframe use relative time
   */
  function partialKeyframeEncoder(keyframe: PartialKeyframe): string {
    let res: string = "";
    res += keyframe.time.toString();
    res += " " + softrobot.util.arrayEncoder(keyframe.pose, ele => ele.toString(), " ");
    return res;
  }

  let res: string = "";

  // line 0: [name]
  res += data.name + "\n";

  let relativeKeyframes: PartialKeyframe[] = JSON.parse(JSON.stringify(data.keyframes));
  relativeKeyframes[0].time += 1;       // time in storage start from 0 (we want to start from 1)
  for (let i = 1; i < relativeKeyframes.length; i++) {
    relativeKeyframes[i].time = data.keyframes[i].time - data.keyframes[i - 1].time;
  }

  // line 1: [keyframe count = n] [used motor count = m] [duration]
  res += relativeKeyframes.length.toString();
  res += " " + data.motorIdList.length.toString();
  res += " " + data.duration.toString();
  res += "\n";

  // line 2: [total motor count] [motor id 0] ... [motor id m]
  res += data.motorNum;
  res += " " + softrobot.util.arrayEncoder(data.motorIdList, ele => ele.toString(), " ");
  res += "\n";

  // line 3 ~ 2+n: [relative time] [motor length 0] .. [motor length m]
  res += softrobot.util.arrayEncoder(relativeKeyframes, partialKeyframeEncoder, "\n");

  return res;
}
/**
 * decode an encoded string into movement data
 * line 0: [name]
 * line 1: [keyframe count = n] [used motor count = m] [duration]
 * line 2: [total motor count] [motor id 0] ... [motor id m]
 * line 3 ~ 2+n: [relative time] [motor length 0] .. [motor length m]
 * @param str encoded string
 * @returns movement data
 */
export function movementDecoder(str: string): MovementData | undefined {
  function partialKeyframeDecoder(str: string): PartialKeyframe {
    let nums = str.split(" ").map(ele => parseInt(ele));
    return {
      time: nums[0],
      pose: nums.slice(1)
    };
  }

  function numValidator(str: string): boolean {
    let line_matrix = str.split("\n").map(line => line.split(" ").map(num => parseInt(num)));
    if (line_matrix.length < 3) return false; // more than 1 keyframe
    if (line_matrix[0][0] + 1 == line_matrix.length) {   // no second line (converted from robokey)
      let motorNum = line_matrix[0][1];
      line_matrix.splice(1, 0, [motorNum].concat(Array.from(Array(motorNum).keys())));
    }
    if (line_matrix[0][0] + 2 != line_matrix.length) return false; // correct keyframe count

    let absoluteTime = 0;

    // correct motor count
    for (let i = 1; i < line_matrix.length; i++) {
      if (line_matrix[0][1] + 1 != line_matrix[i].length) return false;

      // correct relativeTime
      if (line_matrix[i][0] <= 0) return false;

      // correct absoluteTime
      if (i >= 2) {
        absoluteTime += line_matrix[i][0];
        if (absoluteTime > line_matrix[0][2]) return false;
      }
    }

    return true;
  }

  str = str.replace(/[ \t]+/g, " ");
  str = str.replace(/^[ \n\t]+/g, "");
  str = str.replace(/[ \n\t]+$/g, "");

  // extract first line
  let pos = str.indexOf("\n");
  let name = str.substr(0, pos);
  str = str.substr(pos + 1);

  if (!numValidator(str)) return undefined;

  let lines = str.split("\n");
  let line_1 = lines[0].split(" ").map(ele => parseInt(ele));
  if (line_1[0] + 1 == lines.length) {   // if no second line (converted from robokey), add it
    let motorNum = line_1[1];
    lines.splice(1, 0, [motorNum].concat(Array.from(Array(motorNum).keys())).join(" "));
  }
  let line_2 = lines[1].split(" ").map(ele => parseInt(ele));

  let keyframes = lines.slice(2, 2 + line_1[0]).map(partialKeyframeDecoder);
  keyframes[0].time -= 1;    // // time in storage start from 0 (In codeStr we start from 1)
  for (let i = 1; i < keyframes.length; i++) {
    keyframes[i].time += keyframes[i - 1].time;
  }

  return {
    name: name,
    duration: line_1[2],
    motorNum: line_2[0],
    motorIdList: line_2.slice(1, 1 + line_1[1]),
    keyframes: keyframes
  };
}

interface MovementDialogContext {
  // encoder & decoder
  codeStr: string;
  updateCode: (codeStr: string) => void;

  // websocket communication
  sendWSDirect1: (motorId: number, pose: number) => void;
  sendWSDirect: (motorIds: number[], poses: number[]) => void;
  sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => number;

  // id
  name: string;     // unique id assign to this movement

  // motor state
  motorIdList: number[]; // motor ids
  keyframes: PartialKeyframe[]; // keyframes
  duration: number; // duration of this movement
  motorNum: number; // count of motors
  addKeyframe: (keyframe?: PartialKeyframe) => void;
  deleteKeyframe: () => void;
  setKeyframe: (poseId: number, value: number) => void;
  moveKeyframe: (oldTIme: number, newTime: number) => void;
  changeMotorIdList: (newList: number[]) => void;

  // editor state
  currentTime: number; // current time in keyframe slider
  isKeyframe: boolean; // whether current time is keyframe
  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => void;
  isPlaying: boolean;
  toggleIsPlaying: () => void;
  jumpToNeighborKeyframe: (next: boolean) => void;
  setDuration: (duration: number) => void;
  setSyncPose: () => void;
}
const defaultMovementDialogContext = {
  codeStr: "",
  updateCode: (codeStr: string) => {},

  sendWSDirect1: (motorId: number, pose: number) => {},
  sendWSDirect: (motorIds: number[], poses: number[]) => {},
  sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => -1,

  name: "default",

  motorIdList: [1, 2],
  keyframes: [{ pose: [1000, 2000], time: 10 }, { pose: [-1000, -2000], time: 500 }, { pose: [1000, 2000], time: 700 }],
  duration: 3000,
  motorNum: 3,
  addKeyframe: (keyframe?: PartialKeyframe) => {},
  moveKeyframe: (oldTime: number, newTime: number) => {},
  deleteKeyframe: () => {},
  changeMotorIdList: (newList: number[]) => {},
  setKeyframe: (poseId: number, value: number) => {},

  currentTime: 100,
  isKeyframe: false,
  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => {},
  isPlaying: false,
  toggleIsPlaying: () => {},
  jumpToNeighborKeyframe: (next: boolean) => {},
  setDuration: (duration: number) => {},
  setSyncPose: () => {}
};
export const MovementDialogContext = React.createContext(defaultMovementDialogContext);

// SECTION movement dialog
/**
 * Movement input dialog
 * @description a robokey like interface to specify keyframes
 */
// MovementDialog = KeyframeSlider + MotorInputs
interface MovementDialogProps {
  // generate code
  codeStr: string;
  encoder: (data: MovementData) => string;
  decoder: (str: string) => MovementData | undefined;
  // communication
  sendWSDirect1: (motorId: number, pose: number) => void;
  sendWSDirect: (motorIds: number[], poses: number[]) => void,
  sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => number;
  queryWSInterpolate: () => void;
  // sync movement player
  addSyncCallback: (func: (id: number) => void) => number;
  deleteSyncCallback: (funcId: number) => void;
  // robot info
  motorNum: number;
}
interface MovementDialogState extends MovementDialogContext {}
export class MovementDialog extends React.Component<MovementDialogProps, MovementDialogState> {
  movementPlayer: any = undefined;        // update current time in fixed time
  private movementPlayerNextKeyframeId: number = 0;   // rewrite whenever start playing and is used only during playing
  private movementPlayerInterval: number = 20;
  private keyframePairs: {id: number, time: number}[] = [];   // used to sync time with hardware
  private interpolateQueryer: any = undefined;
  private queryInterpolateInterval: number = 100;

  codeStrShouldUpdate: boolean = false;   // update codeStr after state updated if true

  syncPose: boolean = false;              // send pose to hardware in getPropMotorPoses if true

  constructor(props: MovementDialogProps) {
    super(props);

    this.updateTime = this.updateTime.bind(this);

    this.updateCode = this.updateCode.bind(this);
    this.updateCurrentTime = this.updateCurrentTime.bind(this);
    this.addKeyframe = this.addKeyframe.bind(this);
    this.deleteKeyframe = this.deleteKeyframe.bind(this);
    this.setKeyframe = this.setKeyframe.bind(this);
    this.moveKeyframe = this.moveKeyframe.bind(this);
    this.changeMotorIdList = this.changeMotorIdList.bind(this);
    this.toggleIsPlaying = this.toggleIsPlaying.bind(this);
    this.jumpToNeighborKeyframe = this.jumpToNeighborKeyframe.bind(this);
    this.setDuration = this.setDuration.bind(this);
    this.setSyncPose = this.setSyncPose.bind(this);
    this.syncTime = this.syncTime.bind(this);
    this.updateMovementName = this.updateMovementName.bind(this);

    let tmp = this.props.decoder(this.props.codeStr);
    let movementData: MovementData = tmp
      ? tmp
      : {
          name: softrobot.movement.getNewMovementName(),
          motorIdList: [1, 2],
          keyframes: [{ pose: [1000, 2000], time: 1000 }, { pose: [-1000, -2000], time: 2000 }],
          duration: 3000,
          motorNum: 3
        };
    movementData.motorNum = this.props.motorNum;
    let codeStr = tmp ? this.props.codeStr : this.props.encoder(movementData);

    this.state = {
      codeStr: codeStr,
      updateCode: this.updateCode,

      sendWSDirect1: this.props.sendWSDirect1,
      sendWSDirect: this.props.sendWSDirect,
      sendWSInterpolate: this.props.sendWSInterpolate,

      ...movementData,

      addKeyframe: this.addKeyframe,
      moveKeyframe: this.moveKeyframe,
      deleteKeyframe: this.deleteKeyframe,
      setKeyframe: this.setKeyframe,
      changeMotorIdList: this.changeMotorIdList,

      currentTime: 0,
      isKeyframe: movementData.keyframes[0].time == 0 ? true : false,
      updateCurrentTime: this.updateCurrentTime,
      isPlaying: false,
      toggleIsPlaying: this.toggleIsPlaying,
      jumpToNeighborKeyframe: this.jumpToNeighborKeyframe,
      setDuration: this.setDuration,
      setSyncPose: this.setSyncPose
    };

    CODE_STRING = this.state.codeStr;
  }
  componentDidUpdate() {
    if (this.codeStrShouldUpdate) {
      let movementData: MovementData = this.state;
      let newCode = this.props.encoder(movementData);
      this.setState({
        codeStr: newCode
      });
      this.codeStrShouldUpdate = false;

      CODE_STRING = newCode;
    }
  }
  componentDidMount() {
    this.syncCallbackId = this.props.addSyncCallback(this.syncTime);
  }
  componentWillUnmount() {
    if (this.state.isPlaying) this.toggleIsPlaying();

    this.props.deleteSyncCallback(this.syncCallbackId);
  }

  /**
   * Movement Player
   * Send Algorithm:  when start playing, we get [next keyframe id] and send next two neighbor keyframes
   *                  on every update, if the [next keyframe id] changed, we send one next next keyframe
   * Receive Algorithm: Bind callback with send queue (called when the minimum count of read is changed), compare it with that of time pointer.
   *                    If different, sync to the min count read of hardware.
   */
  private syncCallbackId: number = undefined;
  private updateTime() {
    let time = this.state.currentTime;
    time += this.movementPlayerInterval;

    let nextTime = this.state.keyframes[this.movementPlayerNextKeyframeId].time;
    if ((time > nextTime)  && (time - this.movementPlayerInterval <= nextTime)) {
      this.movementPlayerNextKeyframeId = (this.movementPlayerNextKeyframeId + 1) % this.state.keyframes.length;
      this.onGotoNextKeyframe(this.movementPlayerNextKeyframeId);
    }

    if (time > this.state.duration) time -= this.state.duration;

    this.updateCurrentTime(time);
  }
  private onGotoNextKeyframe(nextKeyframeId: number) {    // [K0]time[K1][K2] || [K0][K1==time][K2] ===> [K0][K1]time[K2]
    // send next next keyframe
    this.sendKeyframeInterpolate((nextKeyframeId + 1) % this.state.keyframes.length);
  }
  private sendKeyframeInterpolate(keyframeId: number) {
    let interval = this.state.keyframes[keyframeId].time - this.state.keyframes[(keyframeId - 1 + this.state.keyframes.length) % this.state.keyframes.length].time
    if (interval <= 0) interval += this.state.duration;
    let id = this.props.sendWSInterpolate(
      this.state.motorIdList,
      this.state.keyframes[keyframeId].pose,
      interval
    );
    if (id != -1) this.keyframePairs.push({id: id, time: this.state.keyframes[keyframeId].time});
  }
  private syncTime(id: number) {    // sync time of movement player with hardware
    if (!this.state.isPlaying) return;

    let index = this.keyframePairs.findIndex((val: {id: number, time: number}) => {
      return val.id == id;
    });
    if (index == -1) return;    // keyframe id (in send queue) not found
    else {
      for (let i = 0; i < index; i++) {
        if (this.state.currentTime < this.keyframePairs[index].time) {
          this.movementPlayerNextKeyframeId = (this.movementPlayerNextKeyframeId + 1) % this.state.keyframes.length;
          this.onGotoNextKeyframe(this.movementPlayerNextKeyframeId);
        }
      }

      let currentKeyframeIdx = (this.firstLargerTimeKeyframeIdx(this.state.keyframes, this.state.currentTime) - 1 + this.state.keyframes.length) % this.state.keyframes.length;
      if (this.state.keyframes[currentKeyframeIdx].time == this.keyframePairs[index].time) console.log("same keyframe"); // the keyframe is current playing, no need to sync
      else this.setState({currentTime: (this.keyframePairs[index].time + 1) % this.state.duration});

      this.keyframePairs.splice(0, index);
    }
  }

  // code editor
  updateCode(codeStr: string) {
    let movementData: MovementData | undefined = this.props.decoder(codeStr);
    codeStr = this.props.encoder(movementData);
    if (movementData) {
      this.setState({
        ...movementData,
        codeStr: codeStr
      });

      CODE_STRING = codeStr;
    } else {
        this.setState({
            codeStr: this.state.codeStr
        })
    }
  }

  // find index of the first keyframe of which time is larger or equal to the time, return -1 if not find
  private firstLargerTimeKeyframeIdx(keyframes: PartialKeyframe[], time: number): number {
    function firstLarger(element: PartialKeyframe) {
      if (element.time >= time) return true;
      else return false;
    }
    for (let i = 0; i < keyframes.length; i++) {
      if (firstLarger(keyframes[i])) return i;
    }
    return -1;
  }
  updateCurrentTime(newTime: number, isKeyframe?: boolean) {
    if (!isKeyframe) {
      let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, newTime);
      if (idx >= 0 && newTime == this.state.keyframes[idx].time) isKeyframe = true;
      else isKeyframe = false;
    }
    this.setState({
      currentTime: newTime,
      isKeyframe: isKeyframe
    });
  }
  addKeyframe(keyframe?: PartialKeyframe) {
    if (this.state.isKeyframe) return;

    if (!keyframe)
      keyframe = {
        time: this.state.currentTime,
        pose: this.getPropMotorPoses(this.state.keyframes, this.state.currentTime, this.state.duration)
      };
    let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, keyframe.time);
    this.state.keyframes.splice(idx >= 0 ? idx : this.state.keyframes.length, 0, keyframe);
    this.setState({
      keyframes: this.state.keyframes,
      isKeyframe: true
    });

    this.codeStrShouldUpdate = true;
  }
  deleteKeyframe() {
    if (!this.state.isKeyframe) return;
    if (this.state.keyframes.length == 1) return;

    let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, this.state.currentTime);

    let nextKeyframes = Object.assign([], this.state.keyframes);
    nextKeyframes.splice(idx, 1);
    this.setState({
      keyframes: nextKeyframes,
      isKeyframe: false
    });

    this.codeStrShouldUpdate = true;
  }
  setKeyframe(poseId: number, value: number) {
    let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, this.state.currentTime);

    // not keyframe, add keyframe
    if (idx < 0 || this.state.currentTime != this.state.keyframes[idx].time) {
      let poses = this.getPropMotorPoses(this.state.keyframes, this.state.currentTime, this.state.duration);
      this.addKeyframe({
        time: this.state.currentTime,
        pose: poses
      });
    }

    let keyframes = this.state.keyframes;
    keyframes[idx < 0 ? keyframes.length - 1 : idx].pose[poseId] = value;
    this.setState({
      keyframes: keyframes
    });

    this.codeStrShouldUpdate = true;
  }
  moveKeyframe(oldTime: number, newTime: number) {
    let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, oldTime);
    if (!(oldTime == this.state.keyframes[idx].time)) return;

    let keyframes: PartialKeyframe[] = Object.assign([], this.state.keyframes);
    keyframes[idx].time = newTime;
    this.setState({
      keyframes: keyframes,
      isKeyframe: newTime == this.state.currentTime ? true : this.state.isKeyframe
    });

    this.codeStrShouldUpdate = true;

    console.log("move time", oldTime, newTime);
  }
  changeMotorIdList(newList: number[]) {
    // change order || delete one motor id || add one motor id
    // change keyframes
    let keyframes = this.state.keyframes;
    if (newList.length == this.state.motorIdList.length - 1) {
      // delete
      console.log("delete");
      let idx = 0;
      while (idx < newList.length) {
        if (newList[idx] != this.state.motorIdList[idx]) break;
        idx++;
      }
      for (let keyframe of keyframes) {
        keyframe.pose.splice(idx, 1);
      }
    } else if (newList.length == this.state.motorIdList.length + 1) {
      // add
      console.log("add");
      let idx = 0;
      while (idx < this.state.motorIdList.length) {
        if (newList[idx] != this.state.motorIdList[idx]) break;
        idx++;
      }
      for (let keyframe of keyframes) {
        keyframe.pose.splice(idx, 0, 0);
      }
    } else if (newList.length == this.state.motorIdList.length) {
    } else {
      console.error("change more than one motor id");
    }

    // change list
    this.setState({
      motorIdList: newList,
      keyframes: keyframes
    });

    this.codeStrShouldUpdate = true;
  }
  toggleIsPlaying() {
    let prevState = this.state.isPlaying;
    this.setState({
      isPlaying: !prevState
    });

    if (!prevState) {   // start playing
      this.movementPlayerNextKeyframeId = this.firstLargerTimeKeyframeIdx(this.state.keyframes, this.state.currentTime);
      if (this.movementPlayerNextKeyframeId < 0) this.movementPlayerNextKeyframeId = 0;
      // send two keyframes
      let id = this.props.sendWSInterpolate(
        this.state.motorIdList,
        this.state.keyframes[this.movementPlayerNextKeyframeId].pose,
        this.state.keyframes[this.movementPlayerNextKeyframeId].time - this.state.currentTime
      );
      if (id != -1) this.keyframePairs.push({id: id, time: this.state.currentTime});
      this.sendKeyframeInterpolate((this.movementPlayerNextKeyframeId + 1) % this.state.keyframes.length);

      this.movementPlayer = setInterval(this.updateTime, this.movementPlayerInterval);
      this.interpolateQueryer = setInterval(this.props.queryWSInterpolate, this.queryInterpolateInterval);
    } else {            // stop playing
      if (!!this.movementPlayer) clearInterval(this.movementPlayer);
      if (!!this.interpolateQueryer) clearInterval(this.interpolateQueryer);
    }
  }
  jumpToNeighborKeyframe(next: boolean) {
    // next: true(next) || false(prev)
    if (this.state.isPlaying) this.toggleIsPlaying();
    if (this.state.keyframes.length == 0) return;

    let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, this.state.currentTime);
    if (idx < 0) idx = 0;
    let resIdx = 0;
    if (!next) {
      // prev keyframe
      resIdx = idx - 1 >= 0 ? idx - 1 : idx - 1 + this.state.keyframes.length;
    } else {
      // next keyframe
      if (this.state.isKeyframe) idx++;
      resIdx = idx % this.state.keyframes.length;
    }

    this.setSyncPose();   // send pose to hardware
    this.setState({
      currentTime: this.state.keyframes[resIdx].time,
      isKeyframe: true
    });
  }
  setDuration(duration: number) {
    if (duration < 1000) return;
    let lastKeyframe = this.state.keyframes[this.state.keyframes.length - 1];
    if (duration - 1 < lastKeyframe.time) duration = lastKeyframe.time + 1;
    duration = Math.floor(duration);
    this.setState({
      duration: duration,
      currentTime: this.state.currentTime >= duration ? duration - 1 : this.state.currentTime
    });

    this.codeStrShouldUpdate = true;
  }
  setSyncPose() {
    this.syncPose = true;
  }
  updateMovementName(name: string) {
    this.setState({
      name: name
    });
    this.codeStrShouldUpdate = true;
  }

  private getPropMotorPoses(keyframes: PartialKeyframe[], time: number, duration: number): number[] {
    if (keyframes.length == 0) return Array<number>(this.state.motorIdList.length).map(() => 0);

    let res: number[] = [];

    let keyframesCpy: PartialKeyframe[] = [];
    Object.assign(keyframesCpy, keyframes);

    // add prefix and suffix to simplify code
    let firstKeyframe = Object.assign({}, keyframesCpy[keyframesCpy.length - 1]),
      lastKeyframe = Object.assign({}, keyframesCpy[0]);

    firstKeyframe.time -= duration;
    lastKeyframe.time += duration;
    keyframesCpy.splice(0, 0, firstKeyframe);
    keyframesCpy.push(lastKeyframe);

    let idx = this.firstLargerTimeKeyframeIdx(keyframesCpy, time);
    if (keyframesCpy[idx].time == time) {
      // we have this keyframe
      res = keyframesCpy[idx].pose;
    } else {
      // we have to interpolate to get the pose
      for (let i = 0; i < keyframesCpy[idx].pose.length; i++) {
        let lastKeyframe = keyframesCpy[idx - 1],
          nextKeyframe = keyframesCpy[idx];
        res.push(
          ((nextKeyframe.pose[i] - lastKeyframe.pose[i]) * (time - lastKeyframe.time)) /
            (nextKeyframe.time - lastKeyframe.time) +
            lastKeyframe.pose[i]
        );
      }
    }

    // send pose to hardware
    if (this.syncPose) {
      this.props.sendWSDirect(this.state.motorIdList, res);
      this.syncPose = false;
    }

    return res;
  }
  private getPropCheckedMotorIds(motoIdList: number[], motorNum: number): boolean[] {
    let res: boolean[] = Array.from({ length: motorNum }, v => false);

    for (const val of motoIdList) {
      res[val] = true;
    }
    return res;
  }
  private getTimeList(keyframes: PartialKeyframe[]): number[] {
    let res: number[] = [];
    for (let keyframe of keyframes) {
      res.push(keyframe.time);
    }
    return res;
  }

  render() {
    return (
      <MovementDialogContext.Provider value={this.state}>
        <div className="ui segment">
          <NameInput name={this.state.name} updateMovementName={this.updateMovementName} />
          <div className="ui divider" />
          <KeyframeSlider duration={this.state.duration} times={this.getTimeList(this.state.keyframes)} />
          <div className="ui divider" />
          <MotorInputs
            motorIdList={this.state.motorIdList}
            motorPoses={this.getPropMotorPoses(this.state.keyframes, this.state.currentTime, this.state.duration)}
            changeMotorIdList={this.state.changeMotorIdList}
            checkedMotorIds={this.getPropCheckedMotorIds(this.state.motorIdList, this.state.motorNum)}
          />
          <div className="ui divider" />
          <RealtimeEncoder codeStr={this.state.codeStr} onChangeCodeStr={this.updateCode} />
        </div>
      </MovementDialogContext.Provider>
    );
  }
}

// SECTION name input
interface NameInputProps {
  name: string;
  updateMovementName: (name: string) => void;
}
interface NameInputState {
  tmpName: string;
}
export class NameInput extends React.Component<NameInputProps, NameInputState>{
  constructor(props: NameInputProps) {
    super(props);

    this.state = {
      tmpName: props.name
    }
  }

  render() {
    return <div className="ui labeled input">
    <div className="ui label">
      {lf("Name") + ": "}
    </div>
    <input
      type="text"
      value={this.state.tmpName}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {this.setState({ tmpName: event.target.value})}}
      onBlur={() => {let val = this.state.tmpName.trim(); this.setState({tmpName: val}); this.props.updateMovementName(val)}}
       />
  </div>
  }
}

// SECTION keyframe slider
// KeyframeSlider = Range + TimePointer
interface KeyframeSliderProps {
  duration: number;
  times: number[];
}
interface KeyframeSliderState {
  duration: number;
  times: number[];
}
export class KeyframeSlider extends React.Component<KeyframeSliderProps, KeyframeSliderState> {
  // for move keyframe
  keyframeOldTimes: number[] = [];
  keyframeOldTimesRewriteable: boolean = true;

  // range style
  trackStyle: React.CSSProperties = {
    opacity: 0
  };

  constructor(props: KeyframeSliderProps) {
    super(props);

    this.state = {
      duration: this.props.duration,
      times: this.props.times
    };

    this.beforeMoveOneKeyframe = this.beforeMoveOneKeyframe.bind(this);
    this.afterMoveOneKeyframe = this.afterMoveOneKeyframe.bind(this);
    this.handleDurationInputChange = this.handleDurationInputChange.bind(this);
    this.getPropsMarks = this.getPropsMarks.bind(this);
    this.handleGenerator = this.handleGenerator.bind(this);
    this.RangeTipFormatter = this.RangeTipFormatter.bind(this);
  }
  handleGenerator(handleProps: any): React.ReactNode {
    const { value, index, dragging, ...restProps } = handleProps;

    const style: React.CSSProperties = {
      background: "red"
    };
    return (
      <div key={value} style={style}>
        <Handle key={index} index={index} value={value} {...restProps} />
      </div>
    );
  }
  beforeMoveOneKeyframe(value: number[]) {
    if (this.keyframeOldTimesRewriteable) {
      this.keyframeOldTimes = value;
      this.keyframeOldTimesRewriteable = false;
    }
  }
  afterMoveOneKeyframe(oldTimes: number[], newTimes: number[], moveFunc: (oldTime: number, newTime: number) => void) {
    for (let i = 0; i < oldTimes.length; i++) {
      if (oldTimes[i] != newTimes[i]) {
        moveFunc(oldTimes[i], newTimes[i]);
        break;
      }
    }
    this.keyframeOldTimesRewriteable = true;
  }
  handleDurationInputChange(event: React.FocusEvent<HTMLInputElement>, setDuration: (duration: number) => void) {
    let newDuration = parseInt(event.target.value);
    setDuration(newDuration);
  }
  componentWillReceiveProps(newProps: KeyframeSliderProps) {
    this.setState({
      duration: newProps.duration,
      times: newProps.times
    });
  }
  getPropsMarks(duration: number): Marks {
    let res: Marks = {};
    let step: number = 1;
    let seconds = Math.floor(duration / 1000);

    if (seconds <= 10) step = 1;
    else if (seconds <= 50) step = 5;
    else if (seconds <= 100) step = 10;
    else step = 60;

    if (step < 60) {
      for (let i = 0; i < duration / 1000 / step; i++) {
        res[i * 1000 * step] = (i * step).toString() + "s";
      }
    } else {
      for (let i = 0; i < duration / 1000 / step; i++) {
        res[i * 1000 * step] = ((i * step) / 60).toString() + "min";
      }
    }

    return res;
  }
  getPropsTrackStyle(trackNum: number): React.CSSProperties[] {
    let res: React.CSSProperties[] = new Array<React.CSSProperties>(trackNum);
    for (let i = 0; i < trackNum; i++) {
      res[i] = this.trackStyle;
    }
    return res;
  }
  RangeTipFormatter(value: number): string {
    return (value / 1000).toString() + "s";
  }
  render() {
    return (
      <MovementDialogContext.Consumer>
        {({
          duration,
          currentTime,
          updateCurrentTime,
          isPlaying,
          toggleIsPlaying,
          setDuration,
          jumpToNeighborKeyframe,
          addKeyframe,
          deleteKeyframe,
          moveKeyframe,
          setSyncPose
        }) => (
          <div>
            <RangeWithTooltip
              tipFormatter={this.RangeTipFormatter}
              min={0}
              max={duration - 1}
              marks={this.getPropsMarks(duration)}
              trackStyle={this.getPropsTrackStyle(this.state.times.length)}
              handle={this.handleGenerator}
              defaultValue={this.props.times}
              value={this.state.times}
              allowCross={false}
              onBeforeChange={this.beforeMoveOneKeyframe}
              onChange={(val: number[]) => this.setState({times: val})}
              onAfterChange={val => this.afterMoveOneKeyframe(this.keyframeOldTimes, val, moveKeyframe)}
            />
            <TimePointer
              duration={duration}
              currentTime={currentTime}
              updateCurrentTime={updateCurrentTime}
              addKeyframe={() => addKeyframe()}
              setSyncPose={setSyncPose}
            />
            <div className="ui grid">
              <div className="twelve wide column">
                <div className="ui icon buttons left floated">
                  <button className="ui button" onClick={() => jumpToNeighborKeyframe(false)}>
                    <i className="angle left icon" />
                  </button>
                  <button className="ui icon button" onClick={toggleIsPlaying}>
                    {isPlaying ? <i className="pause icon" /> : <i className="play icon" />}
                  </button>
                  <button className="ui button" onClick={() => jumpToNeighborKeyframe(true)}>
                    <i className="angle right icon" />
                  </button>
                </div>

                <div className="ui icon buttons left floated">
                  <button
                    className="ui button"
                    onClick={() => {
                      addKeyframe();
                    }}
                  >
                    <i className="plus icon" />
                  </button>
                  <button className="ui button" onClick={deleteKeyframe}>
                    <i className="minus icon" />
                  </button>
                </div>

                <div className="ui right labeled left icon input left floated">
                  <i className="clock icon" />
                  <input
                    type="number"
                    placeholder="Duration"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      this.setState({ duration: parseInt(event.target.value) });
                    }}
                    onBlur={event => this.handleDurationInputChange(event, setDuration)}
                    value={this.state.duration}
                  />
                  <div className="ui basic label">ms</div>
                </div>
              </div>
              <div className="four wide column" />
            </div>
          </div>
        )}
      </MovementDialogContext.Consumer>
    );
  }
}

// TimePointer
interface TimePointerProps {
  duration: number;
  currentTime: number;

  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => void;
  addKeyframe: () => void;
  setSyncPose: () => void;
}
interface TimePointerState {
  pointerStyle: React.CSSProperties
}
export class TimePointer extends React.Component<TimePointerProps, TimePointerState> {
  pointerBarStyle: React.CSSProperties = {
    width: "100%",
    //background: "grey",
    margin: "0px 0px 10px 0px"
  };
  pointerStyle: React.CSSProperties = {
    width: 6,
    height: 20,
    borderLeft: "3px solid transparent",
    borderRight: "3px solid transparent",
    borderBottom: "20px solid red",
    position: "relative",
    left: "50%",
    marginLeft: -3,
    cursor: "default"
  };
  pointerStyleHover: React.CSSProperties = {
    width: 12,
    height: 30,
    borderLeft: "6px solid transparent",
    borderRight: "6px solid transparent",
    borderBottom: "30px solid red",
    position: "relative",
    left: "50%",
    marginLeft: -6,
    cursor: "move"
  };
  pointerBarDiv: React.RefObject<HTMLDivElement>;
  isDragging: boolean;

  constructor(props: TimePointerProps) {
    super(props);

    this.pointerBarDiv = React.createRef<HTMLDivElement>();

    this.pointerStyle.left = ((this.props.currentTime / (this.props.duration - 1)) * 100).toString() + "%";

    this.isDragging = false;

    this.state = {
      pointerStyle: this.pointerStyle
    };

    this.onPressPointerBar = this.onPressPointerBar.bind(this);
    this.onDoubleClickPointerBar = this.onDoubleClickPointerBar.bind(this);
    this.onMouseMovePointerBar = this.onMouseMovePointerBar.bind(this);
    this.onTouchPointerBar = this.onTouchPointerBar.bind(this);
    this.onTouchMovePointerBar = this.onTouchMovePointerBar.bind(this);
    this.onEndDrag = this.onEndDrag.bind(this);
    this.expandPointer = this.expandPointer.bind(this);
    this.shrinkPointer = this.shrinkPointer.bind(this);
  }

  onPressPointerBar(event: React.MouseEvent<HTMLDivElement>) {
    let x = event.clientX,
      y = event.clientY;
    if (!this.pointerBarDiv.current) return;
    let offsetLeft = this.pointerBarDiv.current.getBoundingClientRect().left,
      offsetWidth = this.pointerBarDiv.current.offsetWidth;
    let newTime = Math.round(((x - offsetLeft) / offsetWidth) * this.props.duration) - 1;
    this.props.setSyncPose();
    this.props.updateCurrentTime(newTime);

    this.expandPointer();
    this.isDragging = true;

    document.onmousemove = this.onMouseMovePointerBar.bind(this);
    document.onmouseup = this.onEndDrag;
  }
  onTouchPointerBar(event: React.TouchEvent<HTMLDivElement>) {
    let x = event.touches[0].clientX,
      y = event.touches[0].clientY;
    if (!this.pointerBarDiv.current) return;
    let offsetLeft = this.pointerBarDiv.current.getBoundingClientRect().left,
      offsetWidth = this.pointerBarDiv.current.offsetWidth;
    let newTime = Math.round(((x - offsetLeft) / offsetWidth) * this.props.duration) - 1;
    this.props.setSyncPose();
    this.props.updateCurrentTime(newTime);

    this.expandPointer();
    this.isDragging = true;

    document.ontouchmove = this.onMouseMovePointerBar.bind(this);
    document.ontouchend = this.onEndDrag;
  }
  onEndDrag() {
    document.ontouchmove = null;
    document.ontouchend = null;
    this.shrinkPointer();
    this.isDragging = false;
  }
  onDoubleClickPointerBar(event: React.MouseEvent<HTMLDivElement>) {
    this.props.addKeyframe();
  }
  onMouseMovePointerBar(event: React.MouseEvent<HTMLDivElement>) {
    if (event.buttons == 1) {  // Only auxiliary button pressed, usually the wheel button or the middle button (if present)
      event.preventDefault();
      let x = event.clientX,
        y = event.clientY;
      if (!this.pointerBarDiv.current) return;
      let offsetLeft = this.pointerBarDiv.current.getBoundingClientRect().left,
        offsetWidth = this.pointerBarDiv.current.offsetWidth;
      let newTime = Math.round(((x - offsetLeft) / offsetWidth) * this.props.duration) - 1;
      if (newTime < 0) newTime = 0;
      else if (newTime > this.props.duration - 1) newTime = this.props.duration - 1;
      this.props.updateCurrentTime(newTime);
    }
  }
  onTouchMovePointerBar(event: React.TouchEvent<HTMLDivElement>) {
    event.preventDefault();
    let x = event.touches[0].clientX,
      y = event.touches[0].clientY;
    if (!this.pointerBarDiv.current) return;
    let offsetLeft = this.pointerBarDiv.current.getBoundingClientRect().left,
      offsetWidth = this.pointerBarDiv.current.offsetWidth;
    let newTime = Math.round(((x - offsetLeft) / offsetWidth) * this.props.duration) - 1;
    if (newTime < 0) newTime = 0;
    else if (newTime > this.props.duration - 1) newTime = this.props.duration - 1;
    this.props.updateCurrentTime(newTime);
  }

  expandPointer() {
    let left = this.state.pointerStyle.left;
    this.setState({
      pointerStyle: {
        ...this.pointerStyleHover,
        left: left
      }
    })
    document.body.style.cursor = "move";
  }
  shrinkPointer() {
    let left = this.state.pointerStyle.left;
    this.setState({
      pointerStyle: {
        ...this.pointerStyle,
        left: left
      }
    })
    document.body.style.cursor = "default";
  }

  render() {
    const pointerStyleNew = {
      ...this.state.pointerStyle,
      left: ((this.props.currentTime / (this.props.duration - 1)) * 100).toString() + "%"
    };

    // this.pointerStyle.left = ((this.props.currentTime/(this.props.duration-1))*100).toString() + "%";
    return (
      <div
        style={this.pointerBarStyle}
        onMouseDown={this.onPressPointerBar}
        onMouseUp={this.onEndDrag}
        onDoubleClick={this.onDoubleClickPointerBar}
        // onMouseMove={this.onMouseMovePointerBar}
        onTouchStart={this.onTouchPointerBar}
        onMouseEnter={() => {if (!this.isDragging) this.expandPointer();}}
        onMouseLeave={() => {if (!this.isDragging) this.shrinkPointer();}}
        ref={this.pointerBarDiv}
      >
        <div style={pointerStyleNew} />
      </div>
    );
  }
}

// SECTION motor inputs
// MotorInputs = x * MotorInput + add & subtract buttons
interface MotorInputsProps {
  motorIdList: number[];
  motorPoses: number[];
  changeMotorIdList: (newList: number[]) => void;

  checkedMotorIds: boolean[];
}
interface MotorInputsState {}
export class MotorInputs extends React.Component<MotorInputsProps, MotorInputsState> {
  constructor(props: MotorInputsProps) {
    super(props);

    this.onAddMotorId = this.onAddMotorId.bind(this);
  }
  private firstAvailableMotorId(): number {
    let idx = 0;
    while (this.props.checkedMotorIds[idx]) {
      idx++;
    }
    if (idx == this.props.checkedMotorIds.length) return -1;
    else return idx;
  }
  onAddMotorId() {
    let motorId = this.firstAvailableMotorId();
    let list: number[] = Object.assign([], this.props.motorIdList);
    list.push(motorId);

    this.props.changeMotorIdList(list);
  }
  render() {
    return (
      <MovementDialogContext.Consumer>
        {({ motorIdList, changeMotorIdList, setKeyframe, sendWSDirect1, isPlaying }) => (
          <div>
            <div className="ui segments">
              {this.props.motorIdList.map((ele, idx) => {
                return (
                  <MotorInput
                    key={idx * 77 + ele * 7}
                    inputId={idx}
                    checkedMotorIds={this.props.checkedMotorIds}
                    motorIdList={motorIdList}
                    changeMotorIdList={changeMotorIdList}
                    setKeyframe={setKeyframe}
                    motorId={this.props.motorIdList[idx]}
                    motorPose={this.props.motorPoses[idx]}
                    sendWSDirect1={(motorId: number, pose: number) => {if (!isPlaying) sendWSDirect1(motorId, pose)}}
                  />
                );
              })}
            </div>
            {this.firstAvailableMotorId() >= 0 ? (
              <button className="ui icon button" onClick={this.onAddMotorId}>
                <i className="plus icon" />
              </button>
            ) : (
              undefined
            )}
          </div>
        )}
      </MovementDialogContext.Consumer>
    );
  }
}

// MotorInput
interface MotorInputProps {
  inputId: number; // index of this input in all inputs
  checkedMotorIds: boolean[]; // checked motorIds for dropdown

  motorIdList: number[];
  changeMotorIdList: (newList: number[]) => void;
  setKeyframe: (poseId: number, value: number) => void;

  motorId: number;
  motorPose: number;

  sendWSDirect1: (motorId: number, pose: number) => void;
}
interface MotorInputState {
  sliderValue: number;
}
export class MotorInput extends React.Component<MotorInputProps, MotorInputState> {
  constructor(props: MotorInputProps) {
    super(props);

    this.state = {
      sliderValue: this.props.motorPose
    };

    this.setSliderValue = this.setSliderValue.bind(this);
    this.onChangeMotorId = this.onChangeMotorId.bind(this);
    this.onChangeMotorPose = this.onChangeMotorPose.bind(this);
    this.onDeleteMotorId = this.onDeleteMotorId.bind(this);
  }
  componentWillReceiveProps(newProps: MotorInputProps) {
    const oldProps = this.props;
    if (oldProps.motorPose !== newProps.motorPose) {
      this.setState({
        sliderValue: newProps.motorPose
      });
    }
  }
  private setSliderValue(e: number) {
    console.log("setSliederValue");
    this.setState({
      sliderValue: e
    });
    this.props.sendWSDirect1(this.props.motorId, e);
  }

  onChangeMotorId(event: React.ChangeEvent<HTMLSelectElement>) {
    function swapArrayEles(array: number[], idx0: number, idx1: number) {
      let tmp = array[idx0];
      array[idx0] = array[idx1];
      array[idx1] = tmp;
    }

    let targetId = parseInt(event.target.value);

    let list: number[] = Object.assign([], this.props.motorIdList);
    let findIdx = list.findIndex(function(val) {
      return val == targetId;
    });
    if (findIdx >= 0) {
      // target id is selected
      swapArrayEles(list, findIdx, this.props.inputId);
    } else {
      list[this.props.inputId] = targetId;
    }

    this.props.changeMotorIdList(list);
  }
  onChangeMotorPose(pose: number) {
    this.props.setKeyframe(this.props.inputId, pose);
  }
  onDeleteMotorId() {
    let list = Object.assign([], this.props.motorIdList);
    list.splice(this.props.inputId, 1);
    this.props.changeMotorIdList(list);
  }
  render() {
    return (
      <div className="ui grid segment">
        <div className="two wide column">
          <select className="uidropdown" onChange={this.onChangeMotorId} value={this.props.motorId}>
            {this.props.checkedMotorIds.map((item, idx) => {
              if (idx == this.props.motorId) {
                return (
                  <option key={idx} value={idx} aria-selected="true">
                    {lf("motor") + " " + idx}
                  </option>
                );
              } else if (item) {
                return (
                  <option key={idx} value={idx} aria-selected="false">
                    {lf("motor") + " " + idx}
                  </option>
                );
              } else {
                return (
                  <option key={idx} value={idx} aria-selected="false">
                    {lf("motor") + " " + idx}
                  </option>
                );
              }
            })}
          </select>
        </div>
        <div className="thirteen wide column">
          <SliderWithTooltip
            min={-5000}
            max={5000}
            step={1}
            defaultValue={this.props.motorPose}
            value={this.state.sliderValue}
            onChange={this.setSliderValue}
            onAfterChange={this.onChangeMotorPose}
          />
        </div>
        <div className="one wide column">
          <button className="ui icon button" onClick={this.onDeleteMotorId}>
            <i className="minus icon" />
          </button>
        </div>
      </div>
    );
  }
}

// SECTION realtime encoder
interface RealtimeEncoderProps {
  codeStr: string;
  onChangeCodeStr: (codeStr: string) => void;
}
interface RealtimeEncoderState {
  codeStr: string;
}
export class RealtimeEncoder extends React.Component<RealtimeEncoderProps, RealtimeEncoderState> {
  textAreaStyle: React.CSSProperties = {
      width: "100%"
  }
  constructor(props: RealtimeEncoderProps) {
      super(props);

      this.state = {
          codeStr: this.props.codeStr
      };

      this.onChangeTextArea = this.onChangeTextArea.bind(this);
      this.syncCodeStr = this.syncCodeStr.bind(this);
  }
  onChangeTextArea(event: React.ChangeEvent<HTMLTextAreaElement>) {
      this.setState({
          codeStr: event.target.value
      });
  }
  syncCodeStr() {
      this.props.onChangeCodeStr(this.state.codeStr);
  }
  componentWillReceiveProps(newProps: RealtimeEncoderProps) {
      this.setState({
          codeStr: newProps.codeStr
      });
  }
  render() {
      return <div className="ui form">
          <textarea value={this.state.codeStr} onChange={this.onChangeTextArea}></textarea>
          <button className="ui icon button" onClick={this.syncCodeStr}>
              {lf("Sync")}
          </button>
      </div>
  }
}
