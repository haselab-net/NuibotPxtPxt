/**
 * Provide interface of command packet for websocket communication between web and softrobot
 * @author gzl
 */

namespace softrobot.packet_command {
    /////////////////////////////////////////////////////////////////
    /////////////////////////    Packet    //////////////////////////
    /////////////////////////////////////////////////////////////////
    /**
     * generate count for packet
     * @deprecated
     */
    export class PacketCount {
        static next_id: number = 0;
        static max_id: number = 3000;       // must smaller than MAX_SHORT
        static getId(): number {
            let tmp = PacketCount.next_id++;
            if (PacketCount.next_id > PacketCount.max_id) PacketCount.next_id = 0;
            return tmp;
        }
    }

    /**
     * content of a websocket packet
     */
    export class Packet {
        static MAXLEN = 1500;
        static HEADERLEN = 4;

        length: number;                 // length of this command
        command: command.CommandId;     // command id
        data: IPacketData;              // content of this command

        constructor(com: command.CommandId, da: IPacketData, len?: number) {
            this.command = com;
            this.data = da;

            len ? this.length = len : this.length = this.getPacketLength();
            if (this.length > Packet.MAXLEN) {
                console.log("softrobot.message.Pakcet::constructor: length of packet exceeds MAXLEN");
            }
        }

        getPacketLength(): number {
            return Packet.HEADERLEN + this.data.getDataLength();
        }

        /**
         * convert this packet object to binary buffer
         * @returns ArrayBuffer | null (if convert to binary failed)
         */
        toBinary(): ArrayBuffer {
            if (!this.toBinaryCheck()) return null;

            // fill header
            let buf = new ArrayBuffer(this.length);
            let dataview = new Int16Array(buf, 0, 2);
            dataview[0] = this.length;
            dataview[1] = this.command;

            // fill data
            let dataPV = new Uint8Array(buf, Packet.HEADERLEN);
            let dataBi: ArrayBuffer = this.data.toBinary();
            if (!dataBi) return null;
            let dataDV = new Uint8Array(dataBi);
            dataPV.set(dataDV);

            return buf;
        }
        private toBinaryCheck(): boolean {
            return true;
        }

        /**
         * convert binary buffer to packet object
         * @returns Packet | null (if convert to Packet failed)
         */
        static fromBinary(bin: ArrayBuffer): Packet {
            // get header
            let dataview = new DataView(bin);
            let len = dataview.getInt16(0, true);
            if (len > this.MAXLEN) return null;
            let com = dataview.getInt16(2, true);

            // get data
            let dataArray: ArrayBuffer = bin.slice(Packet.HEADERLEN, len);
            let da: IPacketData = null;
            switch (com) {
                case command.CommandId.CI_BOARD_INFO:
                {
                    da = PacketBoardInfoData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CI_SENSOR:
                {
                    da = PacketSensorInfoData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CI_DIRECT:
                {
                    da = PacketPoseDirectData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CI_INTERPOLATE:
                {
                    da = PacketPoseInterpolateData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CI_FORCE_CONTROL:
                {
                    da = PacketPoseForceControlData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CI_SETPARAM:
                {
                    da = PacketParamData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CI_RESET_SENSOR:
                {
                    da = PacketResetSensorData.fromBinary(dataArray);
                    break;
                }
                case command.CommandId.CIU_MOVEMENT:
                {
                    da = PacketMovementData.fromBinary(dataArray);
                    break;
                }
                default:
                    {return null;}
            }
            if (!da) return null;

            let res: Packet = new Packet(com, da, len);

            return res;
        }
    }

    /////////////////////////////////////////////////////////////////
    /////////////////////////    Data    ////////////////////////////
    /////////////////////////////////////////////////////////////////
    /**
     * interface for data content of Packet
     */
    export interface IPacketData {
        data: any;
        getDataLength(): number;    // data length in bytes to be sent (NOT receive)
        toBinary(): ArrayBuffer;    // return null if data cannot be sent
    }

    // 1 CI_BOARD_INFO
    export class PacketBoardInfoData implements IPacketData {
        data: any;
        constructor(da: any) {
            this.data = da;
        }
        getDataLength(): number {
            return 0;
        }
        toBinary(): ArrayBuffer {
            return new ArrayBuffer(0);
        }
        static fromBinary(bin: ArrayBuffer): PacketBoardInfoData {
            if (bin.byteLength != 18) return null;

            let dataView = new Int16Array(bin);
            let data: device.RobotInfo = new device.RobotInfo();
            data.systemId = dataView[0];
            data.nTarget = dataView[1];
            data.nMotor = dataView[2];
            data.nCurrent = dataView[3];
            data.nForces = dataView[4];
            data.nTouch = dataView[5];
            data.macAddress = bin.slice(12, 18);

            let res: PacketBoardInfoData = new PacketBoardInfoData(data);

            return res;
        }
    }

    // 4 CI_SENSOR
    export interface ISensorDataRcv {
        pose: number[];
        current: number[];
        force: number[];
        touch: number[];
    }
    export class PacketSensorInfoData implements IPacketData {
        data: any;
        constructor(data: any) {
            this.data = data;
        }
        getDataLength(): number {
            return 0;
        }
        toBinary(): ArrayBuffer {
            return new ArrayBuffer(0);
        }
        static fromBinary(bin: ArrayBuffer): PacketSensorInfoData {
            let dataView = new Int16Array(bin);
            let data: ISensorDataRcv;

            if (dataView.length != device.robotInfo.nMotor + device.robotInfo.nCurrent + device.robotInfo.nForces + device.robotInfo.nTouch) {
                console.log("softrobot.message.PacketSensorInfoData::fromBinary: length of data does not match roboinfo, packet: ", dataView, ", robotInfo: ", device.robotInfo);
                return null;
            }

            data = {
                pose: new Array<number>(device.robotInfo.nMotor),
                current: new Array<number>(device.robotInfo.nCurrent),
                force: new Array<number>(device.robotInfo.nForces),
                touch: new Array<number>(device.robotInfo.nTouch)
            }

            let p: number = 0;

            for (let i = 0; i < device.robotInfo.nMotor; i++) {
                data.pose[i] = dataView[p++];
            }
            for (let i = 0; i < device.robotInfo.nCurrent; i++) {
                data.current[i] = dataView[p++];
            }
            for (let i = 0; i < device.robotInfo.nForces; i++) {
                data.force[i] = dataView[p++];
            }
            for (let i = 0; i < device.robotInfo.nTouch; i++) {
                data.touch[i] = dataView[p++];
            }

            let res: PacketSensorInfoData = new PacketSensorInfoData(data);

            return res;
        }
    }

    // 5 CI_DIRECT
    export interface IPoseDirectData {
        pose: number[];
        velocity: number[];
    }
    export interface IPoseDirectDataRcv {
        pose: number[];
        velocity: number[];
    }
    export class PacketPoseDirectData implements IPacketData {
        data: IPoseDirectData | IPoseDirectDataRcv;
        constructor(da: IPoseDirectData | IPoseDirectDataRcv) {
            this.data = da;
        }
        getDataLength(): number {
            return device.robotInfo.nMotor * 2 * 2;
        }
        toBinary(): ArrayBuffer {
            let res: ArrayBuffer = new ArrayBuffer(this.getDataLength());
            let dataView = new Int16Array(res);
            for (let i: number = 0; i < device.robotInfo.nMotor; i++) {
                dataView[i] = this.data.pose[i];
            }
            for (let i: number = 0; i < device.robotInfo.nMotor; i++) {
                dataView[i + device.robotInfo.nMotor] = this.data.velocity[i];
            }
            return res;
        }
        static fromBinary(bin: ArrayBuffer): PacketPoseDirectData {
            let dataView = new Int16Array(bin);
            let data: IPoseDirectDataRcv = {pose: [], velocity: []};

            if (dataView.byteLength != device.robotInfo.nMotor * 2 * 2) {
                console.log("softrobot.message.PacketPoseDirectData::fromBinary: length of data does not match nMotor");
                return null;
            }

            let p: number = 0;
            data.pose = new Array<number>(device.robotInfo.nMotor);
            for (let i: number = 0; i < device.robotInfo.nMotor; i++) {
                data.pose[i] = dataView[p];
                p++;
            }
            data.velocity = new Array<number>(device.robotInfo.nMotor);
            for (let i: number = 0; i < device.robotInfo.nMotor; i++) {
                data.velocity[i] = dataView[p];
                p++;
            }

            let res: PacketPoseDirectData = new PacketPoseDirectData(data);

            return res;
        }
    }

    // 7 CI_INTERPOLATE
    export interface IPoseInterpolateData {
        pose: number[];
        period: number;
        targetCountWrite: number;
    }
    export interface IPoseInterpolateDataRcv {
        pose: number[],
        targetCountReadMin: number,
        targetCountReadMax: number,
        tickMin: number,
        tickMax: number
    }
    export class PacketPoseInterpolateData implements IPacketData {
        data: IPoseInterpolateData | IPoseInterpolateDataRcv;
        constructor(da: IPoseInterpolateData | IPoseInterpolateDataRcv) {
            this.data = da;
        }
        getDataLength(): number {
            if (this.data.hasOwnProperty("pose")) return device.robotInfo.nMotor * 2 + 2 * 2;   // send
            else return (device.robotInfo.nMotor + 4) * 2;
        }
        toBinary(): ArrayBuffer {
            let res: ArrayBuffer = new ArrayBuffer(this.getDataLength());
            let dataView = new Int16Array(res);
            let data = this.data as IPoseInterpolateData;
            let i: number = 0;
            for (i; i < device.robotInfo.nMotor; i++) {
                dataView[i] = data.pose[i];
            }
            dataView[i++] = data.period;
            dataView[i++] = data.targetCountWrite;
            return res;
        }
        static fromBinary(bin: ArrayBuffer): PacketPoseInterpolateData {
            let dataView = new Int16Array(bin);
            let data: IPoseInterpolateDataRcv = {} as IPoseInterpolateDataRcv;
            let p: number = 0;

            if (dataView.byteLength != (device.robotInfo.nMotor + 4) * 2) {
                console.log("softrobot.message.PacketPoseInterpolateData::fromBinary: length of data does not match nMotor");
                return null;
            }

            data.pose = new Array<number>(device.robotInfo.nMotor);
            for (let i: number = 0; i < device.robotInfo.nMotor; i++, p++) {
                data.pose[i] = dataView[p];
            }

            data.targetCountReadMin = dataView[p++];
            data.targetCountReadMax = dataView[p++];
            data.tickMin = dataView[p++];
            data.tickMax = dataView[p++];

            let res: PacketPoseInterpolateData = new PacketPoseInterpolateData(data);

            return res;
        }
    }

    // 8 CI_FORCE_CONTROL
    /**
     * send data format
     */
    export interface IPoseForceControlData {
        pose: number[];
        period: number;
        targetCountWrite: number;
        jacob: number[][];
    }
    /**
     * receive data format
     */
    export interface IPoseForceControlDataRcv {
        pose: number[];
        targetCountReadMin: number,
        targetCountReadMax: number,
        tickMin: number,
        tickMax: number
    }
    export class PacketPoseForceControlData implements IPacketData {
        data: IPoseForceControlData | IPoseForceControlDataRcv;
        constructor(da: IPoseForceControlData | IPoseForceControlDataRcv) {
            this.data = da;
        }
        getDataLength(): number {
            return device.robotInfo.nMotor * 2 + 2 * 2 + device.robotInfo.nForces * 3 * 2;
        }
        toBinary(): ArrayBuffer {
            let res: ArrayBuffer = new ArrayBuffer(this.getDataLength());
            let dataView = new Int16Array(res);
            let data = this.data as IPoseForceControlData;
            let p: number = 0;
            for (let i = 0; i < device.robotInfo.nMotor; i++) {
                dataView[p++] = this.data.pose[i];
            }
            dataView[p++] = data.period;
            dataView[p++] = data.targetCountWrite;
            for (let i = 0; i < device.robotInfo.nForces; i++) {
                for (let j = 0; j < 3; j++) {
                    dataView[p++] = data.jacob[i][j];
                }
            }
            return res;
        }
        static fromBinary(bin: ArrayBuffer): PacketPoseForceControlData {
            let dataView = new Int16Array(bin);
            let data: IPoseForceControlDataRcv;
            let p: number = 0;

            if (dataView.byteLength != device.robotInfo.nMotor * 2 + 4 * 2) {
                console.log("softrobot.message.PacketPoseForceControlData::fromBinary: length of data does not match nMotor");
                return null;
            }
            data = {
                pose: new Array<number>(device.robotInfo.nMotor),
                targetCountReadMin: 0,
                targetCountReadMax: 0,
                tickMin: 0,
                tickMax: 0
            }
            for (let i: number = 0; i < device.robotInfo.nMotor; i++) {
                data.pose[i] = dataView[p++];
            }
            data.targetCountReadMin = dataView[p++];
            data.targetCountReadMax = dataView[p++];
            data.tickMin = dataView[p++];
            data.tickMax = dataView[p++];

            let res: PacketPoseForceControlData = new PacketPoseForceControlData(data);

            return res;
        }
    }

    // 9 CI_SETPARAM
    export interface IParamData {
        paramType: command.SetParamType;
        params1: number[];
        params2?: number[];
    }
    export interface IParamDataRcv {
    }
    export class PacketParamData implements IPacketData {
        data: IParamData | IParamDataRcv;
        constructor(da: IParamData | IParamDataRcv) {
            this.data = da;
        }
        getDataLength(): number {
            if (this.data.hasOwnProperty("paramType")) {
                let data = this.data as IParamData;
                switch (data.paramType) {
                    case command.SetParamType.PT_PD:
                    case command.SetParamType.PT_TORQUE_LIMIT: {
                        return (1 + device.robotInfo.nMotor * 2) * 2;
                    }
                    case command.SetParamType.PT_CURRENT: {
                        return (1 + device.robotInfo.nMotor) * 2;
                    }
                    default: {
                        console.log("Wrong type of enum SetParamType");
                        return 0;
                    }
                }
            }
            else return 0;
        }
        toBinary(): ArrayBuffer {
            let len = this.getDataLength();
            if (!len) return null;
            let res: ArrayBuffer = new ArrayBuffer(len);
            let dataView = new Int16Array(res);
            let data = this.data as IParamData;
            let p = 0;
            dataView[p++] = data.paramType;
            for (let i: number = 0; i < device.robotInfo.nMotor; i++, p++) {
                dataView[p] = data.params1[i];
            }
            if (p == len / 2) return res;
            for (let i: number = 0; i < device.robotInfo.nMotor; i++, p++) {
                dataView[p] = data.params2[i];
            }
            return res;
        }
        static fromBinary(bin: ArrayBuffer): PacketParamData {
            return new PacketParamData({});
        }
    }

    // 10 CI_RESET_SENSOR
    export interface IResetSensorData {
        resetSensorFlag: command.ResetSensorFlags;
    }
    export interface IResetSensorDataRcv {
    }
    export class PacketResetSensorData implements IPacketData {
        data: IResetSensorData | IResetSensorDataRcv;
        constructor(data: IResetSensorData | IResetSensorDataRcv) {
            this.data = data;
        }
        getDataLength() {
            if (this.data.hasOwnProperty("resetSensorFlag")) return 2;
            else return 0;
        }
        toBinary(): ArrayBuffer {
            let buffer = new ArrayBuffer(this.getDataLength());
            let dataView = new Int16Array(buffer);
            let data = this.data as IResetSensorData;
            if (!data.resetSensorFlag) return null;
            dataView[0] = data.resetSensorFlag;
            return buffer;
        }
        static fromBinary(bin: ArrayBuffer): PacketResetSensorData {
            return new PacketResetSensorData({});
        }
    }

    // 15 CIU_MOVEMENT
    export interface IMovementData {
        movementCommandId: number;
        movementId?: number;
        keyframeId?: number;
        motorCount?: number;
        motorId?: number[];
        period?: number;
        pose?: number[];
        refMovementId?: number;
        refKeyframeId?: number;
        refMotorId?: number;
        timeOffset?: number;
    }
    export interface IMovementDataRcv {
        movementCommandId: number;
        movementId?: number;
        keyframeId?: number;
        success?: number;
        nOccupied?: number[];
    }
    export class PacketMovementData implements IPacketData {
        data: IMovementData | IMovementDataRcv;
        constructor(data: IMovementData | IMovementDataRcv) {
            this.data = data;
        }
        getDataLength(): number {
            switch (this.data.movementCommandId) {
                case command.CommandIdMovement.CI_M_ADD_KEYFRAME:
                    return 1 + 10 + 3 * device.robotInfo.nMotor;
                case command.CommandIdMovement.CI_M_PAUSE_MOV:
                    return 1 + 2 + 1 * device.robotInfo.nMotor;
                case command.CommandIdMovement.CI_M_RESUME_MOV:
                    return 1 + 2;
                case command.CommandIdMovement.CI_M_CLEAR_MOV:
                    return 1 + 2 + 1 * device.robotInfo.nMotor;
                case command.CommandIdMovement.CI_M_PAUSE_INTERPOLATE:
                case command.CommandIdMovement.CI_M_RESUME_INTERPOLATE:
                case command.CommandIdMovement.CI_M_CLEAR_PAUSED:
                case command.CommandIdMovement.CI_M_CLEAR_ALL:
                case command.CommandIdMovement.CI_M_QUERY:
                    return 1 + 0;
                default:
                    console.error("No movementCommandId: " + this.data.movementCommandId);
                    return -1;
            }
        }
        toBinary(): ArrayBuffer {
            let buffer = new ArrayBuffer(this.getDataLength());
            let dataView = new DataView(buffer);
            let p: number = 0;
            p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, this.data.movementCommandId);

            let data = this.data as IMovementData;
            switch (this.data.movementCommandId) {
                case command.CommandIdMovement.CI_M_ADD_KEYFRAME:
                    // little endian on esp side
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.keyframeId);
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.movementId);

                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.motorCount);
                    p = util.writeArrayBufferNumArray(util.cDataType.uint8, dataView, p, data.motorId);
                    p = util.writeArrayBufferNum(util.cDataType.uint16, dataView, p, data.period);
                    p = util.writeArrayBufferNumArray(util.cDataType.int16, dataView, p, data.pose);

                    // little endian on esp side
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.refKeyframeId);
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.refMovementId);

                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.refMotorId);
                    p = util.writeArrayBufferNum(util.cDataType.int16, dataView, p, data.timeOffset);
                    break;
                case command.CommandIdMovement.CI_M_PAUSE_MOV:
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.movementId);
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.motorCount);
                    p = util.writeArrayBufferNumArray(util.cDataType.uint8, dataView, p, data.motorId);
                    break;
                case command.CommandIdMovement.CI_M_RESUME_MOV:
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.movementId);
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.motorCount);
                    break;
                case command.CommandIdMovement.CI_M_CLEAR_MOV:
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.movementId);
                    p = util.writeArrayBufferNum(util.cDataType.uint8, dataView, p, data.motorCount);
                    p = util.writeArrayBufferNumArray(util.cDataType.uint8, dataView, p, data.motorId);
                    break;
                case command.CommandIdMovement.CI_M_PAUSE_INTERPOLATE:
                case command.CommandIdMovement.CI_M_RESUME_INTERPOLATE:
                case command.CommandIdMovement.CI_M_CLEAR_PAUSED:
                case command.CommandIdMovement.CI_M_CLEAR_ALL:
                case command.CommandIdMovement.CI_M_QUERY:
                    break;
                default:
                    return undefined;
            }
            return buffer;
        }
        static fromBinary(bin: ArrayBuffer): PacketMovementData {
            let data: IMovementDataRcv = {
                movementCommandId: 0
            };
            let p: number = 0;
            let dataView = new DataView(bin);
            p = util.readArrayBufferNum(util.cDataType.uint8, data, "movementCommandId", dataView, p);
            switch (data.movementCommandId) {
                case command.CommandIdMovement.CI_M_ADD_KEYFRAME:
                    p = util.readArrayBufferNum(util.cDataType.uint8, data, "movementId", dataView, p);
                    p = util.readArrayBufferNum(util.cDataType.uint8, data, "keyframeId", dataView, p);
                    p = util.readArrayBufferNum(util.cDataType.uint8, data, "success", dataView, p);
                    p = util.readArrayBufferNumArray(util.cDataType.uint8, data, "nOccupied", device.robotInfo.nMotor, dataView, p);
                    break;
                case command.CommandIdMovement.CI_M_PAUSE_MOV:
                case command.CommandIdMovement.CI_M_RESUME_MOV:
                case command.CommandIdMovement.CI_M_CLEAR_MOV:
                case command.CommandIdMovement.CI_M_PAUSE_INTERPOLATE:
                case command.CommandIdMovement.CI_M_RESUME_INTERPOLATE:
                case command.CommandIdMovement.CI_M_CLEAR_PAUSED:
                case command.CommandIdMovement.CI_M_CLEAR_ALL:
                    break;
                case command.CommandIdMovement.CI_M_QUERY:
                    p = util.readArrayBufferNumArray(util.cDataType.uint8, data, "nOccupied", device.robotInfo.nMotor, dataView, p);
                    break;
            }
            return new PacketMovementData(data);
        }
    }
}