/**
 * settings of the behavior of browser and hardware
 */

namespace softrobot.settings {
    export enum ControlMode {
        Development_Mode = 0,
        Synchronization_Mode = 1,
        Offline_Mode = 2
    }
    export class Settings {
        private _control_mode: ControlMode = ControlMode.Development_Mode;
        public onSyncModeChange = (syncMode: boolean) => {};        // overwrite by app.tsx to inform simulator

        public sendOfflineMode() {                                  // inform hardware
            let buf = new ArrayBuffer(4);
            let iArray = new Int16Array(buf);
            iArray[0] = command.PacketSettingsId.PSI_OFFLINE_MODE;
            iArray[1] = this._control_mode == ControlMode.Offline_Mode ? 1 : 0;  // offline: 1, other: 0
            sendSettings(buf);
        }
        // inform nuibot
        private onOfflineModeChange() {
            this.sendOfflineMode();
        }
        get control_mode(): ControlMode {
            return this._control_mode;
        }
        set control_mode(v: ControlMode) {
            if (v != this._control_mode) {
                let tmp = this._control_mode;
                this._control_mode = v;

                // 1. clear hardware movement list when exit synchronization mode || offline mode
                if (tmp == ControlMode.Synchronization_Mode || tmp == ControlMode.Offline_Mode) message_command.setMovement({
                    movementCommandId: command.CommandIdMovement.CI_M_CLEAR_ALL
                });

                // 2. inform hardware if offline mode change
                if (tmp == ControlMode.Offline_Mode || v == ControlMode.Offline_Mode) this.onOfflineModeChange();

                // 3. inform simulator if synchronization mode change
                if (tmp == ControlMode.Synchronization_Mode || v == ControlMode.Synchronization_Mode) this.onSyncModeChange(v == ControlMode.Synchronization_Mode);
            }
        }
    }

    export let value: Settings = new Settings();

    /**
     * Communicate settings with hardware
     */
    export interface NVSData {
        key: string;
        valType: util.cDataType;
        val: number | string;
    }
    // write nvs
    let writeCache: {[key: string]: number | string} = {};
    export let writeNvs = function (data: NVSData) {
        let length: number = data.key.length + 1;
        let keyBuf = util.str2abAscii(data.key, true);
        let valBuf: ArrayBuffer;
        if (data.valType >= util.cDataType.uint8 && data.valType <= util.cDataType.int32) {
            let power = Math.floor((data.valType - util.cDataType.uint8) / 2);
            let valLength = Math.pow(2, power);
            length += valLength;
            valBuf = new ArrayBuffer(valLength);
            let dataView = new DataView(valBuf);
            switch (data.valType) {
                case util.cDataType.uint8:
                    dataView.setUint8(0, data.val as number);
                    break;
                case util.cDataType.int8:
                    dataView.setInt8(0, data.val as number);
                    break;
                case util.cDataType.uint16:
                    dataView.setUint16(0, data.val as number, true);
                    break;
                case util.cDataType.int16:
                    dataView.setInt16(0, data.val as number, true);
                    break;
                case util.cDataType.uint32:
                    dataView.setUint32(0, data.val as number, true);
                    break;
                case util.cDataType.int32:
                    dataView.setInt32(0, data.val as number, true);
                    break;
                default: break;
            }
        }
        else if (data.valType == util.cDataType.string) {
            length += (data.val as string).length + 1;
            valBuf = util.str2abAscii(data.val as string, true);
        }

        let buf = new ArrayBuffer(length + 3);
        let dataView = new DataView(buf);
        dataView.setInt16(0, command.PacketSettingsId.PSI_WRITE_NVS, true);
        dataView.setUint8(2, data.valType);
        let array: Uint8Array = new Uint8Array(buf);
        array.set(new Uint8Array(keyBuf), 3);
        array.set(new Uint8Array(valBuf), 3 + data.key.length + 1);

        sendSettings(buf);

        writeCache[data.key] = data.val;
    }
    export let onRcvWriteNvs = function (data: ArrayBuffer) {
        let dataView = new DataView(data);
        let offset: number = 0;
        let nvsData: NVSData = {key: "", valType: 0, val: 0};
        offset = util.readArrayBufferNum(util.cDataType.uint8, nvsData, "valType", dataView, offset);
        offset = util.readArrayBufferStringAscii(nvsData, "key", dataView, offset);

        popInfoOnRcvWriteNvs(nvsData.key);

        // write to robotInfo
        if (typeof device.robotInfo.nvsSettings[nvsData.key].value === "boolean") device.robotInfo.nvsSettings[nvsData.key].value = (writeCache[nvsData.key] !== 0);
        else device.robotInfo.nvsSettings[nvsData.key].value = writeCache[nvsData.key];
    }
    export let popInfoOnRcvWriteNvs: (key: string) => void;             // overwrite by app.tsx
    // read nvs
    export let readNvs = function (key: string, type: util.cDataType) {
        let length: number = key.length + 1;
        let keyBuf = util.str2abAscii(key, true);

        let buf = new ArrayBuffer(length + 3);
        let dataView = new DataView(buf);
        dataView.setInt16(0, command.PacketSettingsId.PSI_READ_NVS, true);
        dataView.setUint8(2, type);
        let array: Uint8Array = new Uint8Array(buf);
        array.set(new Uint8Array(keyBuf), 3);

        sendSettings(buf);
    }
    export let onRcvReadNvs = function (data: ArrayBuffer) {
        let dataView = new DataView(data);
        let offset: number = 0;
        let nvsData: NVSData = {key: "", valType: 0, val: 0};
        offset = util.readArrayBufferNum(util.cDataType.uint8, nvsData, "valType", dataView, offset);
        offset = util.readArrayBufferStringAscii(nvsData, "key", dataView, offset);
        switch (nvsData.valType) {
            case util.cDataType.uint8:
            case util.cDataType.int8:
            case util.cDataType.uint16:
            case util.cDataType.int16:
            case util.cDataType.uint32:
            case util.cDataType.int32:
                offset = util.readArrayBufferNum(nvsData.valType, nvsData, "val", dataView, offset); break;
            case util.cDataType.string:
                offset = util.readArrayBufferStringAscii(nvsData, "val", dataView, offset); break;
        }

        // write to robotInfo
        if (typeof device.robotInfo.nvsSettings[nvsData.key].value === "boolean") device.robotInfo.nvsSettings[nvsData.key].value = (nvsData.val !== 0);
        else device.robotInfo.nvsSettings[nvsData.key].value = nvsData.val;

        // inform hardware settings dialog
        reloadReactOnRcvReadNvs();
    }
    export let reloadReactOnRcvReadNvs: () => void = () => {};          // TODO overwrite by softrobot.tsx
    // general send settings
    export let sendSettings = function (settingBuf: ArrayBuffer) {}     // overwrite by socket.ts
    export function receiveSettings () {                                // called from socket.ts
        return;
    }
}