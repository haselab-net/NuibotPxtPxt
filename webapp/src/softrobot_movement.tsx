/// <reference path="../../built/softrobot.d.ts" />

import * as React from "react"
import {Range, RangeProps} from "./srComponents/Range"
import {DragBar} from './srComponents/DragBar'
import {DividerDropdown} from './srComponents/DividerDropdown'
import {TimePointer, TimePointerProps} from './srComponents/TimePointer'
import {Track, Tag} from './srComponents/Track'
import InputSubmitter from './srComponents/InputSubmitter'
import {Slider as MySlider, SliderProps} from './srComponents/Slider'
import {autorun, IReactionDisposer} from 'mobx'

export let CODE_STRING: string = "";

function roundTime(time: number) {
  let displayTime = time + 1
  let mod = displayTime % softrobot.device.robotInfo.MS_PER_MOVEMENT_TICK
  if (mod < (softrobot.device.robotInfo.MS_PER_MOVEMENT_TICK / 2)) {
    displayTime -= mod
  } else {
    displayTime += softrobot.device.robotInfo.MS_PER_MOVEMENT_TICK - mod
  }

  return displayTime - 1
}
function limitTime(roundedTime: number, duration: number) {
  return softrobot.util.limitNum(roundedTime, softrobot.device.robotInfo.MS_PER_MOVEMENT_TICK - 1, duration - duration % softrobot.device.robotInfo.MS_PER_MOVEMENT_TICK - 1)
}

// parameters
let MAX_KEYFRAME_COUNT = 16 - 1;  // the maximum number of keyframes in movement (there might be one auto interpolated keyframe at last)

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

interface Config {
  showColorBlock?: boolean;
  showDeveloperTools?: boolean;
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
  sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => void;

  // id
  name: string;     // unique id assign to this movement

  // motor state
  motorIdList: number[]; // motor ids
  keyframes: PartialKeyframe[]; // keyframes
  duration: number; // duration of this movement
  motorNum: number; // count of motors
  motorLengthLimits: number[][];  // [[min, max], ...]
  addKeyframe: (keyframe?: PartialKeyframe) => void;
  deleteKeyframe: (index?: number) => void;
  setKeyframe: (poseId: number, value: number) => void;
  moveKeyframe: (index: number, newTime: number) => void;
  changeMotorIdList: (newList: number[]) => void;

  // editor state
  currentTime: number; // current time in keyframe slider
  isKeyframe: boolean; // whether current time is keyframe
  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => void;
  isPlaying: boolean;
  toggleIsPlaying: () => void;
  setDuration: (duration: number) => void;
  setSyncPose: () => void;

  config: Config;
}
const defaultMovementDialogContext: MovementDialogContext = {
  codeStr: "",
  updateCode: (codeStr: string) => {},

  sendWSDirect1: (motorId: number, pose: number) => {},
  sendWSDirect: (motorIds: number[], poses: number[]) => {},
  sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => {},

  name: "default",

  motorIdList: [1, 2],
  keyframes: [{ pose: [1000, 2000], time: 10 }, { pose: [-1000, -2000], time: 500 }, { pose: [1000, 2000], time: 700 }],
  duration: 3000,
  motorNum: 3,
  motorLengthLimits: [[-5000, 5000], [-5000, 5000], [-5000, 5000]],
  addKeyframe: (keyframe?: PartialKeyframe) => {},
  moveKeyframe: (index: number, newTime: number) => {},
  deleteKeyframe: (index?: number) => {},
  changeMotorIdList: (newList: number[]) => {},
  setKeyframe: (poseId: number, value: number) => {},

  currentTime: 100,
  isKeyframe: false,
  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => {},
  isPlaying: false,
  toggleIsPlaying: () => {},
  setDuration: (duration: number) => {},
  setSyncPose: () => {},

  config: {
    showColorBlock: true,
    showDeveloperTools: true
  }
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
  invalidNames: string[];
  // communication
  sendWSDirect1: (motorId: number, pose: number) => void;
  sendWSDirect: (motorIds: number[], poses: number[]) => void,
  sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => void;
  queryWSInterpolate: () => void;
  clearWSInterpolate: () => void;
  // sync movement player
  addSyncCallback: (func: (id: number) => void) => number;
  deleteSyncCallback: (funcId: number) => void;
  // robot info
  motorNum: number;
  motorLengthLimits: number[][];  // [[min, max], ...]

  config: Config;
  onUpdateCode?: (newCode: string) => void;
}
interface MovementDialogState extends MovementDialogContext {}
export class MovementDialog extends React.Component<MovementDialogProps, MovementDialogState> {
  movementPlayer: any = undefined;        // update current time in fixed time
  private movementPlayerInterval: number = 20;
  private interpolateQueryer: any = undefined;
  private queryInterpolateInterval: number = 100;

  codeStrShouldUpdate: boolean = false;   // update codeStr after state updated if true

  syncPose: boolean = false;              // send pose to hardware in getPropMotorPoses if true

  private autoUpdateDisposer: IReactionDisposer
  private onUpdateCode: (newCode: string) => void

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
    this.setDuration = this.setDuration.bind(this);
    this.setSyncPose = this.setSyncPose.bind(this);
    this.syncTime = this.syncTime.bind(this);
    this.updateMovementName = this.updateMovementName.bind(this);
    this.updateDuration = this.updateDuration.bind(this);

    this.onUpdateCode = this.props.onUpdateCode ? this.props.onUpdateCode : () => {}

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
      motorLengthLimits: this.props.motorLengthLimits,

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
      setDuration: this.setDuration,
      setSyncPose: this.setSyncPose,

      config: this.props.config
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
      this.onUpdateCode(CODE_STRING)
    }
  }
  componentDidMount() {
    this.syncCallbackId = this.props.addSyncCallback(this.syncTime);

    this.autoUpdateDisposer = autorun(() => {
      const motorLengthLimits = softrobot.device.robotState.motor.map(motorState => {
        return [motorState.lengthMin, motorState.lengthMax]
      })
      this.setState({motorLengthLimits: motorLengthLimits})
    })
    // check pose belongs to [lengthMin, lengthMax]
    this.state.keyframes.map((keyframe) => keyframe.pose.map((pose, motorIdx) => {
      const idx = this.state.motorIdList[motorIdx];
      let motor = softrobot.device.robotState.motor[idx];
      if (pose < motor.lengthMin) {
        motor.lengthMin = pose;
      } else if (pose > motor.lengthMax) {
        motor.lengthMax = pose;
      }
    }))
  }
  componentWillUnmount() {
    if (this.state.isPlaying) this.toggleIsPlaying();

    this.props.deleteSyncCallback(this.syncCallbackId);

    this.autoUpdateDisposer()
  }
  componentWillReceiveProps(newProps: MovementDialogProps) {
    console.log("new props", newProps.motorLengthLimits)
    this.setState({
      motorLengthLimits: newProps.motorLengthLimits
    });
  }

  /**
   * Movement Player
   * Send Algorithm:  when start playing, we get [next keyframe id] and send next two neighbor keyframes
   *                  on every update, if the [next keyframe id] changed, we send one next next keyframe
   * Receive Algorithm: Bind callback with send queue (called when the minimum count of read is changed), compare it with that of time pointer.
   *                    If different, sync to the min count read of hardware.
   */
  private movementPlayerNextKeyframeId: number = 0;   // rewrite whenever start playing and is used only during playing
  private syncCallbackId: number = undefined;
  private startPointerTime: number = -1;
  private startMovementTime: number = -1;
  private lastMovementTime: number = -1;
  private updateTime() {
    let time = this.state.currentTime;
    time += this.movementPlayerInterval;
    if (time > this.state.duration) time -= this.state.duration;

    this.updateCurrentTime(time);
  }
  private onGotoNextKeyframe(nextKeyframeId: number) {    // [K0]time[K1][K2] || [K0][K1==time][K2] ===> [K0][K1]time[K2]
    // send next next keyframe
    this.sendKeyframeInterpolate((nextKeyframeId + 1) % this.state.keyframes.length);
  }
  private sendKeyframeInterpolate(keyframeId: number) {
    const keyframeTime = this.state.keyframes[keyframeId].time;
    const lastKeyframeTime = this.state.keyframes[(keyframeId - 1 + this.state.keyframes.length) % this.state.keyframes.length].time
    let interval = keyframeTime - lastKeyframeTime;
    if (interval <= 0) interval += this.state.duration;
    this.props.sendWSInterpolate(
      this.state.motorIdList,
      this.state.keyframes[keyframeId].pose,
      interval
    );
  }
  private syncTime(newTime: number) {    // sync time of movement player with hardware
    function mod(val1: number, val2: number) {
      return ((val1 % val2) + val2) % val2;
    }
    function inBetween(val: number, low: number, high: number): boolean {
      if (Number(low <= high) ^ Number(val < high) ^ Number(low <= val)) return true;
      else return false;
    }

    newTime = newTime * 50;

    if (!this.state.isPlaying) return;

    if (this.startMovementTime == -1) {     // start move pointer when hardware replies
      this.startMovementTime = newTime;
      this.lastMovementTime = newTime;
      this.movementPlayer = setInterval(this.updateTime, this.movementPlayerInterval);
      this.interpolateQueryer = setInterval(this.props.queryWSInterpolate, this.queryInterpolateInterval);
      return;
    }

    const lastTimeModed = mod(this.lastMovementTime - this.startMovementTime + this.startPointerTime, this.state.duration)
    if (newTime < this.startMovementTime) {
      this.startMovementTime -= (1 << 16) * 50;
    }
    const newTimeModed = mod(newTime - this.startMovementTime + this.startPointerTime, this.state.duration);
    const nextKeyframeTime = this.state.keyframes[this.movementPlayerNextKeyframeId].time;

    if (inBetween(nextKeyframeTime, lastTimeModed, newTimeModed)) {
      this.movementPlayerNextKeyframeId = (this.movementPlayerNextKeyframeId + 1) % this.state.keyframes.length;
      this.onGotoNextKeyframe(this.movementPlayerNextKeyframeId);
    }

    this.updateCurrentTime(newTimeModed);

    this.lastMovementTime = newTime;
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
      this.onUpdateCode(CODE_STRING)
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
    let time = keyframe ? keyframe.time : this.state.currentTime
    time = limitTime(roundTime(time), this.state.duration)
    if (this.state.keyframes.some(val => val.time === time)) return

    if (!keyframe) {
      keyframe = {
        time: time,
        pose: this.getPropMotorPoses(this.state.keyframes, time, this.state.duration).map(val => Math.round(val))
      };
    }

    let idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, keyframe.time);
    this.state.keyframes.splice(idx >= 0 ? idx : this.state.keyframes.length, 0, keyframe);
    this.setState({
      keyframes: this.state.keyframes,
      currentTime: time,
      isKeyframe: true
    });

    this.codeStrShouldUpdate = true;
  }
  deleteKeyframe(index?: number) {
    let idx: number;
    if (this.state.keyframes.length == 1) return;

    if (index !== undefined) {  // index specified
      if (index < 0 || index >= this.state.keyframes.length) return;
      idx = index;
    } else {                    // delete keyframe of current time
      if (!this.state.isKeyframe) return;

      idx = this.firstLargerTimeKeyframeIdx(this.state.keyframes, this.state.currentTime);
    }

    if (this.state.currentTime === this.state.keyframes[idx].time) {
      this.setState({
        isKeyframe: false
      });
    }

    let nextKeyframes = Object.assign([], this.state.keyframes);
    nextKeyframes.splice(idx, 1);
    this.setState({
      keyframes: nextKeyframes
    })

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

    let keyframes = [...this.state.keyframes];
    keyframes[idx < 0 ? keyframes.length - 1 : idx].pose[poseId] = value;
    this.setState({
      keyframes: keyframes
    });

    this.codeStrShouldUpdate = true;
  }
  moveKeyframe(index: number, newTime: number) {
    newTime = limitTime(roundTime(newTime), this.state.duration)

    let keyframes: PartialKeyframe[] = Object.assign([], this.state.keyframes);
    keyframes[index].time = newTime;
    this.setState({
      keyframes: keyframes,
      isKeyframe: true,
      currentTime: newTime
    });

    this.codeStrShouldUpdate = true;
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

      this.startPointerTime = this.state.currentTime;

      // send two keyframes
      this.props.sendWSInterpolate(
        this.state.motorIdList,
        this.state.keyframes[this.movementPlayerNextKeyframeId].pose,
        this.state.keyframes[this.movementPlayerNextKeyframeId].time - this.state.currentTime
      );
      this.sendKeyframeInterpolate((this.movementPlayerNextKeyframeId + 1) % this.state.keyframes.length);
    } else {            // stop playing
      if (!!this.movementPlayer) clearInterval(this.movementPlayer);
      if (!!this.interpolateQueryer) clearInterval(this.interpolateQueryer);

      this.props.clearWSInterpolate();
      this.startMovementTime = -1;
    }
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
  updateDuration(duration: number) {
    const minDuration: number = this.state.keyframes[this.state.keyframes.length - 1].time + 1;
    duration = minDuration > duration ? minDuration : duration;
    this.setState({duration: duration});
    this.codeStrShouldUpdate = true;

    if (this.state.currentTime > duration) this.setState({currentTime: duration - 1});
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
    const motorLengthLimitsBound = this.state.keyframes.reduce(
      (prev, cur) => (cur.time === this.state.currentTime ? prev : prev.map(
        (item, motorId) => [Math.min(item[0], cur.pose[motorId]), Math.max(item[1], cur.pose[motorId])]
        )), this.state.motorIdList.map(() => [0, 0]))

    return (
      <MovementDialogContext.Provider value={this.state}>
        <div className="ui segment">
          <NameInputs name={this.state.name} invalidNames={this.props.invalidNames} updateMovementName={this.updateMovementName} duration={this.state.duration} updateDuration={this.updateDuration} />
          <div className="ui divider" />
          <KeyframeSlider duration={this.state.duration} times={this.getTimeList(this.state.keyframes)} updateCurrentTime={this.updateCurrentTime} setSyncPose={this.setSyncPose} />
          <div className="ui divider" />
          <MotorInputs
            motorIdList={this.state.motorIdList}
            motorPoses={this.getPropMotorPoses(this.state.keyframes, this.state.currentTime, this.state.duration)}
            changeMotorIdList={this.state.changeMotorIdList}
            checkedMotorIds={this.getPropCheckedMotorIds(this.state.motorIdList, this.state.motorNum)}
            motorLengthLimitsBound={motorLengthLimitsBound}
          />
          {this.props.config.showDeveloperTools === false ? undefined : <DividerDropdown title={lf("Developer Tools")}>
            <RealtimeEncoder codeStr={this.state.codeStr} onChangeCodeStr={this.updateCode} />
          </DividerDropdown>}
        </div>
      </MovementDialogContext.Provider>
    );
  }
}

// SECTION name input
interface NameInputsProps {
  name: string;
  invalidNames: string[];
  duration: number;
  updateMovementName: (name: string) => void;
  updateDuration: (duration: number) => void;
}
interface NameInputsState {
  tmpName: string;
  validName: NameValidateState;
}
enum NameValidateState {
  Valid,
  OccupiedName,
  EmptyName
}
export class NameInputs extends React.Component<NameInputsProps, NameInputsState> {
  private readonly containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between'
  }
  constructor(props: NameInputsProps) {
    super(props);

    this.state = {
      tmpName: props.name,
      validName: this.nameValidator(props.name)
    }

    this.submitName = this.submitName.bind(this)
    this.submitDuration = this.submitDuration.bind(this)
  }

  // remove invalid characters
  nameFilter(name: string): string {
    return name.replace(/[\r\n\`\'\"]+/g, '').replace(/[^\x20-\x7F]/g, '');
  }
  nameValidator(name: string): NameValidateState {
    if (!name) return NameValidateState.EmptyName;
    else if (this.props.invalidNames.find(inv => inv === name)) return NameValidateState.OccupiedName;
    else return NameValidateState.Valid;
  }

  componentWillReceiveProps(newProps: NameInputsProps) {
    this.setState({
      tmpName: newProps.name,
    })
  }
  submitName() {
    let val = this.state.tmpName.trim();
    this.setState({tmpName: val});
    this.props.updateMovementName(val);
  }
  submitDuration(value: string) {
    let userInput = parseInt(value);
    if (isNaN(userInput)) {
      userInput = 0;
    }
    this.props.updateDuration(roundTime(userInput - 1) + 1)
  }

  render() {
    const nameInput = (
      <div className={this.state.validName === NameValidateState.Valid ? "ui labeled small input" : "ui labeled small input error"}>
        <div className="ui label">
          {lf("Name") + ": "}
        </div>
        <input
          type="text"
          value={this.state.tmpName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            this.setState({
              tmpName: this.nameFilter(event.target.value),
              validName: this.nameValidator(event.target.value)
            })
          }}
          onBlur={this.submitName}
          />
        { (() => {
          switch (this.state.validName) {
            case NameValidateState.Valid: return undefined;
            case NameValidateState.EmptyName: return <div className="ui left pointing red basic label"> {lf("Name is empty!")} </div>;
            case NameValidateState.OccupiedName: return <div className="ui left pointing red basic label"> {lf("That name is taken!")} </div>;
          }
        })()}
      </div>
    )
    const color = softrobot.util.str2Color(this.props.name)
    const nameColor = (
      <div className="ui" style={{
        width: 40,
        background: `rgb(${color[0]},${color[1]},${color[2]})`,
        border: "solid 3px #e0e1e2"
      }}></div>
    )
    const periodInput = (
      <div className="ui right labeled left icon small input right floated">
        {true ? <div className="ui label">{lf("Duration") + ":"}</div> : <i className="clock icon" />}
        <InputSubmitter
          type="number"
          placeholder="Duration"
          submitChange={this.submitDuration}
          value={this.props.duration}
          onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
            switch (event.key) {
              case "Up":
              case "ArrowUp":
                this.submitDuration((this.props.duration + 1000).toString());
                event.preventDefault();
                break;
              case "Down":
              case "ArrowDown":
                this.submitDuration((this.props.duration - 1000).toString());
                event.preventDefault();
                break;
              case "Left":
              case "ArrowLeft":
                  this.submitDuration((this.props.duration - 100).toString());
                event.preventDefault();
                break;
              case "Right":
              case "ArrowRight":
                  this.submitDuration((this.props.duration + 100).toString());
                  event.preventDefault();
                break;
              default:
                break;
            }
          }}
        />
        <div className="ui basic label">{lf("ms")}</div>
      </div>
    )
    return <div id="movement-editor-name-inputs" style={this.containerStyle}>
      <MovementDialogContext.Consumer>{({config}) => (config.showColorBlock === false ? undefined : nameColor)}</MovementDialogContext.Consumer>
      {periodInput}
    </div>
  }
}

// SECTION keyframe slider
// KeyframeSlider = Range + TimePointer
interface KeyframeSliderProps {
  duration: number;
  times: number[];
  updateCurrentTime: (newTime: number, isKeyframe?: boolean) => void;
  setSyncPose: () => void;
}
export class KeyframeSlider extends React.Component<KeyframeSliderProps> {
  // range style
  trackStyle: React.CSSProperties = {
    opacity: 0
  };

  private readonly WrappedRange = DragBar<RangeProps & {disabled?: boolean}>(Range, 40)
  private readonly WrappedTimePointer = DragBar<TimePointerProps & {disabled?: boolean}>(TimePointer, 60)

  private prevKeyframeTimes: number[] = [];

  constructor(props: KeyframeSliderProps) {
    super(props);

    this.state = {
      duration: this.props.duration,
      times: this.props.times
    };

    this.handleDurationInputChange = this.handleDurationInputChange.bind(this);
    this.getTrackTags = this.getTrackTags.bind(this);
    this.stickToKeyframe = this.stickToKeyframe.bind(this);
  }
  handleDurationInputChange(event: React.FocusEvent<HTMLInputElement>, setDuration: (duration: number) => void) {
    let newDuration = parseInt(event.target.value);
    setDuration(newDuration);
  }
  private getTrackTags(duration: number): Tag[] {
    let res: Tag[] = [];
    let step: number = 1;
    let seconds = Math.floor(duration / 1000);

    if (seconds <= 10) step = 1;
    else if (seconds <= 50) step = 5;
    else if (seconds <= 100) step = 10;
    else step = 60;

    if (step < 60) {
      for (let i = 1; i <= duration / 1000 / step; i++) {
        res.push({
          value: i * 1000 * step - 1,
          label: (i * step).toString() + "s"
        })
      }
    } else {
      for (let i = 1; i <= duration / 1000 / step; i++) {
        res.push({
          value: i * 1000 * step - 1,
          label: ((i * step) / 60).toString() + "min"
        })
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
  stickToKeyframe(newTime: number) {
    const distanceLimit: number = 100
    let minDistance = distanceLimit + 1, stickTime = -1;
    this.props.times.forEach(time => {
      const distance = Math.abs(newTime - time)
      if (distance < minDistance) {
        minDistance = distance;
        stickTime = time
      }
    })
    if (stickTime !== -1) {
      this.props.setSyncPose();
      this.props.updateCurrentTime(stickTime, true)
    }
  }
  render() {
    return (
      <MovementDialogContext.Consumer>
        {({
          duration,
          currentTime,
          isPlaying,
          toggleIsPlaying,
          addKeyframe,
          deleteKeyframe,
          moveKeyframe,
          isKeyframe,
          keyframes
        }) => {
          return <div>
            <this.WrappedRange values={this.props.times} min={0} max={duration - 1} minNeighborDistance={softrobot.device.robotInfo.MS_PER_MOVEMENT_TICK}
              onChange={(index: number, oldValue: number, newValue: number) => moveKeyframe(index, newValue)}
              onAfterChange={moveKeyframe}
              onEmphasize={deleteKeyframe}
            />
            <Track min={0} max={duration - 1} tags={this.getTrackTags(duration)} />
            <this.WrappedTimePointer
              duration={duration}
              currentTime={currentTime}
              updateCurrentTime={this.props.updateCurrentTime}
              addKeyframe={addKeyframe}
              setSyncPose={this.props.setSyncPose}
              onAfterChange={this.stickToKeyframe}
            />
            <div className="ui grid">
              <div className="four wide column">
                <div className="ui icon buttons left floated">
                  <button className="ui icon button" onClick={toggleIsPlaying}>
                    {isPlaying ? <i className="pause icon" /> : <i className="play icon" />}
                  </button>
                </div>
              </div>
              <div className="four wide column" />
              <div className="four wide column" />
              <div className="four wide column">
                <div className="ui icon buttons right floated">
                  {!isKeyframe && keyframes.length < MAX_KEYFRAME_COUNT ? <button
                    className="ui button"
                    onClick={() => {
                      addKeyframe();
                    }}
                  >
                    <i className="plus icon" />
                  </button> : undefined }
                  {isKeyframe && keyframes.length > 1 ? <button className="ui button" onClick={() => deleteKeyframe()}>
                    <i className="minus icon" />
                  </button> : undefined}
                </div>
              </div>
            </div>
          </div>
        }}
      </MovementDialogContext.Consumer>
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
  motorLengthLimitsBound: number[][];
}
export class MotorInputs extends React.Component<MotorInputsProps> {
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
        {({ motorIdList, changeMotorIdList, setKeyframe, sendWSDirect1, isPlaying, motorLengthLimits, isKeyframe }) => (
          <div>
            <div className="ui segments">
              {this.props.motorIdList.map((ele, idx) => {
                return (
                  <MotorInput
                    key={idx * 77 + ele * 7}
                    inputId={idx}
                    disabled={!isKeyframe}
                    checkedMotorIds={this.props.checkedMotorIds}
                    motorIdList={motorIdList}
                    changeMotorIdList={changeMotorIdList}
                    setKeyframe={setKeyframe}
                    motorId={this.props.motorIdList[idx]}
                    motorPose={this.props.motorPoses[idx]}
                    motorLengthLimits={motorLengthLimits[this.props.motorIdList[idx]]}
                    motorLengthLimitsBound={this.props.motorLengthLimitsBound[idx]}
                    sendWSDirect1={(motorId: number, pose: number) => {if (!isPlaying) sendWSDirect1(motorId, pose)}}
                  />
                );
              })}
            </div>
            {this.firstAvailableMotorId() >= 0 ? (
                <div className="ui grid">
                  <div className="fourteen wide column">
                  </div>
                  <div className="two wide column">
                      <button className="ui icon button right floated" onClick={this.onAddMotorId}>
                      <i className="plus icon"></i>
                      </button>
                  </div>
              </div>
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

  disabled: boolean;  // lock slider when current time is not keyframe

  motorIdList: number[];
  changeMotorIdList: (newList: number[]) => void;
  setKeyframe: (poseId: number, value: number) => void;

  motorId: number;
  motorPose: number;
  motorLengthLimits: number[]; // [min, max]
  motorLengthLimitsBound: number[]; // [max-min, min-max]

  sendWSDirect1: (motorId: number, pose: number) => void;
}
export class MotorInput extends React.Component<MotorInputProps> {
  private WrappedSlider = DragBar<SliderProps>(MySlider, "auto")

  private readonly containerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center"
  }
  private readonly itemLeft: React.CSSProperties = {
    padding: "5px 20px 5px 10px"
  }
  private readonly itemMiddle: React.CSSProperties = {
    flexGrow: 100
  }
  private readonly itemRight: React.CSSProperties = {
    padding: "5px 0px 5px 20px"
  }

  constructor(props: MotorInputProps) {
    super(props);

    this.onChangeMotorId = this.onChangeMotorId.bind(this);
    this.onChangeMotorPose = this.onChangeMotorPose.bind(this);
    this.onDeleteMotorId = this.onDeleteMotorId.bind(this);
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
  onChangeMotorPose(pose: number, end: boolean) {
    this.props.setKeyframe(this.props.inputId, Math.round(pose));
    this.props.sendWSDirect1(this.props.motorId, pose);
  }
  onDeleteMotorId() {
    let list = Object.assign([], this.props.motorIdList);
    list.splice(this.props.inputId, 1);
    this.props.changeMotorIdList(list);
  }
  onChangeLimit = (value: number, isMin: boolean) => {
    const {
      motorId,
      motorLengthLimitsBound
    } = this.props
    value = Math.round(value)

    if (isMin === true) {
      if (value > motorLengthLimitsBound[0]) value = motorLengthLimitsBound[0]
      softrobot.device.robotState.motor[motorId].lengthMin = value
    } else {
      if (value < motorLengthLimitsBound[1]) value = motorLengthLimitsBound[1]
      softrobot.device.robotState.motor[motorId].lengthMax = value
    }
  }
  render() {
    const min = this.props.motorLengthLimits[0]
    const max = this.props.motorLengthLimits[1]
    return (
      <div style={this.containerStyle}>
        <div style={this.itemLeft}>
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
        <div style={this.itemMiddle}>
          <this.WrappedSlider
            min={min}
            max={max}
            step={1}
            disabled={this.props.disabled}
            value={this.props.motorPose}
            onChange={(oldVal, newVal) => this.onChangeMotorPose(newVal, false)}
            onAfterChange={(val) => this.onChangeMotorPose(val, true)}
            tags={[{value: min, label: min.toString()}, {value: max, label: max.toString()}]}
            onChangeLimit={this.onChangeLimit}
          />
        </div>
        <div style={this.itemRight}>
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
