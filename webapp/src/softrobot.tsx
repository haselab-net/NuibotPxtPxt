/// <reference path="../../built/softrobot.d.ts" />
/// <reference path="../../built/pxtblocks.d.ts"/>
/// <reference path="../../built/pxtlib.d.ts" />

import * as React from "react"
import * as ReactDOM from "react-dom"
import * as sui from "./sui"
import * as core from "./core"
import { SpreadOption } from "bluebird";
import Slider, { Handle, createSliderWithTooltip } from 'rc-slider';
import {RCTooltip} from 'rc-tooltip';
import {MovementDialog, movementEncoder, movementDecoder, CODE_STRING} from "./softrobot_movement";

export namespace dialog {
    /**
     * pair dialog
     * @param promptAsync settings of the dialog
     * @author gzl 
     */
    export function webPairDialogAsync(promptAsync: (options: any) => Promise<string>): Promise<string> {
        const boardName = pxt.appTarget.appTheme.boardName || "???";

        const buttons: any[] = [];

        function getIP(): string {
            let url: URL = new URL(window.location.href);
            let ip = url.searchParams.get("NuibotIP");
            let ip_reg = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
            if (ip_reg.test(ip)) return ip;
            else return softrobot.socket.ip_address;
        }

        return promptAsync({
            header: lf("Enter IP address of your device"),
            hasCloseIcon: true,
            agreeLbl: lf("Pair device"),
            agreeIcon: "usb",
            hideCancel: true,
            className: 'downloaddialog',
            buttons,
            initialValue: getIP()
        });
    }

    /**
     * List of available IP addressed
     */
    interface IPListProps {
        onSelectChange: (ip: string) => void
    }
    interface IPListState {
        contents: core.IListItem[]
    }
    export class IPList extends React.Component<IPListProps, IPListState> {
        constructor (props: IPListProps) {
            super(props);
            this.state = {
                contents: []
            }

            //this.onItemClicked.bind(this);

            let c = this.state.contents;
            c.push({
                text: "hello",
                onclick: () => {this.props.onSelectChange("hello");}
            });
            c.push({
                text: "hi",
                onclick: () => {this.props.onSelectChange("hi");}
            });
            this.setState({contents: c});
        }

        startListening () {

        }

        render () {
            const { contents } = this.state;
            return <div>
                {contents.map((item) => (
                    <sui.Item text={item.text} onClick={item.onclick} />
                ))}
            </div>
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
            }

            this.changeDevelopmentMode = this.changeDevelopmentMode.bind(this);
            this.changeSynchronizationMode = this.changeSynchronizationMode.bind(this);
            this.changeOfflineMode = this.changeOfflineMode.bind(this);
        }

        changeDevelopmentMode(event: React.ChangeEvent<HTMLInputElement>) {
            this.setState({control_mode: softrobot.settings.ControlMode.Development_Mode});
            softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Development_Mode;
        }

        changeSynchronizationMode(event: React.ChangeEvent<HTMLInputElement>) {
            this.setState({control_mode: softrobot.settings.ControlMode.Synchronization_Mode});
            softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Synchronization_Mode;
        }

        changeOfflineMode(event: React.ChangeEvent<HTMLInputElement>) {
            this.setState({control_mode: softrobot.settings.ControlMode.Offline_Mode});
            softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Offline_Mode;
        }

        render() {
            return <div className="ui form">
                <div className="grouped fields">
                <label>Control Mode</label>
                    <div className="field">
                        <div className="ui radio checkbox">
                            <input type="radio" name="control_mode" value="development_mode" defaultChecked={this.props.control_mode == softrobot.settings.ControlMode.Development_Mode} aria-checked={this.props.control_mode == softrobot.settings.ControlMode.Development_Mode} onChange={this.changeDevelopmentMode} />
                            <label>{lf("development mode")}</label>
                        </div>
                    </div>
                    <div className="field">
                        <div className="ui radio checkbox">
                            <input type="radio" name="control_mode" value="synchronization_mdoe" defaultChecked={this.props.control_mode == softrobot.settings.ControlMode.Synchronization_Mode} aria-checked={this.props.control_mode == softrobot.settings.ControlMode.Synchronization_Mode} onChange={this.changeSynchronizationMode} />
                            <label>{lf("synchronization mode")}</label>
                        </div>
                    </div>
                    <div className="field">
                        <div className="ui radio checkbox">
                            <input type="radio" name="control_mode" value="offline_mode" defaultChecked={this.props.control_mode == softrobot.settings.ControlMode.Offline_Mode} aria-checked={this.props.control_mode == softrobot.settings.ControlMode.Offline_Mode} onChange={this.changeOfflineMode} />
                            <label>{lf("offline mode")}</label>
                        </div>
                    </div>
                </div>
                </div>
        }
    }
    export function settingsDialogAsync(confirmAsync: (options: core.ConfirmOptions) => Promise<number>): Promise<number> {
        return confirmAsync({
            header: lf("Settings"),
            hasCloseIcon: false,
            agreeLbl: lf("Done"),
            agreeIcon: "check",
            hideCancel: true,
            jsx: React.createElement(SettingsDialog, {
                control_mode: softrobot.settings.value.control_mode
            })
        })
    }

    /**
     * Content of calibration dialog
     */
    interface CalibrationDialogProps {
    }
    interface CalibrationDialogState {
    }
    export class CalibrationDialog extends React.Component<CalibrationDialogProps, CalibrationDialogState> {
        render() {
            return <div id="calibration-dialog" className="ui">
                {softrobot.device.robotState.motor.map((value: softrobot.device.MotorState,
                index: number) => {
                    return <MotorSlider key={index} motorId={index} pose={value.pose} lengthMin={-3000} lengthMax={3000} />
                })}
            </div>
        }
    }
    let SliderWithTooltip = createSliderWithTooltip(Slider);
    interface MotorSliderProps {
        motorId: number,
        pose: number,
        lengthMin: number,
        lengthMax: number
    }
    interface MotorSliderState {
        enablePWM: boolean;
        torqueMinCache: number;
        torqueMaxCache: number;
    }
    export class MotorSlider extends React.Component<MotorSliderProps, MotorSliderState> {
        sliderCSS: React.CSSProperties = {
            marginLeft: 20,
            marginRight: 20,
            marginBottom: 10,
            marginTop: -15
        }
        constructor(props: MotorSliderProps) {
            super(props);

            this.state = {
                enablePWM: true,
                torqueMinCache: softrobot.device.robotState.motor[this.props.motorId].torqueMin,
                torqueMaxCache: softrobot.device.robotState.motor[this.props.motorId].torqueMax
            }

            this.getMarks = this.getMarks.bind(this);
            this.changeMotorLength = this.changeMotorLength.bind(this);
            this.setPWM = this.setPWM.bind(this);
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
            })
            softrobot.message_command.updateRemoteDirect();
        }
        setPWM(event: React.ChangeEvent<HTMLInputElement>) {
            if (event.target.checked === true) {    // enable pwm
                softrobot.message_command.updateRemoteMotorState({
                    motorId: this.props.motorId,
                    torqueMin: this.state.torqueMinCache,
                    torqueMax: this.state.torqueMaxCache
                })
            } else { // disable pwm
                softrobot.message_command.updateRemoteMotorState({
                    motorId: this.props.motorId,
                    torqueMin: 0,
                    torqueMax: 0
                })
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
                })
            }
            softrobot.device.robotState.motor[this.props.motorId].torqueMin = this.state.torqueMinCache;
            softrobot.device.robotState.motor[this.props.motorId].torqueMax = this.state.torqueMaxCache;
        }
        render() {
            return <div className="ui segment">
                <div className="ui grid">
                    <div className="row">
                        <div className="ui toggle checkbox">
                            <input name={"checkbox" + this.props.motorId.toString()} data-tip={this.state.enablePWM ? lf("disable PWM") : lf("enable PWM")} type="checkbox" checked={this.state.enablePWM} onChange={this.setPWM}></input>
                            <label>{"Motor " + this.props.motorId.toString()}</label>
                        </div>
                    </div>
                    <div className="row">
                        <SliderWithTooltip disabled={!this.state.enablePWM} style={this.sliderCSS} marks={this.getMarks()} min={this.props.lengthMin} max={this.props.lengthMax} step={1} defaultValue={this.props.pose} onAfterChange={this.changeMotorLength} />
                    </div>
                </div>
            </div>
        }
    }
    export function doCalibration() {
        softrobot.message_command.resetSensor({resetSensorFlag: softrobot.command.ResetSensorFlags.RSF_MOTOR});
        softrobot.device.robotState.motor.forEach(element => {
            element.pose = 0;
        })
    }
    export function calibrationDialogAsync(confirmAsync: (options: core.ConfirmOptions) => Promise<number>): Promise<number> {
        let tmpMode = softrobot.settings.value.control_mode;
        softrobot.settings.value.control_mode = softrobot.settings.ControlMode.Development_Mode;
        return confirmAsync({
            header: lf("Calibration"),
            hasCloseIcon: false,
            hideCancel: true,
            hideAgree: true,
            jsx: React.createElement(CalibrationDialog, {}),
            buttons: [/* {              // REVIEW calibration button could not reset sliders
                label: lf("Calibration"),
                onclick: doCalibration,
                icon: "compress",
                approveButton: false
            }, */{
                label: lf("Done"),
                onclick: doCalibration,
                icon: "check"
            }]
        }).then(() => {
            softrobot.settings.value.control_mode = tmpMode;
            return Promise.resolve(0);
        });
    }

    /**
     * Movement dialog
     */
    softrobot.editor.onFieldMovementClicked = (currentValue: string, setValue: (newValue: string) => void) => {
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
                        })
                    })
                    softrobot.message_command.updateRemoteDirect();
                },
                sendWSInterpolate: (motorIds: number[], poses: number[], time: number) => {
                    if (softrobot.settings.value.control_mode !== softrobot.settings.ControlMode.Development_Mode) return -1;
                    motorIds.map((value: number, index: number) => {
                        softrobot.message_command.updateLocalMotorState({
                            motorId: value,
                            pose: poses[index]
                        })
                    })
                    let keyframe = {
                        pose: softrobot.device.robotState.getPropArray<number>("pose", softrobot.device.robotState.motor),
                        period: time
                    }
                    return softrobot.movement.sendKeyframeQueue.enqueue(keyframe);     // note: the keyframe is not always successfully enqueued
                },
                queryWSInterpolate: () => {
                    softrobot.movement.sendKeyframeQueue.forceQuery();
                },
                addSyncCallback: (func: (id: number) => void) => {
                    return softrobot.movement.sendKeyframeQueue.onCountReadMinChange.push(func);
                },
                deleteSyncCallback: (funcId: number) => {
                    softrobot.movement.sendKeyframeQueue.onCountReadMinChange.remove(funcId);
                },
                motorNum: softrobot.device.robotInfo.nMotor
            }),
            buttons: [{
                label: lf("Confirm"),
                onclick: () => {
                    setValue(CODE_STRING);
                },
                icon: "check"
            }],
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
            }

            console.log("params: ", props.params);
            console.log("params obj: ", this.paramsDecoder(props.params));
        }

        paramEncoder(params_obj: string[][]): string {
            let res: string = "";

            for (let pair of params_obj) {
                if (pair[0] == "") continue;

                if (res != "") res += "&"

                res += pair[0] + "=" + encodeURIComponent(pair[1]);
            }

            return res;
        }

        paramsDecoder(params: string): string[][] {
            let res: string[][] = [];

            res = params.split("&").filter(element => element != "").map(val => val.split("=").map(val => decodeURIComponent(val)));
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
                    if (!/^[a-z_][a-z0-9_]*$/.test(event.target.value)) return;     // start with [a-z_] and contains only [a-z0-9_]
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
            }
        }

        render() {
            return <table className="ui celled table">
                <thead>
                    <tr>
                        <th>{lf("Field")}</th>
                        <th>{lf("Value")}</th>
                    </tr>
                </thead>
                <tbody>
                    {this.state.params_obj.map((value: string[], index: number) => {
                    return <tr key={index}>
                        <td data-label="Field"><div className="ui input">
                            <input type="text" value={value[0]} onChange={this.setParam(index, true)}></input>
                        </div></td>
                        <td data-label="Value"><div className="ui input">
                            <input type="text" value={value[1]} onChange={this.setParam(index, false)}></input>
                        </div></td>
                    </tr>})}
                </tbody>
            </table>
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
            buttons: [{
                label: lf("Confirm"),
                onclick: () => {
                    setValue(HTTP_PARAMS_STRING);
                },
                icon: "check"
            }],
            size: "large"
        })
    }

    /**
     * Test Button
     */
    interface TestButtonProps {
    }
    interface TestButtonState {
        state: number;
    }
    export class TestButton extends React.Component<TestButtonProps, TestButtonState> {
        constructor(props: TestButtonProps) {
            super(props);

            this.state = {
                state: 0
            }

            this.testFunction = this.testFunction.bind(this);
        }
        testFunction(e: React.MouseEvent<HTMLElement>) {
            console.log("test function called");

            core.confirmAsync({
                header: lf("Robot State Inspector"),
                hasCloseIcon: true,
                hideCancel: true,
                hideAgree: true,
                jsx: React.createElement(robotSettings.RobotSettingsDialog, {nvsSettings: softrobot.device.robotInfo.nvsSettings})
            });

            // switch (this.state.state) {
            //     case 0: {
            //         softrobot.settings.writeNvs({
            //             key: "hello",
            //             valType: softrobot.util.cDataType.int16,
            //             val: -13
            //         })
            //         break;
            //     }
            //     case 1: {
            //         softrobot.settings.readNvs("hello", softrobot.util.cDataType.int16);
            //         break;
            //     }
            // }

            // let state = this.state.state;
            // this.setState({
            //     state: (state + 1) % 2
            // })
        }
        render() {
            return <button className="ui button" onClick={this.testFunction}>{"test button: " + this.state.state.toString()}</button>
        }
    }
}

export namespace dialog.robotStateInspector {
    softrobot.message_command.onRcvCIBoardInfoMessage.push(() => {
        updateInfo = true;
    })
    softrobot.message_command.onRcvCIDirectMessage.push(() => {
        updateMotors = true;
    })
    softrobot.message_command.onRcvCIInterpolateMessage.push(() => {
        updateMotors = true;
    })
    softrobot.message_command.onRcvCISensorMessage.push(() => {
        updateSensors = true;
    })
    let updateInfo = false, updateMotors = false, updateSensors = false;
    export type RobotStateInspectorTabs = "Info" | "Motors" | "Sensors";
    export let tabCache: RobotStateInspectorTabs = "Motors";

    interface RobotStateInspectorProps {
    }
    interface RobotStateInspectorState {
        tab: RobotStateInspectorTabs
    }
    export class RobotStateInspector extends React.Component<RobotStateInspectorProps, RobotStateInspectorState> {
        intervalId: number = undefined;
        intervalTime: {[key in RobotStateInspectorTabs]: number} = {
            "Info": 1000,
            "Motors": 100,
            "Sensors": 100
        }
        constructor(props: RobotStateInspectorProps) {
            super(props);

            this.state = {
                tab: tabCache
            }

            updateInfo = false;
            updateMotors = false;
            updateSensors = false;
        }
        componentDidMount() {
            this.startInterval(this.state.tab);
        }
        componentWillUnmount() {
            this.stopInterval();
        }
        startInterval(tab: RobotStateInspectorTabs) {
            this.intervalId = setInterval(() => {
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

                if (tab == "Sensors" && softrobot.settings.value.control_mode == softrobot.settings.ControlMode.Development_Mode) softrobot.message_command.requireSensorInfo();
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
            return <table className="ui celled table">
                        <thead>
                            <tr><th>{lf("Component")}</th>
                            <th>{lf("Count")}</th>
                        </tr></thead>
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
                            <tr><th>{lf("Item")}</th>
                            <th>{lf("Description")}</th>
                        </tr></thead>
                        <tbody>
                            <tr key="firmware version">
                                <td data-label="Item">{lf("firmware version")}</td>
                                <td data-label="Description">{info.firmwareInfo.version}</td>
                            </tr>
                        </tbody>
                    </table>
        }
        showMotors(): React.ReactNode {
            return <table className="ui celled table">
                <thead>
                    <tr><th>{lf("Id")}</th>
                    <th>{lf("Pose")}</th>
                    <th>{lf("Velocity")}</th>
                </tr></thead>
                <tbody>
                    {softrobot.device.robotState.motor.map((val, key) => {
                        return <tr key={key}>
                            <td data-label="Id">{key}</td>
                            <td data-label="Pose">{val.poseRcv}</td>
                            <td data-label="Velocity">{val.velocityRcv}</td>
                        </tr>
                    })}
                </tbody>
            </table>
        }
        showSensors(): React.ReactNode {
            return <div>
                {softrobot.device.robotInfo.nForces > 0 ? <div>
                    <h4>{lf("Force")}</h4>
                    <table className="ui celled table">
                        <thead>
                            <tr><th>{lf("Id")}</th>
                            <th>{lf("Value")}</th>
                        </tr></thead>
                        <tbody>
                            {softrobot.device.robotState.force.map((val, key) => {
                                return <tr key={key}>
                                    <td data-label="Id">{key}</td>
                                    <td data-label="Value">{val}</td>
                                </tr>
                            })}
                        </tbody>
                    </table>
                </div> : undefined}
                {softrobot.device.robotInfo.nCurrent > 0 ? <div>
                    <h4>{lf("Current")}</h4>
                    <table className="ui celled table">
                        <thead>
                            <tr><th>{lf("Id")}</th>
                            <th>{lf("Value")}</th>
                        </tr></thead>
                        <tbody>
                            {softrobot.device.robotState.current.map((val, key) => {
                                return <tr key={key}>
                                    <td data-label="Id">{key}</td>
                                    <td data-label="Value">{val}</td>
                                </tr>
                            })}
                        </tbody>
                    </table>
                </div> : undefined}
                {softrobot.device.robotInfo.nTouch > 0 ? <div>
                    <h4>{lf("Touch Sensor")}</h4>
                    <table className="ui celled table">
                        <thead>
                            <tr><th>{lf("Id")}</th>
                            <th>{lf("Value")}</th>
                        </tr></thead>
                        <tbody>
                            {softrobot.device.robotState.touch.map((val, key) => {
                                return <tr key={key}>
                                    <td data-label="Id">{key}</td>
                                    <td data-label="Value">{val}</td>
                                </tr>
                            })}
                        </tbody>
                    </table>
                </div> : undefined}
            </div>
        }
        render() {
            return <div>
                <div className="ui top attached tabular menu">
                    { (() => {
                        let tabArray: RobotStateInspectorTabs[] = ["Info", "Motors", "Sensors"];
                        return tabArray.map((val) => {
                            function myLf(str: RobotStateInspectorTabs): string {
                                switch (str) {
                                    case "Info": return lf("Info");
                                    case "Motors": return lf("Motors");
                                    case "Sensors": return lf("Sensors");
                                }
                            }
                            if (val == this.state.tab) return <div key={val} className="active item">{myLf(val)}</div>
                            else return <div key={val} className="item" onClick={() => this.toggleTab(val)}>{myLf(val)}</div>
                        })
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
                                return undefined
                        }
                    })()}
                </div>
            </div>
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
            }

            this.sendRequest = this.sendRequest.bind(this);
            this.onReceiveResponse = this.onReceiveResponse.bind(this);
        }
        getFullUrl(url: string, params: string[][]): string {
            let res = url;
            res += "?"
            for (let param of this.props.params) {
                if (res[res.length - 1] != "?") res += "&";
                let key = encodeURI(param[0]), value = encodeURI(param[1]);
                res += key + "=" + value;
            }
            return res;
        }
        componentWillReceiveProps(props: WebhookTestProps) {
            this.setState({
                fullUrl: this.getFullUrl(props.url, props.params)
            })
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
            }
            xmlHttp.onerror = function() {
                let response_text = `Request error`;
                onReceiveResponse(response_text);
            }
            xmlHttp.ontimeout = function() {
                let response_text = `Request timeout`;
                onReceiveResponse(response_text);
            }

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
            return <div className="ui form">
                <div className="ui field">
                    <h4 className="ui header">{lf("request")}</h4>
                    <textarea readOnly value={this.state.fullUrl}></textarea>
                    <button className="ui button" onClick={this.sendRequest}>{lf("send")}</button>
                </div>
                <div className="ui field">
                    <h4 className="ui header">{lf("response")}</h4>
                    <textarea readOnly value={this.state.response}></textarea>
                </div>
            </div>
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
        })
    }
}


export namespace dialog.robotSettings {
    type ParameterType = number | boolean | string;
    interface SettingItemInputProps {
        parameterName: string;
        parameterVal: ParameterType;
        validatorReg?: RegExp;
    }
    interface SettingItemInputState {
        lastParameterVal: ParameterType;
        parameterVal: ParameterType;
    }
    class SettingItemInput extends React.Component<SettingItemInputProps, SettingItemInputState> {
        constructor(props: SettingItemInputProps) {
            super(props);

            this.state = {
                lastParameterVal: this.props.parameterVal,
                parameterVal: this.props.parameterVal
            }

            this.onValChange = this.onValChange.bind(this);
            this.saveParameter = this.saveParameter.bind(this);
        }

        onValChange(event: React.ChangeEvent<HTMLInputElement>) {
            switch (typeof this.props.parameterVal) {
                case "boolean":
                    this.setState({
                        parameterVal: event.target.checked
                    });
                    break;
                case "number":
                    let newNum = Number(event.target.value);
                    if (isNaN(newNum)) break;
                    this.setState({
                        parameterVal: Number(event.target.value)
                    });
                    break;
                case "string":
                    this.setState({
                        parameterVal: event.target.value
                    });
                    break;
            }
        }

        validator(value: number | string): boolean {
            if (!this.props.validatorReg) return true;
            else return this.props.validatorReg.test(typeof value === "number" ? value.toString() : value);
        }

        saveParameter() {
            if (typeof this.state.parameterVal === "boolean" || this.validator(this.state.parameterVal)) {      // pass validator
                softrobot.settings.writeNvs({
                    key: this.props.parameterName,
                    valType: softrobot.device.robotInfo.nvsSettings[this.props.parameterName].type,
                    val: typeof this.state.parameterVal === "boolean" ? Number(this.state.parameterVal) : this.state.parameterVal
                })

                this.setState({
                    lastParameterVal: this.state.parameterVal
                })
            }
            else {      // not pass validator
                this.setState({
                    parameterVal: this.state.lastParameterVal
                })
            }
        }

        render() {
            return <tr key={this.props.parameterName}>
                <td data-label="Parameter">{lf(this.props.parameterName)}</td>
                <td data-label="Value">{(() => {
                    switch (typeof this.props.parameterVal) {
                        case "boolean":
                            return <div className="ui input">
                                <input type="checkbox" name={this.props.parameterName} checked={this.state.parameterVal as boolean} onChange={this.onValChange} onBlur={this.saveParameter}></input>
                                </div>;
                        case "number":
                            return <div className="ui input">
                            <input type="text" name={this.props.parameterName} value={(this.state.parameterVal as number).toString()} onChange={this.onValChange} onBlur={this.saveParameter}></input>
                            </div>;
                        case "string":
                            return <div className="ui input">
                            <input type="text" name={this.props.parameterName} value={this.state.parameterVal as string} onChange={this.onValChange} onBlur={this.saveParameter}></input>
                            </div>;
                        default:
                            return undefined;
                    }
                })()}</td>
            </tr>
        }
    }

    interface RobotSettingsDialogProps {
        nvsSettings: {[key: string]: softrobot.device.NvsSetting}
    }
    interface RobotSettingsDialogState {

    }
    export class RobotSettingsDialog extends React.Component<RobotSettingsDialogProps, RobotSettingsDialogState> {
        constructor(props: RobotSettingsDialogProps) {
            super(props);
        }

        render() {
            return <table className="ui celled table">
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
                            res.push(<SettingItemInput key={key} parameterName={key} parameterVal={val.value}></SettingItemInput>)
                        }
                    }
                    return res;
                })()}
            </tbody>
        </table>
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
    }
    export class ControlModeDropdown extends React.Component<ControlModeDropdownProps, ControlModeDropdownState> {
        constructor(props: ControlModeDropdownProps) {
            super(props);
        }
        render() {
            return <select className="ui dropdown" defaultValue="0" title={lf("Choose control mode")} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => this.props.setControlMode(parseInt(event.target.value))}>
                <option value="0">{lf("Development")}</option>
                <option value="1">{lf("Synchronization")}</option>
                <option value="2">{lf("Offline")}</option>
          </select>
        }
    }

    /**
     * Button for pair device and show pair status
     */
    interface PairButtonProps {
        paired: boolean;
        pair: () => void;
        unpair: () => void;
    }
    interface PairButtonStatus {
        nuibotId: string
        paired: boolean;
    }
    export class PairButton extends React.Component<PairButtonProps, PairButtonStatus> {
        constructor(props: PairButtonProps) {
            super(props);

            this.state = {
                nuibotId: "",
                paired: props.paired
            }

            softrobot.socket.onNuibotGoOffline.push(() => {this.setState({paired: false})});
            softrobot.socket.onNuibotGoOnline.push(() => {this.setState({paired: true})});

            softrobot.message_command.onRcvCIBoardInfoMessage.push(() => {this.setState({nuibotId: softrobot.util.macAddress2NuibotId(softrobot.device.robotInfo.macAddress)})});
        }
        render() {
            return <sui.Button
                className={this.state.paired ? "ui green button" : "ui grey button"}
                onClick={this.state.paired ? this.props.unpair : this.props.pair}>
                    <i className="icon usb"></i>
                    {this.state.paired ? this.state.nuibotId + " " + lf("Paired") : lf("Pair")}
            </sui.Button>
        }
    }
}