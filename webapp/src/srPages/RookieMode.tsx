import * as React from 'react';
import {MovementDialog, movementEncoder, movementDecoder} from '../softrobot_movement'
import {component, dialog} from '../softrobot'
import * as sui from "../sui"
import {ProjectsMenu} from '../projects'
import * as mobx from "mobx"
import * as dialogs from "../dialogs";

export interface RookieModeProps {
  parent: pxt.editor.IProjectView
}

export interface RookieModeState {
  paired: boolean,
  movementDialogKey: number,
  defaultCode: string
}

export class RookieMode extends React.Component<RookieModeProps, RookieModeState> {
    private readonly defaultMovementCode = "default_#a29bfe\n4 1 4000\n3 0\n1000 1000\n1000 667\n1000 334\n1000 0"
    private movementCode: string = this.defaultMovementCode
    private disposer: mobx.IReactionDisposer

    private refMovementDialog: React.RefObject<MovementDialog>

    private containerStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      padding: "0px 20px"
    }
    private controllersStyle: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between"
    }
    private pairButtonStyle: React.CSSProperties = {
        margin: "1rem 0",
        display: "flex",
        flexDirection: "row-reverse"
    }

    constructor(props: RookieModeProps) {
        super(props)

        this.sendToNuibot = this.sendToNuibot.bind(this)

        this.state = {
          paired: false,
          movementDialogKey: 0,
          defaultCode: this.defaultMovementCode
        }

        this.refMovementDialog = React.createRef<MovementDialog>()

        this.saveCode = this.saveCode.bind(this)
        this.loadCode = this.loadCode.bind(this)
    }

    componentDidMount() {
      this.disposer = mobx.autorun(() => {
        this.setState({
          paired: softrobot.socket.paired.get() === softrobot.socket.PairStatus.Paired
        })
      })
    }

    private renderMenu() {
      return <ProjectsMenu parent={this.props.parent}/>
    }

    private renderMovementDialog() {
        let motorLengthLimits: number[][] = [];
        const lengthMin: number[] = softrobot.util.getPropArray("lengthMin", softrobot.device.robotState.motor);
        const lengthMax: number[] = softrobot.util.getPropArray("lengthMax", softrobot.device.robotState.motor);
        for (let idx: number = 0; idx < lengthMax.length; idx++) motorLengthLimits.push([lengthMin[idx], lengthMax[idx]]);

        return React.createElement(MovementDialog, {
            key: this.state.movementDialogKey,
            codeStr: this.state.defaultCode,
            encoder: movementEncoder,
            decoder: movementDecoder,
            invalidNames: [],
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
            config: {
              showColorBlock: false,
              showDeveloperTools: false,
            },
            onUpdateCode: (newCode: string) => {
                this.movementCode = newCode
            },
            ref: this.refMovementDialog
          })
    }

    private renderControllers() {
        // pair button
        // auto run
        // download button
        const parameterName = "auto_start"
        const autoStartNvsSetting = softrobot.device.robotInfo.nvsSettings[parameterName]
        return <div style={this.controllersStyle}>
            <dialog.robotSettings.SettingItemInput
                key="auto_start"
                parameterName={parameterName}
                parameterVal={autoStartNvsSetting.value}
                label={autoStartNvsSetting.label}
                display='div'
                classes="ui toggle checkbox"
            />
            <div className="ui basic buttons">
              <sui.Button
                  className={`primary download-button download-button-full`}
                  title={lf("Download to Nuibot")}
                  onClick={this.sendToNuibot}
              >{lf("Download")}</sui.Button>
              <sui.Button key='motorcalibration' title={lf("Calibrate motors")} onClick={this.props.parent.calibrationSoftRobot}>{lf("Calibrate")}</sui.Button>
            </div>
            <div className="ui basic buttons">
              <sui.Button key="save" title={lf("Save to local file")} onClick={this.saveCode} >{lf("Save")}</sui.Button>
              <sui.Button key="load" title={lf("Import from local file")} onClick={this.loadCode} >{lf("Import")}</sui.Button>
            </div>
        </div>
    }

    private renderPairButton() {
      return <div style={this.pairButtonStyle}>
        <component.WrappedPairButton />
      </div>
    }

    private sendToNuibot() {
        const jsFile = `var Movement_1 = motor.movementDecoder("${this.movementCode.replace(/\x0A/g, "\\n")}")\nmotor.setMovement(motor.MovementOption.play, Movement_1)`
        softrobot.socket.sendAsync(softrobot.command.PacketId.PI_JSFILE, jsFile);
    }

    private saveCode() {
      const code = this.refMovementDialog.current.state.codeStr
      pxt.BrowserUtils.browserDownloadText(code, "nuibot.movement", 'text/plain');
    }

    private loadCode() {
      dialogs.showImportFileDialogAsync(".movement").then(file => {
        return ts.pxtc.Util.fileReadAsTextAsync(file)
      }).then(content => {
        if (!content) return
        this.setState({
          movementDialogKey: this.state.movementDialogKey + 1,
          defaultCode: content
        })
      })
    }

    componentWillUnmount() {
        softrobot.socket.webUnpairAsync().then(this.disposer)
    }

    render() {
        return <div className="projectsdialog">
            {this.renderMenu()}
            <div className="ui segment bottom attached tab active tabsegment" style={this.containerStyle}>
              {this.renderMovementDialog()}
              {this.state.paired ? this.renderControllers() : undefined}
              {this.renderPairButton()}
            </div>
        </div>
    }
}
