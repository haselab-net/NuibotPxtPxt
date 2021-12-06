/**
 * Handle the websocket connection between web and softrobot
 * @description provide pair and communication functions
 * @author gzl
 */

namespace softrobot.socket {

    export let ip_address: string = "192.168.91.104";

    export let web_socket_client: WebSocket;

    export let web_socket_client_jsfile: WebSocket = undefined;

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Pair    ////////////////////////////
    /////////////////////////////////////////////////////////////////

    // ping pong for detecting connection lost of websocket
    class PingPong {
        timeout_handle: number = undefined;
        ping_timeout: number = undefined;
        PING_INTERVAL: number = 5000;
        WAIT_INTERVAL: number = 5000;

        private pingFailed() {
            this.timeout_handle = undefined;
            console.log("No pong in " + this.WAIT_INTERVAL.toString() + " ms");
            web_socket_client.close();
            onWebUnpaired();
        }

        ping() {
            this.ping_timeout = undefined;
            sendAsync(command.PacketId.PI_PINGPONG, {});
            this.timeout_handle = setTimeout(this.pingFailed.bind(this), this.WAIT_INTERVAL);
        }

        pong() {
            if (this.timeout_handle) clearTimeout(this.timeout_handle);
            if (this.ping_timeout) clearTimeout(this.ping_timeout);

            this.timeout_handle = undefined;
            this.ping_timeout = setTimeout(this.ping.bind(this), this.PING_INTERVAL);
        }
    }
    let pingpong = new PingPong();

    /**
     * pair softrobot
     * @author gzl
     */
    export function webPairAsync(): Promise<void> {
        web_socket_client = new WebSocket("ws://" + ip_address + ":80/ws");
        web_socket_client.binaryType = "arraybuffer";

        web_socket_client.onopen = function () {
            console.log("Connection opened");
            pingpong.ping();
            onWebPaired();
        }
        web_socket_client.onclose = function () {
            if (pingpong.ping_timeout) clearTimeout(pingpong.ping_timeout);
            console.log("Connection closed")
            onWebUnpaired();
        }
        web_socket_client.onerror = function () {
            console.error("Connection error")
            onWebUnpaired();
        }
        web_socket_client.onmessage = function (event: MessageEvent) {
            // console.log("receive message: ", event.data);
            socket.receiveAsync(event.data as ArrayBuffer);
        }

        return Promise.delay(1000)
            .then(() => {
                if (!isWebPaired()) return Promise.reject("Failed to create web socket");
                else return Promise.resolve();
            });
    }

    /**
     * pair softrobot
     */
    export function webUnpairAsync(): Promise<void> {
        if (!isWebPaired()) return Promise.reject("Softrobot is not paired");
        web_socket_client.close();
        return Promise.resolve();
    }

    /**
     * judge whether softrobot paired
     */
    export function isWebPaired(): boolean {
        return !!web_socket_client && web_socket_client.readyState == WebSocket.OPEN;
    }

    /**
     * executed when web socket connection is onclose/onerror
     * @author gzl
     */
    export function onWebUnpaired() {
        // intialize corresponding variables to support normal use
        // device.initializeAccess();
        for (const key in onNuibotGoOffline) {
            onNuibotGoOffline[key]();
        }
    }
    export let onNuibotGoOffline: (() => void)[] = [];

    /**
     * executed when web socket connection is onopen
     * @author gzl
     */
    export function onWebPaired() {
        settings.value.control_mode = settings.ControlMode.Development_Mode;    // switch to development mode
        settings.value.sendOfflineMode();       // send current control mode to nuibot

        message_command.requireBoardInfo();     // get board info

        // require firmwareInfo
        let buf: ArrayBuffer = new ArrayBuffer(2);
        let dataView = new DataView(buf);
        dataView.setInt16(0, command.PacketSettingsId.PSI_FIRMWARE_INFO, true);
        settings.sendSettings(buf);

        // require NVS Settings
        for (let param in device.robotInfo.nvsSettings) {
            if (device.robotInfo.nvsSettings.hasOwnProperty(param)) {
                console.log("read nvs: " + param);
                settings.readNvs(param, device.robotInfo.nvsSettings[param].type);
            }
        }

        for (const key in onNuibotGoOnline) {
            onNuibotGoOnline[key]();
        }
    }
    export let onNuibotGoOnline: (() => void)[] = [];

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Communication    ///////////////////
    /////////////////////////////////////////////////////////////////
    interface Packet {
        type: string,
        content: any
    }
    /**
     * Handle packet from server, packet = type + content
     * @param data data
     */
    export function receiveAsync(data: ArrayBuffer): Promise<void> {
        let dataView: DataView = new DataView(data);
        let type: command.PacketId = dataView.getInt16(0, true);
        pingpong.pong();            // when receive message, means the hardware is still online
        switch (type) {
            case command.PacketId.PI_JSFILE: {
                if (dataView.getInt16(2, true) == 1) {       // download file is received by nuibot
                    for (const key in onRcvRecJSFile) {
                        onRcvRecJSFile[key]();
                    }
                }
                break;      // No Receive of this type
            }
            case command.PacketId.PI_COMMAND: {
                let p: packet_command.Packet = packet_command.Packet.fromBinary(data.slice(2));
                if (!p) {
                    console.log("sofrobot.socket::receiveAsync: can not convert Arraybuffer to Packet");
                    message_command.requireBoardInfo();                      // update to the new board info
                    return Promise.reject(new Error("convert to packet failed"));
                }
                message_command.messageHandler(p);
                onRcvCommandPacket.forEach(element => {
                    element(data.slice(2));
                });
                break;
            }
            case command.PacketId.PI_SETTINGS: {
                let settingId = dataView.getInt16(2, true);
                switch (settingId) {
                    case command.PacketSettingsId.PSI_FIRMWARE_INFO: {
                        let jsonObj: device.FirmwareInfo = JSON.parse(util.ab2strAscii(data.slice(4))) as device.FirmwareInfo;
                        device.robotInfo.firmwareInfo = jsonObj;
                        break;
                    }
                    case command.PacketSettingsId.PSI_WRITE_NVS: {
                        settings.onRcvWriteNvs(data.slice(4));
                        break;
                    }
                    case command.PacketSettingsId.PSI_READ_NVS: {
                        settings.onRcvReadNvs(data.slice(4));
                        break;
                    }
                    default: break;
                }
            }
            case command.PacketId.PI_PINGPONG: {
                break;
            }
            default: {
                console.log("softrobot.socket.receiveAsync::Can not recognize packet: ", data);
                break;
            }
        }
        return Promise.resolve();
    }
    export let onRcvCommandPacket: ((packet: ArrayBuffer) => void)[] = [];
    export let onRcvRecJSFile: (() => void)[] = [];

    /**
     * Send websocket packet to hardware, packet = type + content
     * @param type      string: "JSFile"    | "Command"     | "Setting"     |"PingPong"
     * @param content   type:   string      | ArrayBuffer   | ArrayBuffer   |undefined
     */
    export function sendAsync(type: command.PacketId, content: any): Promise<void> {
        if (!isWebPaired()) return Promise.resolve();
        let packet: ArrayBuffer;
        let HEADER_LEN = 2;

        switch (type) {
            case command.PacketId.PI_JSFILE: {
                //content = softrobot.jsfile.main_prefix + content + softrobot.jsfile.main_suffix;
                console.log("send JS file: ", content);

                sendJSFile(content as string, () => {console.log("send success")});

                packet = new ArrayBuffer(HEADER_LEN);
                let dv = new DataView(packet);
                dv.setInt16(0, command.PacketId.PI_JSFILE, true);

                break;
            }
            case command.PacketId.PI_COMMAND: {
                if (settings.value.control_mode == settings.ControlMode.Offline_Mode) {
                    console.log("In offline mode, do not send packet");
                    return Promise.resolve();
                }

                if (!(content instanceof ArrayBuffer)) return Promise.reject(new Error("Wrong content type"));

                packet = new ArrayBuffer(HEADER_LEN + content.byteLength);
                let dataView = new DataView(packet);
                dataView.setInt16(0, command.PacketId.PI_COMMAND, true);
                let pv = new Uint8Array(packet);
                pv.set(new Uint8Array(content), HEADER_LEN);

                break;
            }
            case command.PacketId.PI_SETTINGS: {
                packet = new ArrayBuffer(HEADER_LEN + content.byteLength);
                let dataView = new DataView(packet);
                dataView.setInt16(0, command.PacketId.PI_SETTINGS, true);
                let arrayU8 = new Uint8Array(packet);
                arrayU8.set(new Uint8Array(content), HEADER_LEN);

                break;
            }
            case command.PacketId.PI_PINGPONG: {
                packet = new ArrayBuffer(HEADER_LEN);
                let pv = new Int16Array(packet);
                pv[0] = command.PacketId.PI_PINGPONG;

                break;
            }
            default: {
                console.log("softrobot.socket.receiveAsync::Can not recognize packet");
                return Promise.reject(new Error("Wrong type"));
            }
        }
        web_socket_client.send(packet);
        return Promise.resolve();
    }

    // bind sendMessage function
    message_command.sendArrayBuffer = function(buffer: ArrayBuffer) {
        sendAsync(command.PacketId.PI_COMMAND, buffer);
    }
    settings.sendSettings = function(buffer: ArrayBuffer) {
        sendAsync(command.PacketId.PI_SETTINGS, buffer);
    }


    /**
     * interface of data for websocket communication between softrobot and web
     */
    export interface IData {
        id?: number;             // id of the message
        reply?: boolean;        // need reply when the message is received
        type: string;           // type of the message
        content: any;           // content of the message
    }
    export function isIData(object: any): object is IData {
        return ('id' in object) && ('type' in object) && ('content' in object);
    }

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Send JS File    ////////////////////
    /////////////////////////////////////////////////////////////////
    export function sendJSFile(jsfile: string, onclose: () => void) {
        let isOfflineMode: boolean = settings.value.control_mode == settings.ControlMode.Offline_Mode;

        web_socket_client_jsfile = new WebSocket("ws://" + ip_address + ":80/ws_jsfile");
        // web_socket_client.binaryType = "arraybuffer";

        let jsfile_ascii_bin: ArrayBuffer = util.str2abAscii(jsfile);

        web_socket_client_jsfile.onopen = function () {
            if (isOfflineMode) settings.value.control_mode = settings.ControlMode.Development_Mode;

            let json_head = {
                name: "main.js",
                length: jsfile_ascii_bin.byteLength     // REVIEW the file length espfs = byteLength - 1
            }
            // send json head
            web_socket_client_jsfile.send(JSON.stringify(json_head));
            // send file content
            web_socket_client_jsfile.send(jsfile_ascii_bin);

            console.log("JS file sent to remote");

            web_socket_client_jsfile.close();
            web_socket_client_jsfile = undefined;
        }

        web_socket_client_jsfile.onclose = function () {
            if (isOfflineMode) settings.value.control_mode = settings.ControlMode.Offline_Mode;
        }
    }
}