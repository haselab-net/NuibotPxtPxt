/// <reference path="../../built/softrobot.d.ts" />
/// <reference path="../../built/pxtblocks.d.ts"/>
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react";
import * as mobx from "mobx";
import * as sui from "./sui";
import * as core from "./core";
import Slider, { Handle, createSliderWithTooltip } from "rc-slider";
import classNames from "classnames";
import { MovementDialog, movementEncoder, movementDecoder, CODE_STRING } from "./softrobot_movement";
import { MQTTState } from "./softrobot_mqttstate";
import InputSubmitter from "./srComponents/InputSubmitter";
import { withSlider } from "./srComponents/SliderInput";
import {
  checkUpdate,
  retrieveFirmwareVersion,
  shouldUpdateFirmware,
  showFirmwareUpdateDialog
} from "./srComponents/OTA";

const InputWithSlider = withSlider(InputSubmitter);

export namespace dialog {
  /**
   * pair dialog
   * @param promptAsync settings of the dialog
   * @author gzl
   */
  export function webPairDialogAsync(promptAsync: (options: any) => Promise<string>): Promise<string> {
    const boardName = pxt.appTarget.appTheme.boardName || "???";

    const buttons: any[] = [];

    return promptAsync({
      header: lf("Enter IP address of your device"),
      hasCloseIcon: false,
      agreeLbl: lf("Pair device"),
      agreeIcon: "wifi",
      className: "downloaddialog",
      buttons,
      initialValue: softrobot.socket.ip_address
    });
  }

  /**
   * List of available IP addressed
   */
  interface IPListProps {
    onSelectChange: (ip: string) => void;
  }
  interface IPListState {
    contents: core.IListItem[];
  }
  export class IPList extends React.Component<IPListProps, IPListState> {
    constructor(props: IPListProps) {
      super(props);
      this.state = {
        contents: []
      };

      //this.onItemClicked.bind(this);

      let c = this.state.contents;
      c.push({
        text: "hello",
        onclick: () => {
          this.props.onSelectChange("hello");
        }
      });
      c.push({
        text: "hi",
        onclick: () => {
          this.props.onSelectChange("hi");
        }
      });
      this.setState({ contents: c });
    }

    startListening() {}

    render() {
      const { contents } = this.state;
      return (
        <div>
          {contents.map(item => (
            <sui.Item text={item.text} onClick={item.onclick} />
          ))}
        </div>
      );
    }
  }

  /**
   * Content of settings dialog
   */
  interface SettingsDialogProps {
    control_mode: softrobot.settings.ControlMode;
  }
  interface SettingsDialogState {
    control_mode: softrobot.settings.ControlMode;
  }
  enum SettingControlMode {
    Development_Mode = 0,
    Synchronization_Mode = 1,
    Offline_Mode = 2
  }
  export class SettingsDialog extends React.Component<SettingsDialogProps, SettingsDialogState> {
    constructor(props: SettingsDialogProps) {
      super(props);

      this.state = {
        control_mode: props.control_mode
      };

      this.changeDevelopmentMode = this.changeDevelopmentMode.bind(this);
      this.changeSynchronizationMode = this.changeSynchronizationMode.bind(this);
      this.changeOfflineMode = this.changeOfflineMode.bind(this);
    }

    changeDevelopmentMode(event: React.ChangeEvent<HTMLInputElement>) {
      this.setState({ control_mode: softrobot.settings.ControlMode.Development_Mode });
      softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Development_Mode;
    }

    changeSynchronizationMode(event: React.ChangeEvent<HTMLInputElement>) {
      this.setState({ control_mode: softrobot.settings.ControlMode.Synchronization_Mode });
      softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Synchronization_Mode;
    }

    changeOfflineMode(event: React.ChangeEvent<HTMLInputElement>) {
      this.setState({ control_mode: softrobot.settings.ControlMode.Offline_Mode });
      softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Offline_Mode;
    }

    render() {
      return (
        <div className="ui form">
          <div className="grouped fields">
            <div className="field">
              <div className="ui radio checkbox">
                <input
                  type="radio"
                  name="control_mode"
                  value="development_mode"
                  defaultChecked={this.props.control_mode == softrobot.settings.ControlMode.Development_Mode}
                  aria-checked={this.props.control_mode == softrobot.settings.ControlMode.Development_Mode}
                  onChange={this.changeDevelopmentMode}
                />
                <label>{lf("development mode")}</label>
              </div>
            </div>
            <div className="field">
              <div className="ui radio checkbox">
                <input
                  type="radio"
                  name="control_mode"
                  value="synchronization_mdoe"
                  defaultChecked={this.props.control_mode == softrobot.settings.ControlMode.Synchronization_Mode}
                  aria-checked={this.props.control_mode == softrobot.settings.ControlMode.Synchronization_Mode}
                  onChange={this.changeSynchronizationMode}
                />
                <label>{lf("synchronization mode")}</label>
              </div>
            </div>
            <div className="field">
              <div className="ui radio checkbox">
                <input
                  type="radio"
                  name="control_mode"
                  value="offline_mode"
                  defaultChecked={this.props.control_mode == softrobot.settings.ControlMode.Offline_Mode}
                  aria-checked={this.props.control_mode == softrobot.settings.ControlMode.Offline_Mode}
                  onChange={this.changeOfflineMode}
                />
                <label>{lf("offline mode")}</label>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
  export function controlModeDialogAsync(
    confirmAsync: (options: core.ConfirmOptions) => Promise<number>
  ): Promise<number> {
    return confirmAsync({
      header: lf("Control Mode"),
      hasCloseIcon: false,
      agreeLbl: lf("Done"),
      agreeIcon: "check",
      hideCancel: true,
      jsx: React.createElement(SettingsDialog, {
        control_mode: softrobot.settings.value.control_mode
      })
    });
  }

  /**
   * Content of calibration dialog
   */
  interface CalibrationDialogProps {}
  interface CalibrationDialogState {}
  export class CalibrationDialog extends React.Component<CalibrationDialogProps, CalibrationDialogState> {
    constructor(props: CalibrationDialogProps) {
      super(props);
      resetSlider = this.resetSlider.bind(this);

      // reset motors to pose 0
      for (let i = 0; i < softrobot.device.robotInfo.nMotor; i++) {
        softrobot.device.robotState.motor[i].pose = 0;
      }
      softrobot.message_command.updateRemoteDirect();
    }
    resetSlider() {
      this.forceUpdate();
    }
    render() {
      return (
        <div id="calibration-dialog" className="ui">
          {softrobot.device.robotState.motor.map((value: softrobot.device.MotorState, index: number) => {
            return <MotorSlider key={index} motorId={index} pose={value.pose} lengthMin={-3000} lengthMax={3000} />;
          })}
        </div>
      );
    }
  }
  let SliderWithTooltip = createSliderWithTooltip(Slider);
  interface MotorSliderProps {
    motorId: number;
    pose: number;
    lengthMin: number;
    lengthMax: number;
  }
  interface MotorSliderState {
    enablePWM: boolean;
    torqueMinCache: number;
    torqueMaxCache: number;
    pose: number;
  }
  export class MotorSlider extends React.Component<MotorSliderProps, MotorSliderState> {
    sliderCSS: React.CSSProperties = {
      marginLeft: 20,
      marginRight: 20,
      marginBottom: 10,
      marginTop: -15
    };
    constructor(props: MotorSliderProps) {
      super(props);

      this.state = {
        enablePWM: true,
        torqueMinCache: softrobot.device.robotState.motor[this.props.motorId].torqueMin,
        torqueMaxCache: softrobot.device.robotState.motor[this.props.motorId].torqueMax,
        pose: this.props.pose
      };

      this.getMarks = this.getMarks.bind(this);
      this.changeMotorLength = this.changeMotorLength.bind(this);
      this.setPWM = this.setPWM.bind(this);
    }
    componentWillReceiveProps(newProps: MotorSliderProps) {
      this.setState({
        pose: newProps.pose
      });
    }
    getMarks(): any {
      let res: any = {};
      for (let i: number = Math.ceil(this.props.lengthMin / 1000); i <= Math.floor(this.props.lengthMax / 1000); i++) {
        let mark = i * 1000;
        res[mark.toString()] = mark;
      }

      return res;
    }
    changeMotorLength(value: number) {
      softrobot.message_command.updateLocalMotorState({
        motorId: this.props.motorId,
        pose: value
      });
      softrobot.message_command.updateRemoteDirect();
    }
    setPWM(event: React.ChangeEvent<HTMLInputElement>) {
      if (event.target.checked === true) {
        // enable pwm
        softrobot.message_command.updateRemoteMotorState({
          motorId: this.props.motorId,
          torqueMin: this.state.torqueMinCache,
          torqueMax: this.state.torqueMaxCache
        });
      } else {
        // disable pwm
        softrobot.message_command.updateRemoteMotorState({
          motorId: this.props.motorId,
          torqueMin: 0,
          torqueMax: 0
        });
      }

      this.setState({
        enablePWM: event.target.checked
      });
    }

    componentWillUnmount() {
      // reset PWM
      if (!this.state.enablePWM) {
        softrobot.message_command.updateRemoteMotorState({
          motorId: this.props.motorId,
          torqueMin: this.state.torqueMinCache,
          torqueMax: this.state.torqueMaxCache
        });
      }
      softrobot.device.robotState.motor[this.props.motorId].torqueMin = this.state.torqueMinCache;
      softrobot.device.robotState.motor[this.props.motorId].torqueMax = this.state.torqueMaxCache;
    }
    render() {
      return (
        <div className="ui segment">
          <div className="ui grid">
            <div className="row">
              <div className="ui toggle checkbox">
                <input
                  name={"checkbox" + this.props.motorId.toString()}
                  data-tip={this.state.enablePWM ? lf("disable PWM") : lf("enable PWM")}
                  type="checkbox"
                  checked={this.state.enablePWM}
                  onChange={this.setPWM}
                ></input>
                <label>{lf("Motor ") + this.props.motorId.toString()}</label>
              </div>
            </div>
            <div className="row">
              <SliderWithTooltip
                disabled={!this.state.enablePWM}
                style={this.sliderCSS}
                marks={this.getMarks()}
                min={this.props.lengthMin}
                max={this.props.lengthMax}
                step={1}
                value={this.state.pose}
                onChange={(val: number) => this.setState({ pose: val })}
                onAfterChange={this.changeMotorLength}
              />
            </div>
          </div>
        </div>
      );
    }
  }
  export function doCalibration() {
    softrobot.message_command.resetSensor({ resetSensorFlag: softrobot.command.ResetSensorFlags.RSF_MOTOR });
    softrobot.device.robotState.motor.forEach(element => {
      element.pose = 0;
    });

    resetSlider();
  }
  export let resetSlider: () => void; // overwrite by calibration dialog
  export function calibrationDialogAsync(
    confirmAsync: (options: core.ConfirmOptions) => Promise<number>
  ): Promise<number> {
    let tmpMode = softrobot.settings.value.control_mode;
    softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Development_Mode;
    return confirmAsync({
      header: lf("Motor Calibration"),
      hasCloseIcon: true,
      hideCancel: true,
      hideAgree: true,
      jsx: React.createElement(CalibrationDialog, {}),
      buttons: [
        {
          // REVIEW calibration button could not reset sliders
          label: lf("Calibration"),
          onclick: doCalibration,
          icon: "compress",
          approveButton: false
        } /*, {
                label: lf("Done"),
                onclick: doCalibration,
                icon: "check"
            }*/
      ]
    }).then(() => {
      softrobot.settings.value.control_mode = tmpMode;
      return Promise.resolve(0);
    });
  }

  /**
   * Movement dialog
   */
  softrobot.editor.onFieldMovementClicked = (currentValue: string, setValue: (newValue: string) => void) => {
    let movementName = currentValue.match(/^.+?[ \n\r]/)[0].trim();
    let invalidNames = pxtblockly.duplicateNameChecker
      .list()
      .filter((item: { name: string; count: number }) => {
        if (item.name == movementName && item.count == 1) return false;
        else return true;
      })
      .map((item: { name: string; count: number }) => item.name);

    let lengthMin: number[] = softrobot.util.getPropArray("lengthMin", softrobot.device.robotState.motor);
    let lengthMax: number[] = softrobot.util.getPropArray("lengthMax", softrobot.device.robotState.motor);
    let motorLengthLimits: number[][] = [];

    for (let idx: number = 0; idx < lengthMax.length; idx++) motorLengthLimits.push([lengthMin[idx], lengthMax[idx]]);
    core.confirmAsync({
      header: lf("Movement Editor"),
      hasCloseIcon: false,
      hideCancel: true,
      hideAgree: true,
      jsx: React.createElement(MovementDialog, {
        key: Math.random(),
        codeStr: currentValue,
        encoder: movementEncoder,
        decoder: movementDecoder,
        invalidNames: invalidNames,
        sendWSDirect1: (motorId: number, pose: number) => {
          if (softrobot.settings.value.control_mode !== softrobot.settings.ControlMode.Development_Mode) return;
          softrobot.message_command.updateLocalMotorState({
            motorId: motorId,
            pose: pose
          });
          softrobot.message_command.updateRemoteDirect();
        },
        sendWSDirect: (motorIds: number[], poses: number[]) => {
          if (softrobot.settings.value.control_mode !== softrobot.settings.ControlMode.Development_Mode) return;
          motorIds.map((value: number, index: number) => {
            softrobot.message_command.updateLocalMotorState({
              motorId: value,
              pose: poses[index]
            });
          });
          softrobot.message_command.updateRemoteDirect();
        },
        sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => {
          if (softrobot.settings.value.control_mode !== softrobot.settings.ControlMode.Development_Mode) return;
          let data = {
            movementCommandId: softrobot.command.CommandIdMovement.CI_M_ADD_KEYFRAME,
            movementId: 1,
            keyframeId: 0,
            motorCount: motorIds.length,
            motorId: motorIds,
            period: time,
            pose: poses,
            refMovementId: 0,
            refKeyframeId: 0,
            refMotorId: 0,
            timeOffset: 0,
            strictMode: true
          };
          softrobot.message_command.setMovement(data);
        },
        queryWSInterpolate: () => {
          let data = {
            movementCommandId: softrobot.command.CommandIdMovement.CI_M_QUERY
          };
          softrobot.message_command.setMovement(data);
        },
        clearWSInterpolate: () => {
          let data = {
            movementCommandId: softrobot.command.CommandIdMovement.CI_M_CLEAR_ALL
          };
          softrobot.message_command.setMovement(data);
        },
        addSyncCallback: (func: (newTime: number) => void) => {
          return softrobot.message_command.onRcvCIUMovementMessage.push(
            (data: softrobot.packet_command.IMovementDataRcv) => {
              func(data.movementTime);
            }
          );
        },
        deleteSyncCallback: (funcId: number) => {
          softrobot.message_command.onRcvCIUMovementMessage.remove(funcId);
        },
        motorNum: softrobot.device.robotInfo.nMotor,
        motorLengthLimits: motorLengthLimits,
        config: {}
      }),
      buttons: [
        {
          label: lf("Confirm"),
          onclick: () => {
            setValue(CODE_STRING);
          },
          icon: "check"
        }
      ],
      size: "large"
    });
  };

  /**
   * HTTP Param dialog
   */
  let HTTP_PARAMS_STRING = "";
  interface HTTPParamDialogProps {
    params: string;
  }
  interface HTTPParamDialogState {
    params_obj: string[][];
  }
  export class HTTPParamDialog extends React.Component<HTTPParamDialogProps, HTTPParamDialogState> {
    constructor(props: HTTPParamDialogProps) {
      super(props);
      this.state = {
        params_obj: this.paramsDecoder(props.params)
      };

      console.log("params: ", props.params);
      console.log("params obj: ", this.paramsDecoder(props.params));
    }

    paramEncoder(params_obj: string[][]): string {
      let res: string = "";

      for (let pair of params_obj) {
        if (pair[0] == "") continue;

        if (res != "") res += "&";

        res += pair[0] + "=" + encodeURIComponent(pair[1]);
      }

      return res;
    }

    paramsDecoder(params: string): string[][] {
      let res: string[][] = [];

      res = params
        .split("&")
        .filter(element => element != "")
        .map(val => val.split("=").map(val => decodeURIComponent(val)));
      res.push(["", ""]);

      return res;
    }

    /**
     * set parameter field / value
     * @param id index of params_obj
     * @param key 1: field, 0: value
     * @param value new value
     */
    setParam(id: number, key: boolean): (event: React.ChangeEvent<HTMLInputElement>) => void {
      return (event: React.ChangeEvent<HTMLInputElement>) => {
        // validate new string
        if (key && event.target.value) {
          if (!/^[a-z_][a-z0-9_]*$/.test(event.target.value)) return; // start with [a-z_] and contains only [a-z0-9_]
        }

        // change parameter
        let newParam = this.state.params_obj;
        if (key) newParam[id][0] = event.target.value;
        else newParam[id][1] = event.target.value;

        // add new line for input
        if (id == newParam.length - 1 && key) newParam.push(["", ""]);
        else if (key && !event.target.value) newParam.splice(id, 1);

        this.setState({
          params_obj: newParam
        });

        HTTP_PARAMS_STRING = this.paramEncoder(newParam);
      };
    }

    render() {
      return (
        <table className="ui celled table">
          <thead>
            <tr>
              <th>{lf("Field")}</th>
              <th>{lf("Value")}</th>
            </tr>
          </thead>
          <tbody>
            {this.state.params_obj.map((value: string[], index: number) => {
              return (
                <tr key={index}>
                  <td data-label="Field">
                    <div className="ui input">
                      <input type="text" value={value[0]} onChange={this.setParam(index, true)}></input>
                    </div>
                  </td>
                  <td data-label="Value">
                    <div className="ui input">
                      <input type="text" value={value[1]} onChange={this.setParam(index, false)}></input>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
  }
  softrobot.editor.onFieldHTTTPParamClicked = (currentValue: string, setValue: (newValue: string) => void) => {
    core.confirmAsync({
      header: lf("HTTP Parameters"),
      hasCloseIcon: false,
      hideCancel: true,
      hideAgree: true,
      jsx: React.createElement(HTTPParamDialog, {
        params: currentValue
      }),
      buttons: [
        {
          label: lf("Confirm"),
          onclick: () => {
            setValue(HTTP_PARAMS_STRING);
          },
          icon: "check"
        }
      ],
      size: "large"
    });
  };

  /**
   * Test Button
   */
  interface TestButtonProps {}
  interface TestButtonState {
    state: number;
  }
  export class TestButton extends React.Component<TestButtonProps, TestButtonState> {
    constructor(props: TestButtonProps) {
      super(props);

      this.state = {
        state: 0
      };

      this.testFunction = this.testFunction.bind(this);
    }
    testFunction(e: React.MouseEvent<HTMLElement>) {
      console.log("test function called");
      checkUpdate();
    }
    render() {
      return (
        <button className="ui button" onClick={this.testFunction}>
          {"test button: " + this.state.state.toString()}
        </button>
      );
    }
  }
}

export namespace dialog.robotStateInspector {
  softrobot.message_command.onRcvCIBoardInfoMessage.push(() => {
    updateInfo = true;
  });
  softrobot.message_command.onRcvCIDirectMessage.push(() => {
    updateMotors = true;
  });
  softrobot.message_command.onRcvCIInterpolateMessage.push(() => {
    updateMotors = true;
  });
  softrobot.message_command.onRcvCISensorMessage.push(() => {
    updateSensors = true;
  });
  let updateInfo = false,
    updateMotors = false,
    updateSensors = false;
  type RobotStateInspectorTabs = "Info" | "Motors" | "Sensors";
  let tabCache: RobotStateInspectorTabs = "Motors";

  interface RobotStateInspectorProps {}
  interface RobotStateInspectorState {
    tab: RobotStateInspectorTabs;
    latestFirmwareVersion: string;
  }
  export class RobotStateInspector extends React.Component<RobotStateInspectorProps, RobotStateInspectorState> {
    intervalId: number = undefined;
    intervalTime: { [key in RobotStateInspectorTabs]: number } = {
      Info: 1000,
      Motors: 100,
      Sensors: 100
    };
    constructor(props: RobotStateInspectorProps) {
      super(props);

      this.state = {
        tab: tabCache,
        latestFirmwareVersion: "v0.0.0r"
      };

      updateInfo = false;
      updateMotors = false;
      updateSensors = false;

      retrieveFirmwareVersion().then(version => {
        this.setState({
          latestFirmwareVersion: version
        });
      });
    }
    componentDidMount() {
      this.startInterval(this.state.tab);
    }
    componentWillUnmount() {
      this.stopInterval();
    }
    startInterval(tab: RobotStateInspectorTabs) {
      this.intervalId = window.setInterval(() => {
        let flag: boolean = false;
        switch (tab) {
          case "Info":
            flag = updateInfo;
            break;
          case "Motors":
            flag = updateMotors;
            break;
          case "Sensors":
            flag = updateSensors;
            break;
          default:
            break;
        }
        if (flag) this.forceUpdate();

        if (
          tab == "Sensors" &&
          softrobot.settings.value.control_mode == softrobot.settings.ControlMode.Development_Mode
        )
          softrobot.message_command.requireSensorInfo();
      }, this.intervalTime[tab]);
    }
    stopInterval() {
      if (!this.intervalId) return;
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    toggleTab(target: RobotStateInspectorTabs) {
      this.setState({
        tab: target
      });
      tabCache = target;

      this.stopInterval();
      this.startInterval(target);
    }
    showInfo(): React.ReactNode {
      let info = softrobot.device.robotInfo;
      return (
        <table className="ui celled table">
          <thead>
            <tr>
              <th>{lf("Component")}</th>
              <th>{lf("Count")}</th>
            </tr>
          </thead>
          <tbody>
            <tr key="motor">
              <td data-label="Component">{lf("motor")}</td>
              <td data-label="Count">{info.nMotor}</td>
            </tr>
            <tr key="force sensor">
              <td data-label="Component">{lf("force sensor")}</td>
              <td data-label="Count">{info.nForces}</td>
            </tr>
            <tr key="current sensor">
              <td data-label="Component">{lf("current sensor")}</td>
              <td data-label="Count">{info.nCurrent}</td>
            </tr>
            <tr key="touch sensor">
              <td data-label="Component">{lf("touch sensor")}</td>
              <td data-label="Count">{info.nTouch}</td>
            </tr>
          </tbody>
          <thead>
            <tr>
              <th>{lf("Item")}</th>
              <th>{lf("Description")}</th>
            </tr>
          </thead>
          <tbody>
            <tr key="firmware version">
              <td data-label="Item">{lf("firmware version")}</td>
              <td data-label="Description">
                {info.firmwareInfo.version}
                {softrobot.socket.paired.get() === softrobot.socket.PairStatus.Paired && shouldUpdateFirmware(
                  softrobot.device.robotInfo.firmwareInfo.version,
                  this.state.latestFirmwareVersion
                ) ? (
                  <button
                    className="ui button tiny basic positive"
                    style={{ marginLeft: 10 }}
                    onClick={showFirmwareUpdateDialog}
                  >
                    <i className="arrow alternate circle up icon"></i>
                    {lf("new version: ") + this.state.latestFirmwareVersion}
                  </button>
                ) : (
                  undefined
                )}
              </td>
            </tr>
          </tbody>
        </table>
      );
    }
    showMotors(): React.ReactNode {
      return (
        <table className="ui celled table">
          <thead>
            <tr>
              <th>{lf("Id")}</th>
              <th>{lf("Pose")}</th>
              <th>{lf("Velocity")}</th>
            </tr>
          </thead>
          <tbody>
            {softrobot.device.robotState.motor.map((val, key) => {
              return (
                <tr key={key}>
                  <td data-label="Id">{key}</td>
                  <td data-label="Pose">{val.poseRcv}</td>
                  <td data-label="Velocity">{val.velocityRcv}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }
    showSensors(): React.ReactNode {
      return (
        <div>
          {softrobot.device.robotInfo.nForces > 0 ? (
            <div>
              <h4>{lf("Force")}</h4>
              <table className="ui celled table">
                <thead>
                  <tr>
                    <th>{lf("Id")}</th>
                    <th>{lf("Value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {softrobot.device.robotState.force.map((val, key) => {
                    return (
                      <tr key={key}>
                        <td data-label="Id">{key}</td>
                        <td data-label="Value">{val}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            undefined
          )}
          {softrobot.device.robotInfo.nCurrent > 0 ? (
            <div>
              <h4>{lf("Current")}</h4>
              <table className="ui celled table">
                <thead>
                  <tr>
                    <th>{lf("Id")}</th>
                    <th>{lf("Value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {softrobot.device.robotState.current.map((val, key) => {
                    return (
                      <tr key={key}>
                        <td data-label="Id">{key}</td>
                        <td data-label="Value">{val}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            undefined
          )}
          {softrobot.device.robotInfo.nTouch > 0 ? (
            <div>
              <h4>{lf("Touch Sensor")}</h4>
              <table className="ui celled table">
                <thead>
                  <tr>
                    <th>{lf("Id")}</th>
                    <th>{lf("Value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {softrobot.device.robotState.touch.map((val, key) => {
                    return (
                      <tr key={key}>
                        <td data-label="Id">{key}</td>
                        <td data-label="Value">{val}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            undefined
          )}
        </div>
      );
    }
    render() {
      return (
        <div>
          <div className="ui top attached tabular menu">
            {(() => {
              let tabArray: RobotStateInspectorTabs[] = ["Info", "Motors", "Sensors"];
              return tabArray.map(val => {
                function myLf(str: RobotStateInspectorTabs): string {
                  switch (str) {
                    case "Info":
                      return lf("Info");
                    case "Motors":
                      return lf("Motors");
                    case "Sensors":
                      return lf("Sensors");
                  }
                }
                if (val == this.state.tab)
                  return (
                    <div key={val} className="active item">
                      {myLf(val)}
                    </div>
                  );
                else
                  return (
                    <div key={val} className="item" onClick={() => this.toggleTab(val)}>
                      {myLf(val)}
                    </div>
                  );
              });
            })()}
          </div>
          <div className="ui bottom attached active tab segment">
            {(() => {
              switch (this.state.tab) {
                case "Info":
                  return this.showInfo();
                case "Motors":
                  return this.showMotors();
                case "Sensors":
                  return this.showSensors();
                default:
                  return undefined;
              }
            })()}
          </div>
        </div>
      );
    }
  }
}

export namespace dialog.blockTestDialog {
  let onReceiveResponse: (response: string) => void;

  interface WebhookTestProps {
    url: string;
    params: string[][];
  }
  interface WebhookTestState {
    fullUrl: string;
    response: string;
  }
  export class WebhookTest extends React.Component<WebhookTestProps, WebhookTestState> {
    constructor(props: WebhookTestProps) {
      super(props);

      this.state = {
        fullUrl: this.getFullUrl(this.props.url, this.props.params),
        response: ""
      };

      this.sendRequest = this.sendRequest.bind(this);
      this.onReceiveResponse = this.onReceiveResponse.bind(this);
    }
    getFullUrl(url: string, params: string[][]): string {
      let res = url;
      res += "?";
      for (let param of this.props.params) {
        if (res[res.length - 1] != "?") res += "&";
        let key = encodeURI(param[0]),
          value = encodeURI(param[1]);
        res += key + "=" + value;
      }
      return res;
    }
    componentWillReceiveProps(props: WebhookTestProps) {
      this.setState({
        fullUrl: this.getFullUrl(props.url, props.params)
      });
    }
    sendRequest() {
      // reference my compile options
      const softRobot = pxt.appTarget.softRobot;

      // bind callback
      onReceiveResponse = this.onReceiveResponse;

      let xmlHttp = new XMLHttpRequest();
      xmlHttp.onreadystatechange = function() {
        let response_text = `Status Code: ${xmlHttp.status} \nResponse Text: ${xmlHttp.responseText}`;
        onReceiveResponse(response_text);
      };
      xmlHttp.onerror = function() {
        let response_text = `Request error`;
        onReceiveResponse(response_text);
      };
      xmlHttp.ontimeout = function() {
        let response_text = `Request timeout`;
        onReceiveResponse(response_text);
      };

      // send request
      let request_url = this.getFullUrl(this.props.url, this.props.params);
      // tslint:disable-next-line:no-http-string
      let cros_api_url = "http://" + softRobot.corsProxy + "/";
      xmlHttp.open("GET", cros_api_url + request_url, true);
      xmlHttp.send();
      this.onReceiveResponse("Waiting for response...");
    }
    onReceiveResponse(response: string) {
      this.setState({
        response: response
      });
    }
    render() {
      return (
        <div className="ui form">
          <div className="ui field">
            <h4 className="ui header">{lf("request")}</h4>
            <textarea readOnly value={this.state.fullUrl}></textarea>
            <button className="ui button" onClick={this.sendRequest}>
              {lf("send")}
            </button>
          </div>
          <div className="ui field">
            <h4 className="ui header">{lf("response")}</h4>
            <textarea readOnly value={this.state.response}></textarea>
          </div>
        </div>
      );
    }
  }
  softrobot.editor.showWebhookTester = (header: string, url: string, params: string[][]) => {
    core.dialogAsync({
      header: header,
      jsx: React.createElement(WebhookTest, {
        url: url,
        params: params
      }),
      hideCancel: true,
      hasCloseIcon: true
    });
  };
  softrobot.editor.showMQTTTester = (nuibotId: string, event: string) => {
    console.log(nuibotId);
    if (typeof nuibotId !== "string" || nuibotId.length !== 6) {
      core.warningNotification(lf("Please pair your Nuibot first"));
    } else {
      core.dialogAsync({
        header: lf("MQTT Listener"),
        hasCloseIcon: true,
        hideCancel: true,
        jsx: React.createElement(MQTTState, { nuibotId: nuibotId, event: event })
      });
    }
  };
}

export namespace dialog.robotSettings {
  type ParameterType = number | boolean | string;
  interface SettingItemInputProps {
    parameterName: string;
    parameterVal: ParameterType;
    label: string
    display: 'tr' | 'div';
    validatorReg?: RegExp;
    saveParameter?: (newValue: ParameterType) => void; // write to NVS if not provided
    classes?: string;
  }
  interface SettingItemInputState {
    lastParameterVal: ParameterType;
    parameterVal: ParameterType;
  }
  export class SettingItemInput extends React.Component<SettingItemInputProps, SettingItemInputState> {
    private classes = "ui input"
    constructor(props: SettingItemInputProps) {
      super(props);

      if (this.props.classes) {
        this.classes = this.props.classes
      }

      this.state = {
        lastParameterVal: this.props.parameterVal,
        parameterVal: this.props.parameterVal
      };
    }

    validator(value: number | string): boolean {
      if (!this.props.validatorReg) return true;
      else return this.props.validatorReg.test(typeof value === "number" ? value.toString() : value);
    }

    private submitChange = (newValue: string | boolean) => {
      const typedVal = this.onValChange(newValue);
      this.saveParameter(typedVal);
    };

    private onValChange(newValue: string | boolean) {
      let typedVal: ParameterType = this.state.parameterVal;
      switch (typeof this.props.parameterVal) {
        case "boolean":
          typedVal = newValue;
          break;
        case "number":
          let newNum = Number(newValue);
          if (isNaN(newNum)) break;
          typedVal = Number(newValue);
          break;
        case "string":
          typedVal = newValue;
          break;
      }
      this.setState({ parameterVal: typedVal });
      return typedVal;
    }
    private saveParameter(val: ParameterType) {
      if (typeof val === "boolean" || this.validator(val)) {
        // pass validator
        if (this.props.saveParameter) {
          // have save parameter function
          this.props.saveParameter(val);
        } else {
          softrobot.settings.writeNvs({
            // write to NVS on default
            key: this.props.parameterName,
            valType: softrobot.device.robotInfo.nvsSettings[this.props.parameterName].type,
            val: typeof val === "boolean" ? Number(val) : val
          });
        }

        this.setState({
          lastParameterVal: val
        });
      } else {
        // not pass validator
        this.setState({
          parameterVal: this.state.lastParameterVal
        });
      }
    }

    private renderInput(haveLabel: boolean) {
      const label = this.props.label
      function renderLabel() {
        return haveLabel ? <label>{label}</label> : undefined
      }

      switch (typeof this.props.parameterVal) {
        case "boolean":
          return (
            <div className={this.classes}>
              <input
                type="checkbox"
                name={this.props.parameterName}
                checked={this.state.parameterVal as boolean}
                onChange={event => this.submitChange(event.target.checked)}
              />
              {renderLabel()}
            </div>
          );
        case "number":
          return (
            <div className={this.classes}>
              <InputWithSlider
                min={-5000}
                max={5000}
                valuePerPixel={1}
                type="text"
                name={this.props.parameterName}
                value={(this.state.parameterVal as number).toString()}
                submitChange={this.submitChange}
              />
              {renderLabel()}
            </div>
          );
        case "string":
          return (
            <div className={this.classes}>
              <InputSubmitter
                type="text"
                name={this.props.parameterName}
                value={this.state.parameterVal as string}
                submitChange={this.submitChange}
              />
              {renderLabel()}
            </div>
          );
        default:
          return undefined;
      }
    }

    render() {
      if (this.props.display == 'div') {
        return this.renderInput(true);
      }

      return (
        <tr key={this.props.parameterName}>
          <td data-label="Parameter">{this.props.label}</td>
          <td data-label="Value">
            {this.renderInput(false)}
          </td>
        </tr>
      );
    }
  }

  interface RobotSettingsDialogProps {
    nvsSettings: { [key: string]: softrobot.device.NvsSetting };
  }
  interface RobotSettingsDialogState {
    tab: SettingsTabs;
  }
  type SettingsTabs = "UI" | "Hardware";
  let tabCache: SettingsTabs = "UI";
  export class RobotSettingsDialog extends React.Component<RobotSettingsDialogProps, RobotSettingsDialogState> {
    constructor(props: RobotSettingsDialogProps) {
      super(props);

      this.state = {
        tab: tabCache
      };

      this.toggleTab = this.toggleTab.bind(this);
    }

    showHardwareSetting(): React.ReactNode {
      return (
        <table className="ui celled table">
          <thead>
            <tr>
              <th>{lf("Parameter")}</th>
              <th>{lf("Value")}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let res: JSX.Element[] = [];
              for (let key in this.props.nvsSettings) {
                if (this.props.nvsSettings.hasOwnProperty(key)) {
                  let val = this.props.nvsSettings[key];
                  res.push(
                    <SettingItemInput key={key} parameterName={key} parameterVal={val.value} label={val.label} display='tr'></SettingItemInput>
                  );
                }
              }
              return res;
            })()}
          </tbody>
        </table>
      );
    }
    showUISetting(): React.ReactNode {
      return (
        <table className="ui celled table">
          <thead>
            <tr>
              <th>{lf("Parameter")}</th>
              <th>{lf("Value")}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let res: JSX.Element[] = [];
              for (let i = 0; i < softrobot.device.robotInfo.nMotor; i++) {
                res.push(
                  <SettingItemInput
                    key={"lengthMin" + i.toString()}
                    parameterName={"lengthMin" + i.toString()}
                    parameterVal={softrobot.device.robotState.motor[i].lengthMin}
                    saveParameter={val => (softrobot.device.robotState.motor[i].lengthMin = val as number)}
                    label={lf("Minumum length {0}", i.toString())}
                    display='tr'
                  ></SettingItemInput>
                );
                res.push(
                  <SettingItemInput
                    key={"lengthMax" + i.toString()}
                    parameterName={"lengthMax" + i.toString()}
                    parameterVal={softrobot.device.robotState.motor[i].lengthMax}
                    saveParameter={val => (softrobot.device.robotState.motor[i].lengthMax = val as number)}
                    label={lf("Maximum length {0}", i.toString())}
                    display='tr'
                  ></SettingItemInput>
                );
              }
              return res;
            })()}
          </tbody>
        </table>
      );
    }

    toggleTab(target: SettingsTabs) {
      this.setState({
        tab: target
      });
      tabCache = target;
    }

    render() {
      return (
        <div>
          <div className="ui top attached tabular menu">
            {(() => {
              let tabArray: SettingsTabs[] = ["UI", "Hardware"];
              return tabArray.map(val => {
                function myLf(str: SettingsTabs): string {
                  switch (str) {
                    case "UI":
                      return lf("UI");
                    case "Hardware":
                      return lf("Hardware");
                  }
                }
                if (val == this.state.tab)
                  return (
                    <div key={val} className="active item">
                      {myLf(val)}
                    </div>
                  );
                else
                  return (
                    <div key={val} className="item" onClick={() => this.toggleTab(val)}>
                      {myLf(val)}
                    </div>
                  );
              });
            })()}
          </div>
          <div className="ui bottom attached active tab segment">
            {(() => {
              switch (this.state.tab) {
                case "UI":
                  return this.showUISetting();
                case "Hardware":
                  return this.showHardwareSetting();
                default:
                  return undefined;
              }
            })()}
          </div>
        </div>
      );
    }
  }
}

export namespace component {
  /**
   * Dropdown for selecting control mode
   */
  enum ControlMode {
    DevelopmentMode = 0,
    SynchronizationMode = 1,
    OfflineMode = 2
  }
  interface ControlModeDropdownProps {
    setControlMode: (mode: number) => void;
  }
  interface ControlModeDropdownState {
    locked: boolean;
  }
  export class ControlModeDropdown extends React.Component<ControlModeDropdownProps, ControlModeDropdownState> {
    constructor(props: ControlModeDropdownProps) {
      super(props);

      this.state = {
        locked: false
      };

      this.lock = this.lock.bind(this);
      this.unlock = this.unlock.bind(this);

      softrobot.ui.lockControlModeDropdown = this.lock;
      softrobot.ui.unlockControlModeDropdown = this.unlock;
    }
    componentWillMount() {
      this.setState({
        locked: false
      });
    }
    lock() {
      console.log("lock");
      this.setState({
        locked: true
      });
    }
    unlock() {
      console.log("unlock");
      this.setState({
        locked: false
      });
    }
    render() {
      return (
        <select
          className={this.state.locked ? "ui disabled dropdown" : "ui dropdown"}
          defaultValue="0"
          title={lf("Choose control mode")}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            this.props.setControlMode(parseInt(event.target.value))
          }
        >
          <option value="0">{lf("Development")}</option>
          <option value="1">{lf("Synchronization")}</option>
          <option value="2">{lf("Offline")}</option>
        </select>
      );
    }
  }

  /**
   * Button for pair device and show pair status
   */
  interface PairButtonProps {
    pair: () => void;
    unpair: () => void;
  }
  interface PairButtonStatus {
    nuibotId: string;
    pairStatus: softrobot.socket.PairStatus;
  }
  export class PairButton extends React.Component<PairButtonProps, PairButtonStatus> {
    constructor(props: PairButtonProps) {
      super(props);

      this.state = {
        nuibotId: "",
        pairStatus: softrobot.socket.PairStatus.Unpaired
      };

      softrobot.message_command.onRcvCIBoardInfoMessage.push(() => {
        this.setState({ nuibotId: softrobot.util.macAddress2NuibotId(softrobot.device.robotInfo.macAddress) });
      });
    }

    private pairDisposer: mobx.IReactionDisposer;
    componentDidMount() {
      this.pairDisposer = mobx.autorun(() => this.setState({ pairStatus: softrobot.socket.paired.get() }));
    }
    componentWillUnmount() {
      this.pairDisposer();
    }

    render() {
      const content =
        this.state.pairStatus === softrobot.socket.PairStatus.Pairing
          ? lf("Pairing")
          : [
              <i className="icon wifi" key="wifi-icon"></i>,
              this.state.pairStatus === softrobot.socket.PairStatus.Paired
                ? this.state.nuibotId + " " + lf("Paired")
                : lf("Pair")
            ];
      const buttonClass = classNames(
        "ui",
        "small",
        "collapse-button",
        {
          green: this.state.pairStatus === softrobot.socket.PairStatus.Paired,
          grey: this.state.pairStatus !== softrobot.socket.PairStatus.Paired
        },
        {
          loading: this.state.pairStatus === softrobot.socket.PairStatus.Pairing
        }
      );
      return (
        <sui.Button
          className={buttonClass}
          onClick={this.state.pairStatus === softrobot.socket.PairStatus.Paired ? this.props.unpair : this.props.pair}
          title={
            this.state.pairStatus === softrobot.socket.PairStatus.Unpaired
              ? lf("Pair your Nuibot")
              : lf("Unpair Nuibot")
          }
          icon = {this.state.pairStatus === softrobot.socket.PairStatus.Pairing ? undefined : 'wifi'} 
          text = {this.state.pairStatus === softrobot.socket.PairStatus.Pairing ? lf("Pairing") : 
            this.state.pairStatus === softrobot.socket.PairStatus.Paired ? lf("Paired") : lf("Pair")}
          disabled={this.state.pairStatus === softrobot.socket.PairStatus.Pairing}
        >
        </sui.Button>
      );
    }
  }

  export class WrappedPairButton extends React.Component<{}> {
    constructor(props: {}) {
      super(props)

      this.pair = this.pair.bind(this);
      this.unpair = this.unpair.bind(this);
    }

    private pair() {
      const prePairAsync = dialog.webPairDialogAsync
            ? dialog.webPairDialogAsync(core.chooseAsync)
            : Promise.resolve("");
      return prePairAsync.then((res) => {
        if (res === null) {
            return Promise.resolve()
        }
        let reg_ip = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;
        let reg = RegExp(reg_ip);
        if (reg.test(res)) {
            softrobot.socket.ip_address = res;
            return softrobot.socket.webPairAsync()
                .then(() => {
                    // core.infoNotification(lf("Device paired! Try downloading now."))
                }, (err: string) => {
                    core.errorNotification(lf("Failed to pair the device"))
                });
        }
        else {
            core.errorNotification(lf("Not an ip address."));
        }
        return Promise.resolve();
      });
    }

    private unpair() {
      return softrobot.socket.webUnpairAsync().then((success) => {
        if (success) {
            // core.infoNotification(lf("Device unpaired!"));
        } else {
            // core.errorNotification(lf("Device is not paired!"));
        }
      })
    }

    render() {
      return <PairButton pair={this.pair} unpair={this.unpair}/>
    }
  }
}
