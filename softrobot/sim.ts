/**
 * Handle message from simulator iframe/pxt main thread
 */

namespace softrobot.sim {
    export interface SrSimulatorMessage {
        type: string;
        srMessageType: string;
        commandBinary?: ArrayBuffer;
        synchronizationMode?: boolean;
        httpPost?: {
            url: string;
            data: string;
        }
        httpGet?: {
            url: string;
        }
    }

    /**
     * Message from simulator
     * send message to hardware through websocket
     */
    export function simMessageHandler(msg: SrSimulatorMessage) {
        switch (msg.srMessageType) {
            case 'commandbinary': {
                if (settings.value.control_mode == settings.ControlMode.Synchronization_Mode) message_command.sendArrayBuffer(msg.commandBinary);
                break;
            }
            case 'httppost': {
                if (settings.value.control_mode == settings.ControlMode.Synchronization_Mode) {
                    const http = new XMLHttpRequest();
                    const softRobot = pxt.appTarget.softRobot;
                    const cros_api_url = "https://" + softRobot.corsProxy + "/"
                    http.open("POST", cros_api_url + msg.httpPost.url);
                    http.send(msg.httpPost.data);
                };
                break;
            }
            case 'httpget': {
                if (settings.value.control_mode == settings.ControlMode.Synchronization_Mode) {
                    const http = new XMLHttpRequest();
                    const softRobot = pxt.appTarget.softRobot;
                    const cros_api_url = "https://" + softRobot.corsProxy + "/"
                    http.open("GET", cros_api_url + msg.httpGet.url);
                    http.send();
                }
                break;
            }
            default: {
                console.log("softrobot.sim::simMessageHandler: Unrecognized message type: " + msg.srMessageType);
                break;
            }
        }
    }
}